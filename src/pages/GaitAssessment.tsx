import { useCallback, useEffect, useRef, useState } from "react";
import { DrawingUtils, PoseLandmarker } from "@mediapipe/tasks-vision";
import { announcementController } from "../audio/controller";
import AssessmentAudioGuide from "../components/AssessmentAudioGuide";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { addSession, addTimeSeries, addVideo } from "../storage/db";
import { syncOverlayCanvas } from "../mediapipe/canvas";
import {
  estimateBodyHeightPixels,
  extractHipCenter,
  extractKneeAngles,
  getPoseLandmarker
} from "../mediapipe/pose";
import { getUserHeight } from "../storage/settings";
import type { TimeSeriesEntry } from "../types";

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
  const [running, setRunning] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [speed, setSpeed] = useState(0);
  const [leftKnee, setLeftKnee] = useState(0);
  const [rightKnee, setRightKnee] = useState(0);

  const stopStream = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    recorderRef.current?.stop();
    recorderRef.current = null;
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

    const knee = extractKneeAngles(result);
    setLeftKnee(knee.left);
    setRightKnee(knee.right);

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

    const hip = extractHipCenter(result);
    const heightNorm = estimateBodyHeightPixels(result);
    const timestamp = Date.now();
    let computedSpeed = 0;
    if (hip && heightNorm && video.videoHeight) {
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
          setSpeed(computedSpeed);
        }
      }
      lastHipRef.current = { x: hip.x, y: hip.y, time: timestamp };
    }

    seriesRef.current.push({
      timestamp,
      gaitSpeed: computedSpeed,
      kneeLeftDeg: knee.left,
      kneeRightDeg: knee.right
    });

    frameRef.current = requestAnimationFrame(tick);
  }, [showOverlay]);

  const start = useCallback(async () => {
    if (running) {
      return;
    }
    announcementController.stopCurrent();
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: false
    });
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
    chunksRef.current = [];
    lastHipRef.current = null;
    seriesRef.current = [];

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
    }

    setRunning(true);
    frameRef.current = requestAnimationFrame(tick);
  }, [running, tick]);

  const save = useCallback(async () => {
    stopStream();
    const data = seriesRef.current;
    if (!data.length) {
      return;
    }
    const avgSpeed =
      data.reduce((acc, entry) => acc + (entry.gaitSpeed ?? 0), 0) /
      data.length;
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
    chunksRef.current = [];
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
        <h1>歩行監視モード</h1>
        <p>カメラの前に立つと録画が始まります。いつも通り歩いてください。</p>
      </section>
      <AssessmentAudioGuide
        announcementKey="pageIntro.gait"
        summary="この検査では、歩く速さや膝の動き、姿勢の傾きを確認します。音声ガイドを聞いてから、いつも通り歩いてください。"
      />
      <section className="camera-panel">
        <div ref={frameElementRef} className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          {showOverlay ? (
            <canvas ref={canvasRef} className="camera-canvas" />
          ) : null}
          <div className="camera-overlay">
            <p>全身が映る位置にカメラを固定</p>
          </div>
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
              <PrimaryButton onClick={start}>監視開始</PrimaryButton>
            )}
          </div>
          <div className="camera-metrics">
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
