import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, FaceLandmarker } from "@mediapipe/tasks-vision";
import AssessmentAudioGuide from "../components/AssessmentAudioGuide";
import CameraOverlay from "../components/CameraOverlay";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { announcementController } from "../audio/controller";
import { playSignalBeep } from "../audio/beep";
import { syncOverlayCanvas } from "../mediapipe/canvas";
import { addSession, addTimeSeries } from "../storage/db";
import { extractEar, getFaceLandmarker, isFaceCentered } from "../mediapipe/face";
import type { TimeSeriesEntry } from "../types";

type PtosisPhase = "idle" | "waiting" | "measuring" | "completed";

export default function PtosisAssessment() {
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const readyFramesRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const progressCueRef = useRef({ ten: false, twenty: false });
  const runIdRef = useRef(0);
  const phaseRef = useRef<PtosisPhase>("idle");
  const showOverlayRef = useRef(true);
  const [phase, setPhase] = useState<PtosisPhase>("idle");
  const [showOverlay, setShowOverlay] = useState(true);
  const [earLeft, setEarLeft] = useState(0);
  const [earRight, setEarRight] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [statusText, setStatusText] = useState(
    "開始すると音声案内に合わせて顔位置を確認します。"
  );

  const stopStream = useCallback(() => {
    runIdRef.current += 1;
    if (frameRef.current) {
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
    readyFramesRef.current = 0;
    startTimeRef.current = null;
    progressCueRef.current = { ten: false, twenty: false };
    setElapsed(0);
    setEarLeft(0);
    setEarRight(0);
  }, []);

  const updatePhase = useCallback((nextPhase: PtosisPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const beginMeasurement = useCallback(async () => {
    announcementController.stopCurrent();
    await playSignalBeep();
    startTimeRef.current = Date.now();
    progressCueRef.current = { ten: false, twenty: false };
    setElapsed(0);
    updatePhase("measuring");
    setStatusText("良い位置です。30秒間、そのまま上を見てください。");
  }, [updatePhase]);

  const tick = useCallback(async (runId: number) => {
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
    const landmarker = await getFaceLandmarker();
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

    const now = performance.now();
    let result;
    try {
      result = landmarker.detectForVideo(video, now);
    } catch (error) {
      if (runId !== runIdRef.current) {
        return;
      }
      console.warn("Skipping ptosis frame because the video is not ready", error);
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
      return;
    }

    if (runId !== runIdRef.current) {
      return;
    }

    const ear = extractEar(result);
    const faceReady = isFaceCentered(result);
    setEarLeft(ear.left);
    setEarRight(ear.right);

    if (canvas && ctx && showOverlayRef.current && result.faceLandmarks?.length) {
      if (!drawingUtilsRef.current) {
        drawingUtilsRef.current = new DrawingUtils(ctx);
      }
      syncOverlayCanvas(video, canvas, frameElementRef.current);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const drawingUtils = drawingUtilsRef.current;
      for (const landmarks of result.faceLandmarks) {
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_TESSELATION,
          { color: "rgba(255, 255, 255, 0.16)", lineWidth: 1 }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
          { color: "rgba(51, 255, 153, 0.6)", lineWidth: 2 }
        );
        drawingUtils.drawConnectors(
          landmarks,
          FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
          { color: "rgba(51, 255, 153, 0.6)", lineWidth: 2 }
        );
      }
    } else if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    const currentPhase = phaseRef.current;

    if (currentPhase === "waiting") {
      if (!faceReady) {
        readyFramesRef.current = 0;
        setStatusText("スマートフォンを、顔の正面に置いてください。");
        void announcementController.play("common.faceMissing", {
          cooldownMs: 4000
        });
      } else {
        readyFramesRef.current += 1;
        if (readyFramesRef.current >= 6) {
          readyFramesRef.current = 0;
          await beginMeasurement();
          if (runId !== runIdRef.current) {
            return;
          }
        }
      }
    } else if (currentPhase === "measuring" && startTimeRef.current) {
      const timestamp = Date.now();
      const seconds = Math.floor((timestamp - startTimeRef.current) / 1000);
      setElapsed(seconds);
      seriesRef.current.push({
        timestamp,
        earLeft: ear.left,
        earRight: ear.right
      });

      if (seconds >= 10 && !progressCueRef.current.ten) {
        progressCueRef.current.ten = true;
        void announcementController.interruptAndPlay("ptosis.progress10");
      }
      if (seconds >= 20 && !progressCueRef.current.twenty) {
        progressCueRef.current.twenty = true;
        void announcementController.interruptAndPlay("ptosis.progress20");
      }
      if (seconds >= 30) {
        stopStream();
        updatePhase("completed");
        setStatusText("終了です。保存して結果を記録できます。");
        void announcementController.interruptAndPlay("ptosis.done");
      }
    }

    if (runId !== runIdRef.current || !streamRef.current?.active) {
      return;
    }

    frameRef.current = requestAnimationFrame(() => {
      void tick(runId);
    });
  }, [beginMeasurement, stopStream, updatePhase]);

  const start = useCallback(async () => {
    if (phaseRef.current === "waiting" || phaseRef.current === "measuring") {
      return;
    }
    try {
      announcementController.enableAutoplay();
      resetMeasurement();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });
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
      setStatusText("頭を動かさずに、顔を枠に合わせてください。");
      void announcementController.interruptAndPlay("ptosis.intro");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to start ptosis assessment", error);
      setStatusText("カメラへのアクセスが許可されていません。設定を確認してください。");
      updatePhase("idle");
    }
  }, [resetMeasurement, tick, updatePhase]);

  const save = useCallback(async () => {
    stopStream();
    announcementController.stopCurrent();
    const data = seriesRef.current;
    if (!data.length) {
      updatePhase("idle");
      setStatusText("開始すると音声案内に合わせて顔位置を確認します。");
      return;
    }

    const avg =
      data.reduce(
        (acc, entry) => acc + ((entry.earLeft ?? 0) + (entry.earRight ?? 0)) / 2,
        0
      ) / data.length;
    const id = Date.now();
    await addSession({
      id,
      type: "ptosis",
      date: new Date().toISOString(),
      summaryScore: Number(avg.toFixed(4)),
      notes: `EAR平均 ${avg.toFixed(4)}`
    });
    await addTimeSeries({
      sessionId: id,
      frameData: data,
      details: {
        durationSec: elapsed
      }
    });
    updatePhase("idle");
    setStatusText("保存しました。再度検査することもできます。");
    resetMeasurement();
  }, [elapsed, resetMeasurement, stopStream, updatePhase]);

  const cancel = useCallback(() => {
    stopStream();
    announcementController.stopCurrent();
    resetMeasurement();
    updatePhase("idle");
    setStatusText("開始すると音声案内に合わせて顔位置を確認します。");
  }, [resetMeasurement, stopStream, updatePhase]);

  useEffect(() => {
    return () => {
      stopStream();
      announcementController.stopCurrent();
    };
  }, [stopStream]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    showOverlayRef.current = showOverlay;
    if (!showOverlay) {
      drawingUtilsRef.current = null;
    }
  }, [showOverlay]);

  const isRunning = phase === "waiting" || phase === "measuring";
  const overlayPrimary =
    phase === "measuring" ? (
      <span className="camera-overlay-countdown">{Math.max(0, 30 - elapsed)}</span>
    ) : (
      <span className="camera-overlay-hint">自動で開始</span>
    );
  const showIntroHeader = phase === "idle";
  const phaseTitle =
    phase === "idle"
      ? "待機中"
      : phase === "waiting"
        ? "位置合わせ"
        : phase === "measuring"
          ? "計測中"
          : "保存待ち";

  return (
    <Layout>
      {showIntroHeader ? (
        <section className="page-header">
          <h1>眼瞼下垂テスト</h1>
          <p>
            頭を動かさずに、目だけで天井を見てください。顔位置が整うと自動で30秒の計測が始まります。
          </p>
        </section>
      ) : null}

      <AssessmentAudioGuide
        announcementKey="pageIntro.ptosis"
        summary="この検査では、上を見続けたときのまぶたの下がりやすさを確認します。音声ガイドの音量を調整してから始められます。"
      />

      <section className="camera-panel ptosis-camera-panel">
        <div ref={frameElementRef} className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? (
            <canvas ref={canvasRef} className="camera-canvas" />
          ) : null}
          <div className="ptosis-phase-overlay">
            <div className="phase-banner">
              <strong>{phaseTitle}</strong>
              <span>{statusText}</span>
            </div>
          </div>
          <CameraOverlay
            tone={phase === "measuring" ? "active" : "guide"}
            topLabel=""
            centerPrimary={overlayPrimary}
          />
        </div>
        <div className="camera-sidebar ptosis-camera-sidebar">
          <div className="button-row ptosis-button-row">
            {phase === "idle" ? (
              <PrimaryButton onClick={start}>測定開始</PrimaryButton>
            ) : null}
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
              <span>経過時間</span>
              <strong>{elapsed}s</strong>
            </div>
            <div className="metric">
              <span>EAR 左</span>
              <strong>{earLeft.toFixed(3)}</strong>
            </div>
            <div className="metric">
              <span>EAR 右</span>
              <strong>{earRight.toFixed(3)}</strong>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
