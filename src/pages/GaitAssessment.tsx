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

type GaitPhase = "idle" | "loading" | "waiting" | "measuring";

export default function GaitAssessment() {
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const lastHipRef = useRef<{ x: number; y: number; time: number } | null>(
    null
  );
  const readyFramesRef = useRef(0);
  const runIdRef = useRef(0);
  const phaseRef = useRef<GaitPhase>("idle");
  const showOverlayRef = useRef(true);
  const [phase, setPhase] = useState<GaitPhase>("idle");
  const [showOverlay, setShowOverlay] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] =
    useState<CameraFacingMode>("environment");
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const isCompactViewport = useIsCompactViewport();
  const [statusText, setStatusText] = useState(
    "開始するとカメラ映像を確認し、全身が収まると歩行の記録を始めます。"
  );
  const [speed, setSpeed] = useState(0);
  const [leftKnee, setLeftKnee] = useState(0);
  const [rightKnee, setRightKnee] = useState(0);

  const updatePhase = useCallback((nextPhase: GaitPhase) => {
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
    lastHipRef.current = null;
    chunksRef.current = [];
    seriesRef.current = [];
    setSpeed(0);
    setLeftKnee(0);
    setRightKnee(0);
  }, []);

  const startRecorder = useCallback((stream: MediaStream) => {
    if (recorderRef.current) {
      return;
    }
    chunksRef.current = [];
    try {
      const recorder = new MediaRecorder(stream, {
        mimeType: "video/webm"
      });
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
      recorder.addEventListener(
        "stop",
        () => {
          resolve();
        },
        { once: true }
      );
      try {
        recorder.requestData();
      } catch (error) {
        console.warn("Unable to request recorder data", error);
      }
      recorder.stop();
    });
  }, []);

  const beginMeasurement = useCallback(async () => {
    const stream = streamRef.current;
    if (!stream) {
      return;
    }
    readyFramesRef.current = 0;
    lastHipRef.current = null;
    seriesRef.current = [];
    announcementController.stopCurrent();
    await playSignalBeep();
    startRecorder(stream);
    updatePhase("measuring");
    setStatusText("記録を開始しました。全身が映る範囲で、いつも通り歩いてください。");
    void announcementController.play("gait.recordingStart");
  }, [startRecorder, updatePhase]);

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
        console.warn("Skipping gait frame because the video is not ready", error);
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
      if (currentPhase === "waiting") {
        if (!hasBody) {
          readyFramesRef.current = 0;
          setStatusText("全身が画面に収まるよう、少し後ろへ下がって立ってください。");
          void announcementController.play("common.bodyMissing", {
            cooldownMs: 4000
          });
        } else {
          readyFramesRef.current += 1;
          if (readyFramesRef.current >= 6) {
            await beginMeasurement();
            if (runId !== runIdRef.current) {
              return;
            }
          }
        }
      } else if (currentPhase === "measuring") {
        const hip = extractHipCenter(result);
        const heightNorm = estimateBodyHeightPixels(result);
        const timestamp = Date.now();
        let computedSpeed = 0;

        if (hasBody && hip && heightNorm && video.videoHeight) {
          const pixelHeight = heightNorm * video.videoHeight;
          const cmPerPixel = getUserHeight() / pixelHeight;
          const last = lastHipRef.current;
          if (last) {
            const dx = (hip.x - last.x) * video.videoWidth;
            const dy = (hip.y - last.y) * video.videoHeight;
            const distancePixels = Math.hypot(dx, dy);
            const distanceCm = distancePixels * cmPerPixel;
            const deltaSec = (timestamp - last.time) / 1000;
            if (deltaSec > 0) {
              computedSpeed = distanceCm / 100 / deltaSec;
            }
          }
          lastHipRef.current = { x: hip.x, y: hip.y, time: timestamp };
          setSpeed(computedSpeed);
          setStatusText("記録中です。全身が映る範囲で、いつも通り歩いてください。");
        } else {
          setStatusText("人物が見えにくくなっています。全身が収まる範囲に戻ってください。");
        }

        seriesRef.current.push({
          timestamp,
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
    [beginMeasurement]
  );

  const start = useCallback(async () => {
    if (
      phaseRef.current === "loading" ||
      phaseRef.current === "waiting" ||
      phaseRef.current === "measuring"
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
      updatePhase("loading");
      setStatusText("解析モジュールを起動しています。少しお待ちください。");
      await getPoseLandmarker();
      if (runId !== runIdRef.current || !streamRef.current?.active) {
        return;
      }
      updatePhase("waiting");
      setStatusText("全身が画面に収まる位置に立つと、記録を開始します。");
      void announcementController.interruptAndPlay("gait.start");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to start gait assessment", error);
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
    lastHipRef.current = null;
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
      updatePhase("waiting");
      setStatusText("カメラを切り替えました。全身が画面に入る位置に調整してください。");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to switch gait camera", error);
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
      setStatusText("開始するとカメラ映像を確認し、全身が収まると歩行の記録を始めます。");
      resetMeasurement();
      return;
    }

    const avgSpeed =
      data.reduce((acc, entry) => acc + (entry.gaitSpeed ?? 0), 0) / data.length;
    const id = Date.now();
    await addSession({
      id,
      type: "gait",
      date: new Date().toISOString(),
      summaryScore: Number(avgSpeed.toFixed(2)),
      notes: "平均歩行速度(m/s)"
    });
    await addTimeSeries({
      sessionId: id,
      frameData: data
    });

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    if (blob.size > 0) {
      await addVideo({ sessionId: id, blob, createdAt: Date.now() });
    }

    updatePhase("idle");
    setStatusText("保存しました。再度記録することもできます。");
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
    setStatusText("開始するとカメラ映像を確認し、全身が収まると歩行の記録を始めます。");
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

  const isRunning = phase === "loading" || phase === "waiting" || phase === "measuring";
  const phaseTitle =
    phase === "idle"
      ? "待機中"
      : phase === "loading"
        ? "起動中"
        : phase === "waiting"
          ? "位置合わせ"
          : "記録中";
  const overlayPrimary =
    phase === "loading" ? (
      <span className="camera-overlay-hint">起動中...</span>
    ) : phase === "measuring" ? (
      <span className="camera-overlay-hint">記録中</span>
    ) : (
      <span className="camera-overlay-hint">全身が入ると開始</span>
    );
  const showIntroContent = isCompactViewport ? !isRunning : phase === "idle";

  return (
    <Layout>
      {showIntroContent ? (
        <section className="page-header">
          <h1>歩行監視モード</h1>
          <p>全身が映る位置に立つと記録を開始します。カメラの前を、いつも通り歩いてください。</p>
        </section>
      ) : null}
      {showIntroContent ? (
        <AssessmentAudioGuide
          announcementKey="pageIntro.gait"
          summary="この検査では、歩く速さや膝の動き、姿勢の傾きを確認します。音声ガイドを聞いてから、いつも通り歩いてください。"
        />
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
            {phase === "idle" ? <PrimaryButton onClick={start}>監視開始</PrimaryButton> : null}
            {phase === "loading" ? (
              <button className="ghost-button" onClick={cancel}>
                中止する
              </button>
            ) : null}
            {phase === "waiting" ? (
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
              <span>推定歩行速度</span>
              <strong>{speed.toFixed(2)} m/s</strong>
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
