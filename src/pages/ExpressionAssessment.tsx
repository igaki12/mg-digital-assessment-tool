import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, FaceLandmarker } from "@mediapipe/tasks-vision";
import AssessmentAudioGuide from "../components/AssessmentAudioGuide";
import CameraOverlay from "../components/CameraOverlay";
import useIsCompactViewport from "../hooks/useIsCompactViewport";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { announcementController } from "../audio/controller";
import { playSignalBeep } from "../audio/beep";
import { syncOverlayCanvas } from "../mediapipe/canvas";
import {
  extractEar,
  extractSmileMetrics,
  getFaceLandmarker,
  isFaceCentered
} from "../mediapipe/face";
import { addSession, addTimeSeries } from "../storage/db";
import type { TimeSeriesEntry } from "../types";

type ExpressionPhase =
  | "idle"
  | "restWaiting"
  | "restHolding"
  | "smileWaiting"
  | "smileHolding"
  | "completed";

export default function ExpressionAssessment() {
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const holdStartedAtRef = useRef<number | null>(null);
  const readyFramesRef = useRef(0);
  const blinkCountRef = useRef(0);
  const blinkClosedRef = useRef(false);
  const runIdRef = useRef(0);
  const phaseRef = useRef<ExpressionPhase>("idle");
  const showOverlayRef = useRef(true);
  const [phase, setPhase] = useState<ExpressionPhase>("idle");
  const [showOverlay, setShowOverlay] = useState(true);
  const [statusText, setStatusText] = useState(
    "開始すると自然表情10秒、笑顔5秒の順で検査します。"
  );
  const [countdown, setCountdown] = useState(10);
  const [blinkCount, setBlinkCount] = useState(0);
  const [smileLeft, setSmileLeft] = useState(0);
  const [smileRight, setSmileRight] = useState(0);
  const [smileSymmetry, setSmileSymmetry] = useState(0);
  const isCompactViewport = useIsCompactViewport();
  const [completedSummary, setCompletedSummary] = useState<{
    blinkCount: number;
    blinkRatePerMin: number;
    smileAmplitude: number;
    smileSymmetry: number;
  } | null>(null);

  const updatePhase = useCallback((nextPhase: ExpressionPhase) => {
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
    holdStartedAtRef.current = null;
    readyFramesRef.current = 0;
    blinkCountRef.current = 0;
    blinkClosedRef.current = false;
    setBlinkCount(0);
    setSmileLeft(0);
    setSmileRight(0);
    setSmileSymmetry(0);
    setCountdown(10);
    setCompletedSummary(null);
  }, []);

  const startHold = useCallback(
    async (nextPhase: Extract<ExpressionPhase, "restHolding" | "smileHolding">) => {
      readyFramesRef.current = 0;
      announcementController.stopCurrent();
      await playSignalBeep();
      holdStartedAtRef.current = Date.now();
      updatePhase(nextPhase);
      if (nextPhase === "restHolding") {
        setCountdown(10);
        setStatusText("自然な顔のまま10秒間キープしてください。");
      } else {
        setCountdown(5);
        setStatusText("できるだけ大きな笑顔を5秒間キープしてください。");
      }
    },
    [updatePhase]
  );

  const finishMeasurement = useCallback(() => {
    stopStream();
    const smileFrames = seriesRef.current.filter(
      (entry) => entry.smileLeft !== undefined
    );
    const avg = (values: number[]) =>
      values.length === 0
        ? 0
        : values.reduce((sum, value) => sum + value, 0) / values.length;
    const smileAmplitude = avg(
      smileFrames.map(
        (entry) => ((entry.smileLeft ?? 0) + (entry.smileRight ?? 0)) / 2
      )
    );
    const symmetry = avg(smileFrames.map((entry) => entry.smileSymmetry ?? 0));
    const blinkRatePerMin = blinkCountRef.current * 6;
    setCompletedSummary({
      blinkCount: blinkCountRef.current,
      blinkRatePerMin,
      smileAmplitude,
      smileSymmetry: symmetry
    });
    updatePhase("completed");
    setStatusText("表情検査が終了しました。保存して結果を記録できます。");
    void announcementController.interruptAndPlay("expression.done");
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

      let result;
      try {
        result = landmarker.detectForVideo(video, performance.now());
      } catch (error) {
        if (runId !== runIdRef.current) {
          return;
        }
        console.warn("Skipping expression frame because the video is not ready", error);
        frameRef.current = requestAnimationFrame(() => {
          void tick(runId);
        });
        return;
      }

      if (runId !== runIdRef.current) {
        return;
      }

      const faceReady = isFaceCentered(result);
      const ear = extractEar(result);
      const smile = extractSmileMetrics(result);
      const avgEar = (ear.left + ear.right) / 2;

      setSmileLeft(smile.left);
      setSmileRight(smile.right);
      setSmileSymmetry(smile.symmetry);

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
        }
      } else if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }

      const currentPhase = phaseRef.current;
      if (currentPhase === "restWaiting") {
        if (!faceReady) {
          readyFramesRef.current = 0;
          setStatusText("顔が枠に入るよう、カメラとの距離を調整してください。");
          void announcementController.play("common.faceMissing", {
            cooldownMs: 4000
          });
        } else {
          readyFramesRef.current += 1;
          if (readyFramesRef.current >= 6) {
            await startHold("restHolding");
            if (runId !== runIdRef.current) {
              return;
            }
          }
        }
      } else if (currentPhase === "restHolding" && holdStartedAtRef.current) {
        const elapsedMs = Date.now() - holdStartedAtRef.current;
        setCountdown(Math.max(0, 10 - Math.floor(elapsedMs / 1000)));
        if (avgEar < 0.19) {
          blinkClosedRef.current = true;
        } else if (blinkClosedRef.current) {
          blinkClosedRef.current = false;
          blinkCountRef.current += 1;
          setBlinkCount(blinkCountRef.current);
        }
        seriesRef.current.push({
          timestamp: Date.now(),
          blinkCount: blinkCountRef.current,
          blinkRatePerMin: blinkCountRef.current * 6
        });
        if (elapsedMs >= 10000) {
          holdStartedAtRef.current = null;
          updatePhase("smileWaiting");
          setStatusText("できるだけ大きな笑顔を作ってください。");
          void announcementController.interruptAndPlay("expression.smile");
        }
      } else if (currentPhase === "smileWaiting") {
        if (!faceReady) {
          readyFramesRef.current = 0;
          setStatusText("顔が枠に入るよう、カメラとの距離を調整してください。");
          void announcementController.play("common.faceMissing", {
            cooldownMs: 4000
          });
        } else if (smile.amplitude < 0.25) {
          readyFramesRef.current = 0;
          setStatusText("口角を上げて歯を見せるように笑顔を作ってください。");
        } else {
          readyFramesRef.current += 1;
          if (readyFramesRef.current >= 4) {
            await startHold("smileHolding");
            if (runId !== runIdRef.current) {
              return;
            }
          }
        }
      } else if (currentPhase === "smileHolding" && holdStartedAtRef.current) {
        const elapsedMs = Date.now() - holdStartedAtRef.current;
        setCountdown(Math.max(0, 5 - Math.floor(elapsedMs / 1000)));
        seriesRef.current.push({
          timestamp: Date.now(),
          smileLeft: smile.left,
          smileRight: smile.right,
          smileSymmetry: smile.symmetry
        });
        if (elapsedMs >= 5000) {
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
    [finishMeasurement, startHold, updatePhase]
  );

  const start = useCallback(async () => {
    const currentPhase = phaseRef.current;
    if (
      currentPhase === "restWaiting" ||
      currentPhase === "restHolding" ||
      currentPhase === "smileWaiting" ||
      currentPhase === "smileHolding"
    ) {
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
      updatePhase("restWaiting");
      setStatusText("自然な顔でカメラを見てください。");
      void announcementController.interruptAndPlay("expression.rest");
      frameRef.current = requestAnimationFrame(() => {
        void tick(runId);
      });
    } catch (error) {
      console.warn("Unable to start expression assessment", error);
      setStatusText("カメラへのアクセスが許可されていません。設定を確認してください。");
      updatePhase("idle");
    }
  }, [resetMeasurement, tick, updatePhase]);

  const save = useCallback(async () => {
    const summary = completedSummary;
    if (!summary) {
      return;
    }
    const id = Date.now();
    await addSession({
      id,
      type: "expression",
      date: new Date().toISOString(),
      summaryScore: Number((summary.smileAmplitude * 100).toFixed(2)),
      notes: `瞬目 ${summary.blinkCount}回 / 笑顔対称性 ${(summary.smileSymmetry * 100).toFixed(0)}%`
    });
    await addTimeSeries({
      sessionId: id,
      frameData: seriesRef.current,
      details: summary
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
    setStatusText("開始すると自然表情10秒、笑顔5秒の順で検査します。");
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
    phase === "restWaiting" ||
    phase === "restHolding" ||
    phase === "smileWaiting" ||
    phase === "smileHolding";
  const phaseTitle =
    phase === "idle"
      ? "待機中"
      : phase === "restWaiting"
        ? "自然表情の位置合わせ"
        : phase === "restHolding"
          ? "自然表情を計測中"
          : phase === "smileWaiting"
            ? "笑顔の準備"
            : phase === "smileHolding"
              ? "笑顔を計測中"
              : "保存待ち";
  const overlayPrimary =
    phase === "restHolding" || phase === "smileHolding" ? (
      <span className="camera-overlay-countdown">{countdown}</span>
    ) : phase === "completed" ? (
      <span className="camera-overlay-hint">保存待ち</span>
    ) : (
      <span className="camera-overlay-hint">
        {phase === "smileWaiting" ? "笑顔を作ると開始" : "顔が入ると開始"}
      </span>
    );
  const overlaySecondary =
    phase === "completed"
      ? "結果を保存できます"
      : phase === "smileWaiting" || phase === "smileHolding"
        ? "笑顔の検査"
        : "自然な表情";
  const showIntroContent = isCompactViewport ? !isRunning : phase === "idle";

  return (
    <Layout>
      {showIntroContent ? (
        <section className="page-header">
          <h1>表情検査</h1>
          <p>仮面様顔貌と瞬目の傾向を見るために、自然表情10秒と笑顔5秒を順に記録します。</p>
        </section>
      ) : null}
      {showIntroContent ? (
        <AssessmentAudioGuide
          announcementKey="pageIntro.expression"
          summary="この検査では、自然な表情と笑顔を見て、表情の動きやまばたきの様子を確認します。音声ガイドの音量をここで調整できます。"
        />
      ) : null}

      <section className="camera-panel ptosis-camera-panel">
        <div ref={frameElementRef} className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? <canvas ref={canvasRef} className="camera-canvas" /> : null}
          <CameraOverlay
            tone={phase === "restHolding" || phase === "smileHolding" ? "active" : "guide"}
            topLabel={phaseTitle}
            topMessage={statusText}
            centerPrimary={overlayPrimary}
            centerSecondary={overlaySecondary}
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
              <span>瞬目回数</span>
              <strong>{blinkCount}回</strong>
            </div>
            <div className="metric">
              <span>笑顔 左右差</span>
              <strong>{(smileSymmetry * 100).toFixed(0)}%</strong>
            </div>
            <div className="metric">
              <span>笑顔強度</span>
              <strong>{(((smileLeft + smileRight) / 2) * 100).toFixed(0)}%</strong>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
