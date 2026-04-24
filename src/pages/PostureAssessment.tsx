import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import AssessmentAudioGuide from "../components/AssessmentAudioGuide";
import CameraOverlay, { type CameraFacingMode } from "../components/CameraOverlay";
import useIsCompactViewport from "../hooks/useIsCompactViewport";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { announcementController } from "../audio/controller";
import { playSignalBeep } from "../audio/beep";
import { syncOverlayCanvas } from "../mediapipe/canvas";
import {
  extractPostureAngles,
  getPoseLandmarker,
  isFrontFacingPose,
  isFullBodyInFrame,
  isSideFacingPose
} from "../mediapipe/pose";
import { addSession, addTimeSeries } from "../storage/db";
import type { TimeSeriesEntry } from "../types";
import { getNextCameraFacingMode, openCameraStream } from "../utils/camera";

type PosturePhase =
  | "idle"
  | "frontWaiting"
  | "frontHolding"
  | "sideWaiting"
  | "sideHolding"
  | "completed";

const POSTURE_HOLD_SEC = 5;
const POSTURE_HOLD_MS = POSTURE_HOLD_SEC * 1000;
const SNAPSHOT_MAX_WIDTH = 960;

type PostureSnapshots = {
  front?: string;
  side?: string;
};

export default function PostureAssessment() {
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const snapshotsRef = useRef<PostureSnapshots>({});
  const holdStartedAtRef = useRef<number | null>(null);
  const readyFramesRef = useRef(0);
  const sideCuePlayedRef = useRef(false);
  const runIdRef = useRef(0);
  const phaseRef = useRef<PosturePhase>("idle");
  const showOverlayRef = useRef(true);
  const [phase, setPhase] = useState<PosturePhase>("idle");
  const [showOverlay, setShowOverlay] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] =
    useState<CameraFacingMode>("environment");
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [countdown, setCountdown] = useState(POSTURE_HOLD_SEC);
  const isCompactViewport = useIsCompactViewport();
  const [statusText, setStatusText] = useState(
    "開始すると正面姿勢を検知して5秒計測し、その後に側面姿勢を計測します。"
  );
  const [lateralTilt, setLateralTilt] = useState(0);
  const [trunkFlexion, setTrunkFlexion] = useState(0);
  const [droppedHead, setDroppedHead] = useState(0);
  const [snapshots, setSnapshots] = useState<PostureSnapshots>({});
  const [completedSummary, setCompletedSummary] = useState<{
    lateralTiltDeg: number;
    trunkFlexionDeg: number;
    droppedHeadDeg: number;
  } | null>(null);

  const updatePhase = useCallback((nextPhase: PosturePhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const stopStream = useCallback(() => {
    runIdRef.current += 1;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const resetMeasurement = useCallback(() => {
    seriesRef.current = [];
    snapshotsRef.current = {};
    readyFramesRef.current = 0;
    holdStartedAtRef.current = null;
    sideCuePlayedRef.current = false;
    setCountdown(POSTURE_HOLD_SEC);
    setLateralTilt(0);
    setTrunkFlexion(0);
    setDroppedHead(0);
    setSnapshots({});
    setCompletedSummary(null);
  }, []);

  const captureSnapshot = useCallback((view: keyof PostureSnapshots) => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return;
    }

    const scale = Math.min(1, SNAPSHOT_MAX_WIDTH / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    snapshotsRef.current = {
      ...snapshotsRef.current,
      [view]: dataUrl
    };
    setSnapshots(snapshotsRef.current);
  }, []);

  const startHolding = useCallback(
    async (nextPhase: Extract<PosturePhase, "frontHolding" | "sideHolding">) => {
      readyFramesRef.current = 0;
      captureSnapshot(nextPhase === "frontHolding" ? "front" : "side");
      setCountdown(POSTURE_HOLD_SEC);
      announcementController.stopCurrent();
      await playSignalBeep();
      holdStartedAtRef.current = Date.now();
      updatePhase(nextPhase);
      if (nextPhase === "frontHolding") {
        setStatusText("正面の姿勢を5秒間キープしてください。");
        void announcementController.play("posture.frontHold");
      } else {
        setStatusText("そのまま横向きを5秒間キープしてください。");
        void announcementController.play("posture.sideReady");
      }
    },
    [captureSnapshot, updatePhase]
  );

  const finishMeasurement = useCallback(() => {
    stopStream();
    const frontFrames = seriesRef.current.filter(
      (entry) =>
        entry.lateralTiltDeg !== undefined && entry.trunkFlexionDeg === undefined
    );
    const sideFrames = seriesRef.current.filter(
      (entry) => entry.trunkFlexionDeg !== undefined
    );
    const avg = (values: number[]) =>
      values.length === 0
        ? 0
        : values.reduce((sum, value) => sum + value, 0) / values.length;
    const summary = {
      lateralTiltDeg: avg(frontFrames.map((entry) => entry.lateralTiltDeg ?? 0)),
      trunkFlexionDeg: avg(
        sideFrames.map((entry) => entry.trunkFlexionDeg ?? 0)
      ),
      droppedHeadDeg: avg(sideFrames.map((entry) => entry.droppedHeadDeg ?? 0))
    };
    setCompletedSummary(summary);
    updatePhase("completed");
    setStatusText("姿勢検査が終了しました。保存して結果を記録できます。");
    void announcementController.interruptAndPlay("posture.done");
  }, [stopStream, updatePhase]);

  const tick = useCallback(
    async (runId: number) => {
      if (runId !== runIdRef.current) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      const stream = streamRef.current;
      if (!stream?.active) {
        return;
      }

      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const landmarker = await getPoseLandmarker();
      if (runId !== runIdRef.current) {
        return;
      }

      if (
        video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        frameRef.current = requestAnimationFrame(() => {
          void tick(runId);
        });
        return;
      }

      let result;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch (error) {
        if (runId !== runIdRef.current) {
          return;
        }
        console.warn("Skipping posture frame because the video is not ready", error);
        frameRef.current = requestAnimationFrame(() => {
          void tick(runId);
        });
        return;
      }

      if (runId !== runIdRef.current) {
        return;
      }

      const postureAngles = extractPostureAngles(result);
      const hasBody = isFullBodyInFrame(result);
      const frontReady = hasBody && isFrontFacingPose(result);
      const sideReady = hasBody && isSideFacingPose(result);
      setLateralTilt(postureAngles.lateralTiltDeg);
      setTrunkFlexion(postureAngles.trunkFlexionDeg);
      setDroppedHead(postureAngles.droppedHeadDeg);

      if (canvas && ctx && showOverlayRef.current && result.landmarks?.length) {
        if (!drawingUtilsRef.current) {
          drawingUtilsRef.current = new DrawingUtils(ctx);
        }
        syncOverlayCanvas(video, canvas, frameElementRef.current);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const drawingUtils = drawingUtilsRef.current;
        for (const landmarks of result.landmarks) {
          drawingUtils.drawLandmarks(landmarks, {
            color: "rgba(102, 208, 255, 0.35)",
            radius: 2
          });
          drawingUtils.drawConnectors(
            landmarks,
            PoseLandmarker.POSE_CONNECTIONS,
            { color: "rgba(102, 208, 255, 0.5)", lineWidth: 2 }
          );
        }
      } else if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      const currentPhase = phaseRef.current;
      if (currentPhase === "frontWaiting") {
        if (!hasBody) {
          readyFramesRef.current = 0;
          setStatusText("全身が画面の枠に収まるよう、少し後ろへ下がってください。");
          void announcementController.play("common.bodyMissing", {
            cooldownMs: 4000
          });
        } else if (!frontReady) {
          readyFramesRef.current = 0;
          setStatusText("正面を向いて、肩と腰がまっすぐ見える位置に立ってください。");
        } else {
          readyFramesRef.current += 1;
          if (readyFramesRef.current >= 8) {
            await startHolding("frontHolding");
            if (runId !== runIdRef.current) {
              return;
            }
          }
        }
      } else if (currentPhase === "frontHolding" && holdStartedAtRef.current) {
        const elapsedMs = Date.now() - holdStartedAtRef.current;
        const remaining = Math.max(
          0,
          POSTURE_HOLD_SEC - Math.floor(elapsedMs / 1000)
        );
        setCountdown(remaining);
        seriesRef.current.push({
          timestamp: Date.now(),
          lateralTiltDeg: postureAngles.lateralTiltDeg,
          poseStable: 1
        });
        if (elapsedMs >= POSTURE_HOLD_MS) {
          holdStartedAtRef.current = null;
          sideCuePlayedRef.current = false;
          updatePhase("sideWaiting");
          setStatusText("次に横向きで立ってください。");
          void announcementController.interruptAndPlay("posture.sideTurn");
        }
      } else if (currentPhase === "sideWaiting") {
        if (!hasBody) {
          readyFramesRef.current = 0;
          setStatusText("全身が画面の枠に収まるよう、少し後ろへ下がってください。");
          void announcementController.play("common.bodyMissing", {
            cooldownMs: 4000
          });
        } else if (!sideReady) {
          readyFramesRef.current = 0;
          setStatusText("カメラに対して横向きになるよう体の向きを整えてください。");
        } else {
          readyFramesRef.current += 1;
          if (readyFramesRef.current >= 8) {
            await startHolding("sideHolding");
            if (runId !== runIdRef.current) {
              return;
            }
          }
        }
      } else if (currentPhase === "sideHolding" && holdStartedAtRef.current) {
        const elapsedMs = Date.now() - holdStartedAtRef.current;
        const remaining = Math.max(
          0,
          POSTURE_HOLD_SEC - Math.floor(elapsedMs / 1000)
        );
        setCountdown(remaining);
        seriesRef.current.push({
          timestamp: Date.now(),
          trunkFlexionDeg: postureAngles.trunkFlexionDeg,
          droppedHeadDeg: postureAngles.droppedHeadDeg,
          lateralTiltDeg: postureAngles.lateralTiltDeg,
          poseStable: 1
        });
        if (elapsedMs >= 2400 && !sideCuePlayedRef.current) {
          sideCuePlayedRef.current = true;
          void announcementController.interruptAndPlay("posture.sideHold");
        }
        if (elapsedMs >= POSTURE_HOLD_MS) {
          finishMeasurement();
        }
      }

      if (runId !== runIdRef.current || !streamRef.current?.active) {
        return;
      }

      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    },
    [finishMeasurement, startHolding, updatePhase]
  );

  const start = useCallback(async () => {
    const currentPhase = phaseRef.current;
    if (
      currentPhase === "frontWaiting" ||
      currentPhase === "frontHolding" ||
      currentPhase === "sideWaiting" ||
      currentPhase === "sideHolding"
    ) {
      return;
    }
    try {
      announcementController.enableAutoplay();
      resetMeasurement();
      const stream = await openCameraStream(cameraFacingMode);
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (canvasRef.current) {
          syncOverlayCanvas(
            videoRef.current,
            canvasRef.current,
            frameElementRef.current
          );
        }
      }
      updatePhase("frontWaiting");
      setStatusText("正面を向き、足を肩幅に開いて立ってください。");
      void announcementController.interruptAndPlay("posture.frontIntro");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to start posture assessment", error);
      setStatusText("カメラへのアクセスが許可されていません。設定を確認してください。");
      updatePhase("idle");
    }
  }, [cameraFacingMode, resetMeasurement, tick, updatePhase]);

  const switchCamera = useCallback(async () => {
    const currentPhase = phaseRef.current;
    if (
      currentPhase === "frontHolding" ||
      currentPhase === "sideHolding" ||
      isSwitchingCamera
    ) {
      return;
    }

    const previousMode = cameraFacingMode;
    const nextMode = getNextCameraFacingMode(previousMode);
    setCameraFacingMode(nextMode);

    if (!streamRef.current?.active) {
      return;
    }

    setIsSwitchingCamera(true);
    stopStream();
    readyFramesRef.current = 0;
    holdStartedAtRef.current = null;
    try {
      const stream = await openCameraStream(nextMode);
      const runId = runIdRef.current + 1;
      runIdRef.current = runId;
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        if (canvasRef.current) {
          syncOverlayCanvas(
            videoRef.current,
            canvasRef.current,
            frameElementRef.current
          );
        }
      }
      updatePhase(currentPhase === "sideWaiting" ? "sideWaiting" : "frontWaiting");
      setStatusText("カメラを切り替えました。姿勢が画面に入る位置に調整してください。");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to switch posture camera", error);
      setCameraFacingMode(previousMode);
      updatePhase("idle");
      setStatusText("カメラを切り替えられませんでした。端末の設定を確認してください。");
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [cameraFacingMode, isSwitchingCamera, stopStream, tick, updatePhase]);

  const save = useCallback(async () => {
    const summary = completedSummary;
    if (!summary) {
      return;
    }
    const id = Date.now();
    const score =
      (Math.abs(summary.lateralTiltDeg) +
        summary.trunkFlexionDeg +
        summary.droppedHeadDeg) /
      3;
    await addSession({
      id,
      type: "posture",
      date: new Date().toISOString(),
      summaryScore: Number(score.toFixed(2)),
      notes: `前屈 ${summary.trunkFlexionDeg.toFixed(1)}° / 首下がり ${summary.droppedHeadDeg.toFixed(1)}° / 側方偏位 ${summary.lateralTiltDeg.toFixed(1)}°`
    });
    await addTimeSeries({
      sessionId: id,
      frameData: seriesRef.current,
      details: {
        ...summary,
        holdDurationSec: POSTURE_HOLD_SEC,
        snapshots: snapshotsRef.current
      }
    });
    resetMeasurement();
    updatePhase("idle");
    setStatusText("保存しました。再度検査することもできます。");
  }, [completedSummary, resetMeasurement, updatePhase]);

  const cancel = useCallback(() => {
    stopStream();
    announcementController.stopCurrent();
    resetMeasurement();
    updatePhase("idle");
    setStatusText(
      "開始すると正面姿勢を検知して5秒計測し、その後に側面姿勢を計測します。"
    );
  }, [resetMeasurement, stopStream, updatePhase]);

  useEffect(() => {
    return () => {
      stopStream();
      announcementController.stopCurrent();
    };
  }, [stopStream]);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
    if (!showOverlay) {
      drawingUtilsRef.current = null;
    }
  }, [showOverlay]);

  const isRunning =
    phase === "frontWaiting" ||
    phase === "frontHolding" ||
    phase === "sideWaiting" ||
    phase === "sideHolding";
  const phaseTitle =
    phase === "idle"
      ? "待機中"
      : phase === "frontWaiting"
        ? "正面の位置合わせ"
        : phase === "frontHolding"
          ? "正面を計測中"
          : phase === "sideWaiting"
            ? "側面の位置合わせ"
            : phase === "sideHolding"
              ? "側面を計測中"
              : "保存待ち";
  const overlayPrimary =
    phase === "frontHolding" || phase === "sideHolding" ? (
      <span className="camera-overlay-countdown">{countdown}</span>
    ) : phase === "completed" ? (
      <span className="camera-overlay-hint">保存待ち</span>
    ) : (
      <span className="camera-overlay-hint">自動で開始</span>
    );
  const showIntroContent = isCompactViewport ? !isRunning : phase === "idle";

  return (
    <Layout>
      {showIntroContent ? (
        <section className="page-header">
          <h1>姿勢検査</h1>
          <p>
            側方偏位、体幹前屈角、首下がり角を順に確認します。正面と側面で、それぞれ5秒間の保持計測を行います。
          </p>
        </section>
      ) : null}
      {showIntroContent ? (
        <AssessmentAudioGuide
          announcementKey="pageIntro.posture"
          summary="この検査では、正面と横向きの姿勢から、体の傾きや前かがみの角度を確認します。普段通りの自然な姿勢で進めます。"
        />
      ) : null}

      <section className="camera-panel ptosis-camera-panel">
        <div ref={frameElementRef} className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? <canvas ref={canvasRef} className="camera-canvas" /> : null}
          <CameraOverlay
            tone={phase === "frontHolding" || phase === "sideHolding" ? "active" : "guide"}
            topLabel={phaseTitle}
            topMessage={statusText}
            centerPrimary={overlayPrimary}
            cameraFacingMode={cameraFacingMode}
            onSwitchCamera={switchCamera}
            isCameraSwitching={isSwitchingCamera}
            isCameraSwitchDisabled={phase === "frontHolding" || phase === "sideHolding"}
          />
        </div>
        <div className="camera-sidebar ptosis-camera-sidebar">
          <div className="button-row ptosis-button-row">
            {phase === "idle" ? <PrimaryButton onClick={start}>測定開始</PrimaryButton> : null}
            {isRunning ? (
              <>
                <button className="ghost-button" onClick={cancel}>
                  中止する
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowOverlay((prev) => !prev)}
                >
                  {showOverlay ? "推定表示をOFF" : "推定表示をON"}
                </button>
              </>
            ) : null}
            {phase === "completed" ? (
              <>
                <PrimaryButton onClick={save}>保存する</PrimaryButton>
                <button className="ghost-button" onClick={start}>
                  もう一度測定
                </button>
              </>
            ) : null}
          </div>

          <div className="camera-metrics ptosis-camera-metrics">
            <div className="metric">
              <span>側方偏位</span>
              <strong>{lateralTilt.toFixed(1)}°</strong>
            </div>
            <div className="metric">
              <span>体幹前屈角</span>
              <strong>{trunkFlexion.toFixed(1)}°</strong>
            </div>
            <div className="metric">
              <span>首下がり角</span>
              <strong>{droppedHead.toFixed(1)}°</strong>
            </div>
          </div>
          {phase === "completed" &&
          (snapshots.front || snapshots.side) ? (
            <div className="camera-metrics ptosis-camera-metrics">
              {snapshots.front ? (
                <div className="metric">
                  <span>正面写真</span>
                  <strong>撮影済み</strong>
                </div>
              ) : null}
              {snapshots.side ? (
                <div className="metric">
                  <span>側面写真</span>
                  <strong>撮影済み</strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </Layout>
  );
}
