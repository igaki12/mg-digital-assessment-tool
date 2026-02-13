import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { addSession, addTimeSeries } from "../storage/db";
import { extractArmAngles, getPoseLandmarker } from "../mediapipe/pose";
import type { TimeSeriesEntry } from "../types";

export default function LimbAssessment() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const drawingUtilsRef = useRef<DrawingUtils | null>(null);
  const [running, setRunning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
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
      const rect = video.getBoundingClientRect();
      if (rect.width && rect.height) {
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }
      if (video.videoWidth && video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
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
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }
    seriesRef.current = [];
    startTimeRef.current = Date.now();
    setDuration(0);
    setRunning(true);
    frameRef.current = requestAnimationFrame(tick);
  }, [running, tick]);

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
    return () => stopStream();
  }, [stopStream]);

  useEffect(() => {
    if (!showOverlay) {
      drawingUtilsRef.current = null;
    }
  }, [showOverlay]);

  return (
    <Layout>
      <section className="page-header">
        <h1>上肢挙上テスト</h1>
        <p>両腕を肩の高さまで上げ、そのまま枠内でキープしてください。</p>
      </section>
      <section className="camera-panel">
        <div className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? (
            <canvas ref={canvasRef} className="camera-canvas" />
          ) : null}
          <div className="camera-overlay">
            <p>腕が枠内に収まるように調整</p>
          </div>
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
          <div className="button-row">
            <PrimaryButton onClick={start} disabled={running}>
              測定開始
            </PrimaryButton>
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
          </div>
        </div>
      </section>
    </Layout>
  );
}
