import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StatCard from "../components/StatCard";
import { listSessions } from "../storage/db";
import type { SessionMeta } from "../types";

function formatDate(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);

  useEffect(() => {
    listSessions().then((data) =>
      setSessions(data.sort((a, b) => b.date.localeCompare(a.date)))
    );
  }, []);

  const recent = sessions.slice(0, 3);
  const summary = useMemo(() => {
    if (!sessions.length) {
      return { count: 0, latest: "-", avg: "-" };
    }
    const avg =
      sessions.reduce((acc, session) => acc + session.summaryScore, 0) /
      sessions.length;
    const latestSession = sessions[0];
    return {
      count: sessions.length,
      latest: latestSession ? formatDate(latestSession.date) : "-",
      avg: avg.toFixed(2)
    };
  }, [sessions]);

  return (
    <Layout>
      <section className="hero">
        <div>
          <p className="eyebrow">MG Digital Assessment Tool</p>
          <h1>毎日の変化を、可視化して管理する</h1>
          <p className="hero-copy">
            眼瞼下垂・上肢・歩行・問診の結果を、端末内で安全に記録します。
          </p>
          <div className="hero-actions">
            <Link className="primary-button" to="/assessments">
              検査を始める
            </Link>
            <Link className="ghost-button" to="/records">
              記録を見る
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <StatCard
            title="最近の記録"
            value={`${summary.count} 回`}
            note={`最新: ${summary.latest}`}
          />
          <StatCard title="平均スコア" value={summary.avg} note="直近全体" />
        </div>
      </section>

      <section className="grid-3">
        <div className="card">
          <h2>検査メニュー</h2>
          <p>眼・腕・歩行・問診を順番に確認できます。</p>
          <Link className="text-link" to="/assessments">
            メニューへ
          </Link>
        </div>
        <div className="card">
          <h2>記録の推移</h2>
          <p>時系列グラフや動画を確認できます。</p>
          <Link className="text-link" to="/records">
            記録を見る
          </Link>
        </div>
        <div className="card">
          <h2>医師レビュー</h2>
          <p>動画と数値を同期表示し、短時間で確認できます。</p>
          <Link className="text-link" to="/review">
            レビュー画面
          </Link>
        </div>
      </section>

      <section className="card">
        <h2>最新の記録</h2>
        {recent.length === 0 ? (
          <p>まだ記録がありません。最初の検査を開始してください。</p>
        ) : (
          <div className="list">
            {recent.map((session) => (
              <div key={session.id} className="list-row">
                <div>
                  <p className="list-title">{session.type.toUpperCase()}</p>
                  <p className="list-sub">{formatDate(session.date)}</p>
                </div>
                <span className="badge">{session.summaryScore.toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </Layout>
  );
}
