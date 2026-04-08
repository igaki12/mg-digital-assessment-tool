import { useEffect, useMemo, useState, type CSSProperties } from "react";
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

const assessmentSpotlights: Record<
  SessionMeta["type"],
  {
    title: string;
    tagline: string;
    description: string;
    tools: string[];
    checks: string[];
    accent: string;
    to: string;
  }
> = {
  ptosis: {
    title: "眼瞼下垂テスト",
    tagline: "視線を上に向けたまま、まぶたの疲労を追跡します。",
    description:
      "上方視を維持している間のまぶたの開き方を連続計測し、左右差と時間経過による低下を見ます。短時間の動画でも、疲労の出方を数値で追えるようにします。",
    tools: ["Face Landmarker", "EAR算出", "フロントカメラ"],
    checks: ["まぶたの開き具合", "左右の差", "時間経過による低下"],
    accent: "linear-gradient(135deg, #0d5f6b 0%, #1a8b95 45%, #8be2ea 100%)",
    to: "/ptosis"
  },
  limbs: {
    title: "上肢挙上テスト",
    tagline: "両腕を保てるかを、角度の変化として可視化します。",
    description:
      "肩から肘、手首のランドマークをもとに腕の角度を継続計測し、保持時間や落ち込み始める瞬間を確認します。見た目だけでなく、数値の推移でも腕の負荷を比較できます。",
    tools: ["Pose Landmarker", "肩関節角度計算", "フロントカメラ"],
    checks: ["腕の保持角度", "左右差", "維持時間と低下タイミング"],
    accent: "linear-gradient(135deg, #0f6b55 0%, #1fa06f 48%, #9be0b8 100%)",
    to: "/limbs"
  },
  gait: {
    title: "歩行監視モード",
    tagline: "歩行速度と膝角度を、自然な動きの中で解析します。",
    description:
      "全身が映る固定カメラ映像から、骨格の移動量と下肢関節の角度を継続的に推定します。歩く速さ、膝の曲がり方、姿勢変化を同じ時系列で確認できます。",
    tools: ["Pose Landmarker", "歩行速度推定", "環境カメラ / 背面カメラ"],
    checks: ["推定歩行速度", "膝関節の曲がり", "姿勢と移動の安定性"],
    accent: "linear-gradient(135deg, #124a78 0%, #1f7ec8 46%, #95d5ff 100%)",
    to: "/gait"
  },
  epro: {
    title: "症状の問診",
    tagline: "日常生活への影響を、患者さんの言葉で残します。",
    description:
      "MG-ADL と QOL 相当の質問票を通じて、会話、嚥下、呼吸、見え方、生活への負担を記録します。動画で見えない症状変化も、診療時に一緒に確認できる形へ整理します。",
    tools: ["ePRO質問票", "MG-ADL相当項目", "QOL相当項目"],
    checks: ["生活動作への影響", "主観的なつらさ", "前回との変化"],
    accent: "linear-gradient(135deg, #6c4a11 0%, #b9851f 48%, #f3d88a 100%)",
    to: "/questionnaire"
  }
};

export default function Dashboard() {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [selectedSpotlight, setSelectedSpotlight] =
    useState<SessionMeta["type"]>("gait");

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
  const spotlight = assessmentSpotlights[selectedSpotlight];
  const spotlightAccentStyle = {
    "--spotlight-accent": spotlight.accent
  } as CSSProperties;

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
          background-position: 72% center;
          transform-origin: 72% center;
          opacity: 0.4;
          animation: pan-bg 25s linear infinite alternate;
        }
        @media (max-width: 640px) {
          .dashboard-hero-bg {
            background-position: 70% center;
            transform-origin: 70% center;
          }
        }
        .dashboard-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(8, 12, 16, 0.3) 0%, rgba(16, 42, 43, 0.75) 100%);
        }
        @keyframes pan-bg {
          0% { transform: scale(1.0) translateY(0); }
          100% { transform: scale(1.08) translateY(2%); }
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
        @media (max-width: 640px) {
          .dashboard-hero-content {
            padding: 3rem 1.4rem;
            gap: 2rem;
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

        .dashboard-spotlight {
          position: relative;
          overflow: hidden;
          margin-top: 1.2rem;
          border-radius: 28px;
          padding: 0;
          background:
            radial-gradient(circle at top left, rgba(255, 255, 255, 0.2), transparent 36%),
            linear-gradient(145deg, #07221f 0%, #0b3634 42%, #0d252f 100%);
          color: #ffffff;
          box-shadow: 0 30px 60px rgba(7, 33, 31, 0.22);
        }
        .dashboard-spotlight::before,
        .dashboard-spotlight::after {
          content: "";
          position: absolute;
          inset: auto;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(10px);
        }
        .dashboard-spotlight::before {
          width: 280px;
          height: 280px;
          top: -90px;
          right: -70px;
          background: rgba(127, 214, 170, 0.18);
          animation: dashboardFloat 8s ease-in-out infinite;
        }
        .dashboard-spotlight::after {
          width: 220px;
          height: 220px;
          bottom: -110px;
          left: -70px;
          background: rgba(149, 213, 255, 0.12);
          animation: dashboardFloat 10s ease-in-out infinite reverse;
        }
        .dashboard-spotlight-inner {
          position: relative;
          z-index: 1;
          padding: 2rem;
          display: grid;
          gap: 1.6rem;
        }
        .dashboard-spotlight-tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .dashboard-spotlight-tab {
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.88);
          border-radius: 999px;
          padding: 0.65rem 1rem;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.25s ease, background 0.25s ease, border-color 0.25s ease;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        .dashboard-spotlight-tab:hover {
          transform: translateY(-2px);
          border-color: rgba(255, 255, 255, 0.28);
          background: rgba(255, 255, 255, 0.1);
        }
        .dashboard-spotlight-tab.active {
          color: #05211e;
          background: linear-gradient(135deg, #d5fff0 0%, #9ce7c3 100%);
          border-color: transparent;
          box-shadow: 0 12px 24px rgba(127, 214, 170, 0.28);
        }
        .dashboard-spotlight-panel {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 1.4rem;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .dashboard-spotlight-panel {
            grid-template-columns: 1fr;
          }
        }
        .dashboard-spotlight-copy {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 1.8rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .dashboard-spotlight-copy::after {
          content: "";
          position: absolute;
          inset: auto -15% -55% -15%;
          height: 180px;
          background: rgba(255, 255, 255, 0.12);
          opacity: 0.55;
          border-radius: 50%;
          animation: dashboardWave 6.5s ease-in-out infinite;
        }
        .dashboard-spotlight-kicker {
          display: inline-flex;
          margin-bottom: 1rem;
          padding: 0.4rem 0.8rem;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.14);
          font-size: 0.82rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.82);
        }
        .dashboard-spotlight-copy h2,
        .dashboard-spotlight-copy p {
          color: #ffffff;
          position: relative;
          z-index: 1;
        }
        .dashboard-spotlight-copy p {
          color: rgba(255, 255, 255, 0.82);
        }
        .dashboard-spotlight-lead {
          font-size: 1.12rem;
          line-height: 1.8;
          margin-bottom: 1.3rem;
        }
        .dashboard-spotlight-cta {
          display: inline-flex;
          position: relative;
          z-index: 1;
          margin-top: 0.4rem;
        }
        .dashboard-spotlight-side {
          display: grid;
          gap: 1rem;
        }
        .dashboard-spotlight-card {
          position: relative;
          overflow: hidden;
          border-radius: 24px;
          padding: 1.35rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .dashboard-spotlight-card h3,
        .dashboard-spotlight-card p {
          color: #ffffff;
        }
        .dashboard-spotlight-card p {
          color: rgba(255, 255, 255, 0.82);
          font-size: 0.95rem;
        }
        .dashboard-spotlight-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: var(--spotlight-accent, linear-gradient(135deg, #0d5f6b 0%, #1a8b95 45%, #8be2ea 100%));
          opacity: 0.16;
          pointer-events: none;
        }
        .dashboard-spotlight-tags,
        .dashboard-spotlight-points {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }
        .dashboard-spotlight-tag,
        .dashboard-spotlight-point {
          border-radius: 999px;
          padding: 0.5rem 0.8rem;
          font-size: 0.88rem;
          border: 1px solid rgba(255, 255, 255, 0.16);
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }
        @keyframes dashboardWave {
          0%, 100% {
            transform: translate3d(-2%, 22%, 0) scaleX(1);
          }
          50% {
            transform: translate3d(4%, 8%, 0) scaleX(1.12);
          }
        }
        @keyframes dashboardFloat {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(16px);
          }
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

      <section className="dashboard-spotlight fade-in-up delay-5">
        <div className="dashboard-spotlight-inner">
          <div>
            <p className="eyebrow" style={{ color: "#9ce7c3" }}>
              Assessment Guide
            </p>
            <h2 style={{ color: "#ffffff", marginBottom: "0.6rem" }}>
              検査内容を、選んで確認する
            </h2>
            <p style={{ color: "rgba(255,255,255,0.76)", marginBottom: 0 }}>
              各検査で見ている動きと、解析に使うツールをまとめています。
            </p>
          </div>

          <div className="dashboard-spotlight-tabs" role="tablist" aria-label="検査ガイド">
            {(
              Object.keys(assessmentSpotlights) as SessionMeta["type"][]
            ).map((key) => (
              <button
                key={key}
                type="button"
                className={`dashboard-spotlight-tab${
                  selectedSpotlight === key ? " active" : ""
                }`}
                onClick={() => setSelectedSpotlight(key)}
              >
                {typeLabels[key]}
              </button>
            ))}
          </div>

          <div className="dashboard-spotlight-panel">
            <div
              className="dashboard-spotlight-copy"
              style={spotlightAccentStyle}
            >
              <span className="dashboard-spotlight-kicker">Selected Assessment</span>
              <h2>{spotlight.title}</h2>
              <p className="dashboard-spotlight-lead">{spotlight.tagline}</p>
              <p>{spotlight.description}</p>
              <Link
                className="dashboard-primary-button dashboard-spotlight-cta"
                to={spotlight.to}
              >
                この検査を開く
              </Link>
            </div>

            <div className="dashboard-spotlight-side">
              <div
                className="dashboard-spotlight-card"
                style={spotlightAccentStyle}
              >
                <h3>使うツール</h3>
                <div className="dashboard-spotlight-tags">
                  {spotlight.tools.map((tool) => (
                    <span key={tool} className="dashboard-spotlight-tag">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="dashboard-spotlight-card"
                style={spotlightAccentStyle}
              >
                <h3>見ているポイント</h3>
                <div className="dashboard-spotlight-points">
                  {spotlight.checks.map((check) => (
                    <span key={check} className="dashboard-spotlight-point">
                      {check}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
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
