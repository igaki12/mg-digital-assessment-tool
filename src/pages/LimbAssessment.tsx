import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { announcementController } from "../audio/controller";
import AssessmentAudioGuide from "../components/AssessmentAudioGuide";
import CameraOverlay, { type CameraFacingMode } from "../components/CameraOverlay";
import useIsCompactViewport from "../hooks/useIsCompactViewport";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { syncOverlayCanvas } from "../mediapipe/canvas";
import { addSession, addTimeSeries } from "../storage/db";
import { extractArmAngles, getPoseLandmarker } from "../mediapipe/pose";
import type { TimeSeriesEntry } from "../types";
import { getNextCameraFacingMode, openCameraStream } from "../utils/camera";

export default function LimbAssessment() {
  const frameElementRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const [running, setRunning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [cameraFacingMode, setCameraFacingMode] =
    useState<CameraFacingMode>("user");
  const isCompactViewport = useIsCompactViewport();
  const [leftAngle, setLeftAngle] = useState(0);
  const [rightAngle, setRightAngle] = useState(0);
  const [duration, setDuration] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
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
    setRunning(false);
  }, []);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const landmarker = await getPoseLandmarker();
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    const angles = extractArmAngles(result);
    setLeftAngle(angles.left);
    setRightAngle(angles.right);

    if (canvas && ctx && showOverlay && result.landmarks?.length) {
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

    const timestamp = Date.now();
    seriesRef.current.push({
      timestamp,
      armLeftDeg: angles.left,
      armRightDeg: angles.right
    });
    if (startTimeRef.current) {
      setDuration(Math.floor((timestamp - startTimeRef.current) / 1000));
    }
    frameRef.current = requestAnimationFrame(tick);
  }, [showOverlay]);

  const start = useCallback(async () => {
    if (running) {
      return;
    }
    announcementController.enableAutoplay();
    announcementController.stopCurrent();
    const stream = await openCameraStream(cameraFacingMode);
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
    seriesRef.current = [];
    startTimeRef.current = Date.now();
    setDuration(0);
    setRunning(true);
    void (async () => {
      const completed = await announcementController.interruptAndPlay("limbs.start");
      if (completed) {
        await announcementController.play("limbs.positioning");
      }
    })();
    frameRef.current = requestAnimationFrame(tick);
  }, [cameraFacingMode, running, tick]);

  const switchCamera = useCallback(() => {
    if (running) {
      return;
    }
    setCameraFacingMode((current) => getNextCameraFacingMode(current));
  }, [running]);

  const save = useCallback(async () => {
    stopStream();
    const data = seriesRef.current;
    if (!data.length) {
      return;
    }
    const avg =
      data.reduce((acc, entry) => acc + ((entry.armLeftDeg ?? 0) + (entry.armRightDeg ?? 0)) / 2, 0) /
      data.length;
    const id = Date.now();
    await addSession({
      id,
      type: "limbs",
      date: new Date().toISOString(),
      summaryScore: Number(avg.toFixed(2)),
      notes: "肩の角度平均"
    });
    await addTimeSeries({
      sessionId: id,
      frameData: data
    });
    seriesRef.current = [];
  }, [stopStream]);

  useEffect(() => {
    return () => {
      stopStream();
      announcementController.stopCurrent();
    };
  }, [stopStream]);

  useEffect(() => {
    if (!showOverlay) {
      drawingUtilsRef.current = null;
    }
  }, [showOverlay]);

  const showIntroContent = !isCompactViewport || !running;

  return (
    <Layout>
      {showIntroContent ? (
        <section className="page-header">
          <h1>上肢挙上テスト</h1>
          <p>両腕を肩の高さまで上げ、そのまま枠内でキープしてください。</p>
        </section>
      ) : null}
      {showIntroContent ? (
        <AssessmentAudioGuide
          announcementKey="pageIntro.limbs"
          summary="この検査では、両腕を上げた姿勢をどのくらい保てるかを確認します。腕の上がり方や途中で下がらないかを見ます。"
        />
      ) : null}
      <section className="camera-panel">
        <div ref={frameElementRef} className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? (
            <canvas ref={canvasRef} className="camera-canvas" />
          ) : null}
          <CameraOverlay
            topLabel={running ? "計測中" : "待機中"}
            topMessage="腕が枠内に収まるように調整"
            centerPrimary={<span className="camera-overlay-hint">肩の高さでキープ</span>}
            cameraFacingMode={cameraFacingMode}
            onSwitchCamera={switchCamera}
            isCameraSwitchDisabled={running}
          />
        </div>
        <div className="camera-sidebar">
          <div className="button-row">
            {running ? (
              <>
                <button className="ghost-button" onClick={save}>
                  停止して保存
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowOverlay((prev) => !prev)}
                >
                  {showOverlay ? "推定表示をOFF" : "推定表示をON"}
                </button>
              </>
            ) : (
              <PrimaryButton onClick={start}>測定開始</PrimaryButton>
            )}
          </div>
          <div className="camera-metrics">
            <div className="metric">
              <span>経過時間</span>
              <strong>{duration}s</strong>
            </div>
            <div className="metric">
              <span>左腕角度</span>
              <strong>{leftAngle.toFixed(1)}°</strong>
            </div>
            <div className="metric">
              <span>右腕角度</span>
              <strong>{rightAngle.toFixed(1)}°</strong>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
