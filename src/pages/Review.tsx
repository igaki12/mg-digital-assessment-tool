import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getTimeSeries, getVideo, listSessions } from "../storage/db";
import type { SessionMeta, TimeSeriesRecord, VideoRecord } from "../types";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const typeLabels: Record<SessionMeta["type"], string> = {
  ptosis: "眼瞼下垂",
  limbs: "上肢の筋力",
  gait: "歩行動作",
  epro: "症状の問診"
};

export default function Review() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selected, setSelected] = useState<SessionMeta | null>(null);
  const [record, setRecord] = useState<TimeSeriesRecord | null>(null);
  const [video, setVideo] = useState<VideoRecord | null>(null);

  useEffect(() => {
    listSessions().then((data) =>
      setSessions(data.sort((a, b) => b.date.localeCompare(a.date)))
    );
  }, []);

  useEffect(() => {
    if (!selected) {
      setRecord(null);
      setVideo(null);
      return;
    }
    getTimeSeries(selected.id).then((data) => setRecord(data ?? null));
    getVideo(selected.id).then((data) => setVideo(data ?? null));
  }, [selected]);

  const videoUrl = useMemo(() => {
    if (!video) {
      return null;
    }
    return URL.createObjectURL(video.blob);
  }, [video]);

  useEffect(() => {
    if (!videoUrl) {
      return;
    }
    return () => URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  return (
    <Layout>
      <section className="page-header">
        <h1>医師レビュー</h1>
        <p>動画と数値データを並べて短時間で確認できます。</p>
      </section>

      <section className="review-grid">
        <div className="card">
          <h2>セッション選択</h2>
          <div className="list">
            {sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className={
                  selected?.id === session.id
                    ? "list-row active"
                    : "list-row"
                }
                onClick={() => setSelected(session)}
              >
                <div>
                  <p className="list-title">
                    {session.type.toUpperCase()} / {typeLabels[session.type]}
                  </p>
                  <p className="list-sub">{formatDate(session.date)}</p>
                </div>
                <span className="badge">{session.summaryScore.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>数値データ</h2>
          {!record ? (
            <p>セッションを選択すると時系列データが表示されます。</p>
          ) : (
            <div>
              <p className="detail-title">{selected?.notes ?? ""}</p>
              <pre className="detail-pre">
                {record.frameData.slice(0, 50).map((entry) => JSON.stringify(entry)).join("\n")}
              </pre>
            </div>
          )}
        </div>

        <div className="card">
          <h2>動画プレビュー</h2>
          {videoUrl ? (
            <video className="detail-video" src={videoUrl} controls />
          ) : (
            <p>動画が保存されていないセッションです。</p>
          )}
        </div>
      </section>
    </Layout>
  );
}
