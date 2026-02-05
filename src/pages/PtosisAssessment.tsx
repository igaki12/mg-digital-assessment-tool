import { useCallback, useEffect, useRef, useState } from "react";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { addSession, addTimeSeries } from "../storage/db";
import { extractEar, getFaceLandmarker } from "../mediapipe/face";
import type { TimeSeriesEntry } from "../types";

export default function PtosisAssessment() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seriesRef = useRef<TimeSeriesEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [earLeft, setEarLeft] = useState(0);
  const [earRight, setEarRight] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  const stopStream = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRunning(false);
  }, []);

  const tick = useCallback(async () => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const landmarker = await getFaceLandmarker();
    const now = performance.now();
    const result = landmarker.detectForVideo(video, now);
    const ear = extractEar(result);
    setEarLeft(ear.left);
    setEarRight(ear.right);

    const timestamp = Date.now();
    seriesRef.current.push({
      timestamp,
      earLeft: ear.left,
      earRight: ear.right
    });
    if (startTimeRef.current) {
      setElapsed(Math.floor((timestamp - startTimeRef.current) / 1000));
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

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
    setElapsed(0);
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
      data.reduce((acc, entry) => acc + ((entry.earLeft ?? 0) + (entry.earRight ?? 0)) / 2, 0) /
      data.length;
    const id = Date.now();
    await addSession({
      id,
      type: "ptosis",
      date: new Date().toISOString(),
      summaryScore: Number(avg.toFixed(4)),
      notes: "EAR平均"
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

  return (
    <Layout>
      <section className="page-header">
        <h1>眼瞼下垂テスト</h1>
        <p>
          頭を動かさずに、目だけで天井を見てください。そのまま30秒キープします。
        </p>
      </section>
      <section className="camera-panel">
        <div className="camera-frame">
          <video ref={videoRef} playsInline muted className="camera-video" />
          <div className="camera-overlay">
            <p>頭を固定して目線だけ上へ</p>
          </div>
        </div>
        <div className="camera-metrics">
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
          <div className="button-row">
            <PrimaryButton onClick={start} disabled={running}>
              測定開始
            </PrimaryButton>
            <button className="ghost-button" onClick={save}>
              停止して保存
            </button>
          </div>
        </div>
      </section>
    </Layout>
  );
}
