import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { getAudio, getTimeSeries, getVideo, listSessions } from "../storage/db";
import type { AudioRecord, SessionMeta, TimeSeriesRecord, VideoRecord } from "../types";

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
  posture: "姿勢の検査",
  expression: "表情の検査",
  voice: "音声の検査",
  epro: "症状の問診"
};

function createCsv(record: TimeSeriesRecord) {
  if (record.frameData.length === 0 && record.details) {
    return JSON.stringify(record.details, null, 2);
  }
  const headers = new Set<string>();
  record.frameData.forEach((entry) => {
    Object.keys(entry).forEach((key) => headers.add(key));
  });
  const columns = Array.from(headers);
  const rows = [columns.join(",")];
  record.frameData.forEach((entry) => {
    rows.push(columns.map((col) => String(entry[col as keyof typeof entry] ?? "")).join(","));
  });
  return rows.join("\n");
}

export default function Records() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selected, setSelected] = useState<SessionMeta | null>(null);
  const [record, setRecord] = useState<TimeSeriesRecord | null>(null);
  const [video, setVideo] = useState<VideoRecord | null>(null);
  const [audio, setAudio] = useState<AudioRecord | null>(null);

  useEffect(() => {
    listSessions().then((data) =>
      setSessions(data.sort((a, b) => b.date.localeCompare(a.date)))
    );
  }, []);

  useEffect(() => {
    if (!selected) {
      setRecord(null);
      setVideo(null);
      setAudio(null);
      return;
    }
    getTimeSeries(selected.id).then((data) => setRecord(data ?? null));
    getVideo(selected.id).then((data) => setVideo(data ?? null));
    getAudio(selected.id).then((data) => setAudio(data ?? null));
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

  const audioUrls = useMemo(() => {
    if (!audio) {
      return [];
    }
    return audio.clips.map((clip) => ({
      ...clip,
      url: URL.createObjectURL(clip.blob)
    }));
  }, [audio]);

  useEffect(() => {
    return () => {
      audioUrls.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
  }, [audioUrls]);

  return (
    <Layout>
      <section className="page-header">
        <h1>記録を見る</h1>
        <p>測定履歴と簡易グラフ、動画を確認できます。</p>
      </section>

      <section className="records-grid">
        <div className="card">
          <h2>セッション一覧</h2>
          {sessions.length === 0 ? (
            <p>まだ記録がありません。</p>
          ) : (
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
          )}
        </div>

        <div className="card">
          <h2>詳細</h2>
          {!selected ? (
            <p>左の一覧から記録を選択してください。</p>
          ) : (
            <div className="detail">
              <p className="detail-title">
                {selected.type.toUpperCase()} | {formatDate(selected.date)}
              </p>
              <p className="detail-note">{selected.notes ?? ""}</p>
              {record ? (
                <pre className="detail-pre">{createCsv(record)}</pre>
              ) : (
                <p>詳細データがありません。</p>
              )}
              {videoUrl ? (
                <video className="detail-video" src={videoUrl} controls />
              ) : null}
              {audioUrls.length > 0 ? (
                <div className="voice-clip-list">
                  {audioUrls.map((clip) => (
                    <div key={clip.taskId} className="card voice-clip-card">
                      <h3>{clip.label}</h3>
                      <audio className="voice-preview" src={clip.url} controls />
                      <p>
                        録音時間 {clip.metrics.durationSec.toFixed(1)}s / 平均音量{" "}
                        {clip.metrics.meanRms.toFixed(3)} / 平均ピッチ{" "}
                        {clip.metrics.pitchMeanHz.toFixed(1)}Hz
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}
