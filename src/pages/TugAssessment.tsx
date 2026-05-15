import { useCallback, useEffect, useRef, useState } from "react";
import {
  DrawingUtils,
  PoseLandmarker,
  type PoseLandmarkerResult
} from "@mediapipe/tasks-vision";
import AssessmentAudioGuide from "../components/AssessmentAudioGuide";
import CameraOverlay, { type CameraFacingMode } from "../components/CameraOverlay";
import useIsCompactViewport from "../hooks/useIsCompactViewport";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { announcementController } from "../audio/controller";
import { playSignalBeep } from "../audio/beep";
import { syncOverlayCanvas } from "../mediapipe/canvas";
import {
  estimateBodyHeightPixels,
  extractHipCenter,
  extractKneeAngles,
  getPoseLandmarker,
  isFullBodyInFrame
} from "../mediapipe/pose";
import { addSession, addTimeSeries, addVideo } from "../storage/db";
import { getUserHeight } from "../storage/settings";
import type { TimeSeriesEntry } from "../types";
import { getNextCameraFacingMode, openCameraStream } from "../utils/camera";

type TugPhase = "idle" | "loading" | "positioning" | "ready" | "measuring";
type TugMotionPhase =
  | "standingUp"
  | "walkOut"
  | "turning"
  | "returning"
  | "sittingDown";

type Point = { x: number; y: number; visibility?: number };

const STEP_COOLDOWN_MS = 350;
const STEP_GAP_THRESHOLD = 0.018;
const TURN_MIN_DISPLACEMENT = 0.08;

function getPosePoint(result: PoseLandmarkerResult, index: number) {
  return result.landmarks?.[0]?.[index] as Point | undefined;
}

function getAverageAnkleGap(result: PoseLandmarkerResult) {
  const left = getPosePoint(result, 27);
  const right = getPosePoint(result, 28);
  if (!left || !right) {
    return null;
  }
  return left.y - right.y;
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function TugAssessment() {
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const lastHipRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const startHipRef = useRef<{ x: number; y: number } | null>(null);
  const baselineRef = useRef<{ hipY: number; kneeAvg: number } | null>(null);
  const initialDirectionRef = useRef<number | null>(null);
  const maxDisplacementRef = useRef(0);
  const readyFramesRef = useRef(0);
  const readyCuePlayedRef = useRef(false);
  const startTimeRef = useRef<number | null>(null);
  const standUpSecRef = useRef<number | null>(null);
  const turnSecRef = useRef<number | null>(null);
  const stepCountRef = useRef(0);
  const lastStepSignRef = useRef<number | null>(null);
  const lastStepAtRef = useRef(0);
  const runIdRef = useRef(0);
  const phaseRef = useRef<TugPhase>("idle");
  const showOverlayRef = useRef(true);
  const [phase, setPhase] = useState<TugPhase>("idle");
  const [showOverlay, setShowOverlay] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] =
    useState<CameraFacingMode>("environment");
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const [canStart, setCanStart] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [leftKnee, setLeftKnee] = useState(0);
  const [rightKnee, setRightKnee] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const isCompactViewport = useIsCompactViewport();
  const [statusText, setStatusText] = useState(
    "3mの線と椅子を準備してから、カメラを起動してください。"
  );

  const updatePhase = useCallback((nextPhase: TugPhase) => {
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
    readyFramesRef.current = 0;
    readyCuePlayedRef.current = false;
    lastHipRef.current = null;
    startHipRef.current = null;
    baselineRef.current = null;
    initialDirectionRef.current = null;
    maxDisplacementRef.current = 0;
    startTimeRef.current = null;
    standUpSecRef.current = null;
    turnSecRef.current = null;
    stepCountRef.current = 0;
    lastStepSignRef.current = null;
    lastStepAtRef.current = 0;
    chunksRef.current = [];
    seriesRef.current = [];
    setCanStart(false);
    setElapsedSec(0);
    setSpeed(0);
    setLeftKnee(0);
    setRightKnee(0);
    setStepCount(0);
  }, []);

  const startRecorder = useCallback((stream: MediaStream) => {
    if (recorderRef.current) {
      return;
    }
    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorderRef.current = recorder;
      recorder.start();
    } catch (error) {
      console.warn("MediaRecorder is not available:", error);
      recorderRef.current = null;
    }
  }, []);

  const finalizeRecorder = useCallback(async () => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder || recorder.state === "inactive") {
      return;
    }
    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      try {
        recorder.requestData();
      } catch (error) {
        console.warn("Unable to request recorder data", error);
      }
      recorder.stop();
    });
  }, []);

  const startMeasurement = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream || !canStart) {
      return;
    }
    readyFramesRef.current = 0;
    lastHipRef.current = null;
    seriesRef.current = [];
    startTimeRef.current = Date.now();
    standUpSecRef.current = null;
    turnSecRef.current = null;
    stepCountRef.current = 0;
    setStepCount(0);
    announcementController.stopCurrent();
    await playSignalBeep();
    startRecorder(stream);
    updatePhase("measuring");
    setStatusText("3m立ち上がり歩行テストを計測中です。立ち上がり、3m先で方向転換し、戻って座ったら保存してください。");
    void announcementController.interruptAndPlay("tug.measuring");
  }, [canStart, startRecorder, updatePhase]);

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

      let result: PoseLandmarkerResult;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch (error) {
        if (runId !== runIdRef.current) {
          return;
        }
        console.warn("Skipping 3m stand-up walk frame because the video is not ready", error);
        frameRef.current = requestAnimationFrame(() => {
          void tick(runId);
        });
        return;
      }

      if (runId !== runIdRef.current) {
        return;
      }

      const hasBody = isFullBodyInFrame(result);
      const knee = extractKneeAngles(result);
      const hip = extractHipCenter(result);
      const heightNorm = estimateBodyHeightPixels(result);
      setLeftKnee(knee.left);
      setRightKnee(knee.right);

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
      if (currentPhase === "positioning" || currentPhase === "ready") {
        if (!hasBody) {
          readyFramesRef.current = 0;
          setCanStart(false);
          updatePhase("positioning");
          setStatusText("椅子に座った状態で、全身が画面に収まるように調整してください。");
          announcementController.play("common.bodyMissing", { cooldownMs: 4000 });
        } else {
          readyFramesRef.current += 1;
          if (readyFramesRef.current >= 6) {
            setCanStart(true);
            updatePhase("ready");
            setStatusText("全身を検出しました。準備ができたら計測開始を押してください。");
            if (!readyCuePlayedRef.current) {
              readyCuePlayedRef.current = true;
              void announcementController.play("tug.ready", { cooldownMs: 6000 });
            }
          }
        }
      } else if (currentPhase === "measuring" && startTimeRef.current) {
        const timestamp = Date.now();
        const elapsed = (timestamp - startTimeRef.current) / 1000;
        setElapsedSec(elapsed);
        let computedSpeed = 0;
        let tugPhase: TugMotionPhase = "standingUp";

        if (hasBody && hip && heightNorm && video.videoHeight) {
          const pixelHeight = heightNorm * video.videoHeight;
          const cmPerPixel = getUserHeight() / pixelHeight;
          const kneeAvg = (knee.left + knee.right) / 2;

          if (!baselineRef.current) {
            baselineRef.current = { hipY: hip.y, kneeAvg };
            startHipRef.current = hip;
          }

          const last = lastHipRef.current;
          if (last) {
            const dx = (hip.x - last.x) * video.videoWidth;
            const dy = (hip.y - last.y) * video.videoHeight;
            const distanceCm = Math.hypot(dx, dy) * cmPerPixel;
            const deltaSec = (timestamp - last.time) / 1000;
            if (deltaSec > 0) {
              computedSpeed = distanceCm / 100 / deltaSec;
            }
          }
          lastHipRef.current = { x: hip.x, y: hip.y, time: timestamp };

          const baseline = baselineRef.current;
          if (
            standUpSecRef.current === null &&
            elapsed > 0.4 &&
            (hip.y < baseline.hipY - 0.04 || kneeAvg > baseline.kneeAvg + 8)
          ) {
            standUpSecRef.current = elapsed;
          }

          const startHip = startHipRef.current;
          if (startHip) {
            const displacement = hip.x - startHip.x;
            const absDisplacement = Math.abs(displacement);
            maxDisplacementRef.current = Math.max(
              maxDisplacementRef.current,
              absDisplacement
            );
            if (
              initialDirectionRef.current === null &&
              absDisplacement > TURN_MIN_DISPLACEMENT / 2
            ) {
              initialDirectionRef.current = Math.sign(displacement);
            }
            if (
              turnSecRef.current === null &&
              initialDirectionRef.current !== null &&
              maxDisplacementRef.current > TURN_MIN_DISPLACEMENT &&
              Math.sign(displacement) === -initialDirectionRef.current
            ) {
              turnSecRef.current = elapsed;
            }
          }

          const ankleGap = getAverageAnkleGap(result);
          if (ankleGap !== null && Math.abs(ankleGap) > STEP_GAP_THRESHOLD) {
            const sign = Math.sign(ankleGap);
            if (
              lastStepSignRef.current !== null &&
              sign !== lastStepSignRef.current &&
              timestamp - lastStepAtRef.current > STEP_COOLDOWN_MS
            ) {
              stepCountRef.current += 1;
              lastStepAtRef.current = timestamp;
              setStepCount(stepCountRef.current);
            }
            lastStepSignRef.current = sign;
          }

          if (standUpSecRef.current === null) {
            tugPhase = "standingUp";
          } else if (turnSecRef.current === null) {
            tugPhase = "walkOut";
          } else if (elapsed - turnSecRef.current < 1.2) {
            tugPhase = "turning";
          } else if (computedSpeed < 0.08 && elapsed > 4) {
            tugPhase = "sittingDown";
          } else {
            tugPhase = "returning";
          }

          setSpeed(computedSpeed);
          setStatusText("計測中です。戻って座ったら、停止して保存を押してください。");
        } else {
          setStatusText("人物が見えにくくなっています。全身が収まる範囲に戻ってください。");
        }

        seriesRef.current.push({
          timestamp,
          tugElapsedSec: elapsed,
          tugStepCount: stepCountRef.current,
          tugPhase,
          gaitSpeed: computedSpeed,
          kneeLeftDeg: knee.left,
          kneeRightDeg: knee.right
        });
      }

      if (runId !== runIdRef.current || !streamRef.current?.active) {
        return;
      }

      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    },
    [startMeasurement, updatePhase]
  );

  const startCamera = useCallback(async () => {
    if (phaseRef.current !== "idle") {
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
      updatePhase("loading");
      setStatusText("解析モジュールを起動しています。少しお待ちください。");
      await getPoseLandmarker();
      if (runId !== runIdRef.current || !streamRef.current?.active) {
        return;
      }
      updatePhase("positioning");
      setStatusText("椅子に座った状態で、全身が画面に収まる位置に調整してください。");
      void announcementController.interruptAndPlay("tug.positioning");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to start 3m stand-up walk assessment", error);
      setStatusText("カメラへのアクセスが許可されていません。設定を確認してください。");
      updatePhase("idle");
    }
  }, [cameraFacingMode, resetMeasurement, tick, updatePhase]);

  const switchCamera = useCallback(async () => {
    if (
      phaseRef.current === "loading" ||
      phaseRef.current === "measuring" ||
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
    readyCuePlayedRef.current = false;
    lastHipRef.current = null;
    setCanStart(false);
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
      updatePhase("positioning");
      setStatusText("カメラを切り替えました。全身が画面に入る位置に調整してください。");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to switch 3m stand-up walk camera", error);
      setCameraFacingMode(previousMode);
      updatePhase("idle");
      setStatusText("カメラを切り替えられませんでした。端末の設定を確認してください。");
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [cameraFacingMode, isSwitchingCamera, stopStream, tick, updatePhase]);

  const save = useCallback(async () => {
    announcementController.stopCurrent();
    await finalizeRecorder();
    stopStream();
    const data = seriesRef.current;
    if (!data.length) {
      updatePhase("idle");
      setStatusText("保存できる測定データがありません。もう一度測定してください。");
      resetMeasurement();
      return;
    }

    const first = data[0]?.timestamp ?? Date.now();
    const last = data[data.length - 1]?.timestamp ?? first;
    const totalDurationSec = (last - first) / 1000;
    const speeds = data
      .map((entry) => entry.gaitSpeed)
      .filter((value): value is number => typeof value === "number");
    const avgGaitSpeed = average(speeds);
    const maxGaitSpeed = speeds.length ? Math.max(...speeds) : 0;
    const avgKneeLeftDeg = average(
      data
        .map((entry) => entry.kneeLeftDeg)
        .filter((value): value is number => typeof value === "number")
    );
    const avgKneeRightDeg = average(
      data
        .map((entry) => entry.kneeRightDeg)
        .filter((value): value is number => typeof value === "number")
    );
    const standUpSec = standUpSecRef.current;
    const turnSec = turnSecRef.current;
    const inferenceNotes = [
      "v1では開始・停止をユーザー操作とし、各区間時間はMediaPipeからの簡易推定です。",
      turnSec === null ? "方向転換は十分な横方向移動が見えず、推定できませんでした。" : "",
      standUpSec === null ? "立ち上がり完了時点は推定できませんでした。" : ""
    ]
      .filter(Boolean)
      .join(" ");
    const details = {
      totalDurationSec,
      standUpSec,
      walkOutSec: standUpSec !== null && turnSec !== null ? turnSec - standUpSec : null,
      turnSec,
      returnAndSitSec: turnSec !== null ? totalDurationSec - turnSec : null,
      stepCount: stepCountRef.current,
      avgGaitSpeed,
      maxGaitSpeed,
      avgKneeLeftDeg,
      avgKneeRightDeg,
      inferenceNotes
    };
    const id = Date.now();
    await addSession({
      id,
      type: "tug",
      date: new Date().toISOString(),
      summaryScore: Number(totalDurationSec.toFixed(2)),
      notes: `合計 ${totalDurationSec.toFixed(1)}秒 / 歩数 ${stepCountRef.current}歩`
    });
    await addTimeSeries({
      sessionId: id,
      frameData: data,
      details
    });

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    if (blob.size > 0) {
      await addVideo({ sessionId: id, blob, createdAt: Date.now() });
    }

    updatePhase("idle");
    setStatusText("保存しました。再度3m立ち上がり歩行テストを行うこともできます。");
    void announcementController.interruptAndPlay("tug.done");
    resetMeasurement();
  }, [finalizeRecorder, resetMeasurement, stopStream, updatePhase]);

  const cancel = useCallback(() => {
    announcementController.stopCurrent();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    stopStream();
    resetMeasurement();
    updatePhase("idle");
    setStatusText("3mの線と椅子を準備してから、カメラを起動してください。");
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
    phase === "loading" ||
    phase === "positioning" ||
    phase === "ready" ||
    phase === "measuring";
  const phaseTitle =
    phase === "idle"
      ? "準備"
      : phase === "loading"
        ? "起動中"
        : phase === "positioning"
          ? "位置合わせ"
          : phase === "ready"
            ? "開始待ち"
            : "計測中";
  const overlayPrimary =
    phase === "loading" ? (
      <span className="camera-overlay-hint">起動中...</span>
    ) : phase === "measuring" ? (
      <span className="camera-overlay-countdown">{elapsedSec.toFixed(1)}</span>
    ) : (
      <span className="camera-overlay-hint">
        {phase === "ready" ? "計測開始できます" : "全身が入ると準備完了"}
      </span>
    );
  const showIntroContent = isCompactViewport ? !isRunning : phase === "idle";

  return (
    <Layout>
      {showIntroContent ? (
        <section className="page-header">
          <h1>3m立ち上がり歩行テスト</h1>
          <p>
            椅子から立ち上がり、3m先で方向転換して戻り、座るまでの動きを記録します。
          </p>
        </section>
      ) : null}

      {showIntroContent ? (
        <AssessmentAudioGuide
          announcementKey="pageIntro.tug"
          summary="この検査では、椅子から立ち上がって3m先で方向転換し、戻って座るまでの動きを確認します。音量を調整してから始められます。"
        />
      ) : null}

      {showIntroContent ? (
        <section className="tug-prep-section">
          <div className="grid-2">
            {[
              "3mを測って床に線を引く",
              "椅子を用意して座る",
              "歩く範囲の荷物やコードをどける",
              "ふらつきがある場合は家族や介助者が見守る"
            ].map((item) => (
              <div key={item} className="card tug-prep-card">
                <strong>{item}</strong>
              </div>
            ))}
          </div>
          <div className="button-row">
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                announcementController.enableAutoplay();
                void announcementController.interruptAndPlay("tug.prep");
              }}
            >
              準備案内を聞く
            </button>
          </div>
        </section>
      ) : null}

      <section className="camera-panel ptosis-camera-panel">
        <div ref={frameElementRef} className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? <canvas ref={canvasRef} className="camera-canvas" /> : null}
          <CameraOverlay
            tone={phase === "measuring" ? "active" : "guide"}
            topLabel={phaseTitle}
            topMessage={statusText}
            centerPrimary={overlayPrimary}
            cameraFacingMode={cameraFacingMode}
            onSwitchCamera={switchCamera}
            isCameraSwitching={isSwitchingCamera}
            isCameraSwitchDisabled={phase === "loading" || phase === "measuring"}
          />
        </div>
        <div className="camera-sidebar ptosis-camera-sidebar">
          <div className="button-row ptosis-button-row">
            {phase === "idle" ? (
              <PrimaryButton onClick={startCamera}>カメラを準備</PrimaryButton>
            ) : null}
            {phase === "loading" ? (
              <button className="ghost-button" onClick={cancel}>
                中止する
              </button>
            ) : null}
            {phase === "positioning" || phase === "ready" ? (
              <>
                <PrimaryButton onClick={startMeasurement} disabled={!canStart}>
                  計測開始
                </PrimaryButton>
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
            {phase === "measuring" ? (
              <>
                <PrimaryButton onClick={save}>停止して保存</PrimaryButton>
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
          </div>

          <div className="camera-metrics ptosis-camera-metrics">
            <div className="metric">
              <span>経過時間</span>
              <strong>{elapsedSec.toFixed(1)}s</strong>
            </div>
            <div className="metric">
              <span>推定歩行速度</span>
              <strong>{speed.toFixed(2)} m/s</strong>
            </div>
            <div className="metric">
              <span>歩数</span>
              <strong>{stepCount}歩</strong>
            </div>
            <div className="metric">
              <span>膝角度 左</span>
              <strong>{leftKnee.toFixed(1)}°</strong>
            </div>
            <div className="metric">
              <span>膝角度 右</span>
              <strong>{rightKnee.toFixed(1)}°</strong>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
