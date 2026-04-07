import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
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

const typeLabels: Record<SessionMeta["type"], string> = {
  ptosis: "眼瞼下垂",
  limbs: "上肢の筋力",
  gait: "歩行動作",
  epro: "症状の問診"
};

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
      <style>{`
        .dashboard-hero-container {
          position: relative;
          border-radius: 24px;
          overflow: hidden;
          margin-bottom: 3rem;
          box-shadow: 0 30px 60px rgba(0,0,0,0.3);
          background: #0a0a0a;
        }
        .dashboard-hero-bg {
          position: absolute;
          inset: 0;
          background-image: url('${import.meta.env.BASE_URL}background-top.jpg');
          background-size: cover;
          background-position: center;
          opacity: 0.4;
          animation: pan-bg 25s linear infinite alternate;
        }
        .dashboard-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(8, 12, 16, 0.95) 0%, rgba(16, 42, 43, 0.75) 100%);
        }
        @keyframes pan-bg {
          0% { transform: scale(1.0) translate(0, 0); }
          100% { transform: scale(1.1) translate(-2%, 2%); }
        }
        .dashboard-hero-content {
          position: relative;
          padding: 5rem 4rem;
          display: grid;
          grid-template-columns: 1fr;
          gap: 4rem;
          align-items: center;
          z-index: 1;
        }
        @media (min-width: 900px) {
          .dashboard-hero-content {
            grid-template-columns: 1.2fr 0.8fr;
          }
        }
        .dashboard-hero-content h1,
        .dashboard-hero-content h2,
        .dashboard-hero-content h3,
        .dashboard-hero-content p {
          color: #ffffff;
        }
        .dashboard-hero-content h1 {
          font-size: clamp(2.2rem, 3.5vw, 3.2rem);
          line-height: 1.3;
          margin-bottom: 1.2rem;
          letter-spacing: -0.02em;
        }
        .dashboard-hero-content .eyebrow {
          color: #7fd6aa;
          text-shadow: 0 0 20px rgba(127, 214, 170, 0.4);
          font-weight: 700;
          letter-spacing: 0.1em;
          margin-bottom: 1rem;
          display: inline-block;
          background: rgba(127, 214, 170, 0.1);
          padding: 0.4rem 1rem;
          border-radius: 999px;
          border: 1px solid rgba(127, 214, 170, 0.2);
        }
        .dashboard-hero-content .hero-copy {
          font-size: 1.15rem;
          color: rgba(255, 255, 255, 0.8);
          line-height: 1.7;
          max-width: 90%;
        }
        .dashboard-hero-actions {
          display: flex;
          gap: 1.2rem;
          flex-wrap: wrap;
          margin-top: 2.5rem;
        }
        .dashboard-hero-panel {
          display: grid;
          gap: 1.5rem;
        }
        
        /* Premium Buttons */
        .dashboard-primary-button {
          position: relative;
          background: linear-gradient(135deg, #0e6f57 0%, #1f9f72 50%, #2c9c9a 100%);
          color: white !important;
          text-decoration: none;
          padding: 0.9rem 2rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 1.05rem;
          box-shadow: 0 10px 24px rgba(18, 120, 88, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2);
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .dashboard-primary-button::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-100%) skewX(-15deg);
          animation: shine 3s infinite;
        }
        @keyframes shine {
          0% { transform: translateX(-100%) skewX(-15deg); }
          50%, 100% { transform: translateX(200%) skewX(-15deg); }
        }
        .dashboard-primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(18, 120, 88, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          filter: brightness(1.1);
        }
        .dashboard-ghost-button {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          color: #ffffff !important;
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.9rem 2rem;
          border-radius: 999px;
          font-weight: 600;
          font-size: 1.05rem;
          text-decoration: none;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .dashboard-ghost-button:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: #7fd6aa;
          color: #7fd6aa !important;
          box-shadow: 0 0 20px rgba(127, 214, 170, 0.2);
          transform: translateY(-2px);
        }

        /* Glassmorphism Stat Cards */
        .dashboard-stat-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 1.8rem;
          transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.4s ease, border-color 0.4s ease;
          position: relative;
          overflow: hidden;
        }
        .dashboard-stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
        }
        .dashboard-stat-card:hover {
          transform: translateY(-6px) scale(1.02);
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(127, 214, 170, 0.3);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        .dashboard-stat-title {
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6) !important;
          margin-bottom: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dashboard-stat-value {
          font-size: 2.4rem;
          font-weight: 700;
          color: #ffffff;
          margin-bottom: 0.4rem;
          background: linear-gradient(to right, #ffffff, #b7ece1);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-family: inherit;
        }
        .dashboard-stat-note {
          font-size: 0.85rem;
          color: rgba(127, 214, 170, 0.8) !important;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        /* Staggered Animations */
        .fade-in-up {
          opacity: 0;
          transform: translateY(30px);
          animation: fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        .delay-4 { animation-delay: 0.4s; }
        .delay-5 { animation-delay: 0.5s; }

        @keyframes fadeInUp {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Enhancing original cards visually without breaking styles */
        .dashboard-card {
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          border-top: 4px solid transparent;
        }
        .dashboard-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(16, 42, 43, 0.1), 0 0 0 1px rgba(127, 214, 170, 0.2);
          border-top-color: var(--accent);
        }
      `}</style>
      
      <section className="dashboard-hero-container fade-in-up">
        <div className="dashboard-hero-bg"></div>
        <div className="dashboard-hero-overlay"></div>
        
        <div className="dashboard-hero-content">
          <div className="fade-in-up delay-1">
            <p className="eyebrow">MG Digital Assessment Tool</p>
            <h1>毎日の変化を、<br/>可視化して管理する</h1>
            <p className="hero-copy">
              眼瞼下垂・上肢・歩行・問診の結果を、端末内で安全に記録します。<br/>
              より良い治療方針の決定をサポートする、次世代の評価ツールです。
            </p>
            <div className="dashboard-hero-actions">
              <Link className="dashboard-primary-button" to="/assessments">
                検査を始める
              </Link>
              <Link className="dashboard-ghost-button" to="/records">
                記録を見る
              </Link>
            </div>
          </div>
          
          <div className="dashboard-hero-panel fade-in-up delay-2">
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-title">最近の記録</div>
              <div className="dashboard-stat-value">{summary.count} <span style={{fontSize: "1.2rem", fontWeight: 400, WebkitTextFillColor: "#fff"}}>回</span></div>
              <div className="dashboard-stat-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                最新: {summary.latest}
              </div>
            </div>
            <div className="dashboard-stat-card">
              <div className="dashboard-stat-title">平均スコア</div>
              <div className="dashboard-stat-value">{summary.avg}</div>
              <div className="dashboard-stat-note">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>
                直近全体
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-3">
        <div className="card dashboard-card fade-in-up delay-3">
          <h2>検査メニュー</h2>
          <p>眼・腕・歩行・問診を順番に確認できます。</p>
          <Link className="text-link" to="/assessments">
            メニューへ
          </Link>
        </div>
        <div className="card dashboard-card fade-in-up delay-4">
          <h2>記録の推移</h2>
          <p>時系列グラフや動画を確認できます。</p>
          <Link className="text-link" to="/records">
            記録を見る
          </Link>
        </div>
        <div className="card dashboard-card fade-in-up delay-5">
          <h2>医師レビュー</h2>
          <p>動画と数値を同期表示し、短時間で確認できます。</p>
          <Link className="text-link" to="/review">
            レビュー画面
          </Link>
        </div>
      </section>

      <section className="card dashboard-card fade-in-up delay-5" style={{ marginTop: "1.2rem" }}>
        <h2>最新の記録</h2>
        {recent.length === 0 ? (
          <p>まだ記録がありません。最初の検査を開始してください。</p>
        ) : (
          <div className="list">
            {recent.map((session) => (
              <div key={session.id} className="list-row">
                <div>
                  <p className="list-title">
                    {session.type.toUpperCase()} / {typeLabels[session.type]}
                  </p>
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
