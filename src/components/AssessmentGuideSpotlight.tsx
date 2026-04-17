import { useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";

type AssessmentType =
  | "ptosis"
  | "limbs"
  | "gait"
  | "posture"
  | "expression"
  | "voice"
  | "epro";

const typeLabels: Record<AssessmentType, string> = {
  ptosis: "眼瞼下垂",
  limbs: "上肢の筋力",
  gait: "歩行動作",
  posture: "姿勢の検査",
  expression: "表情の検査",
  voice: "音声の検査",
  epro: "症状の問診"
};

const assessmentSpotlights: Record<
  AssessmentType,
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
  posture: {
    title: "姿勢の検査",
    tagline: "正面と側面から、体幹の傾きと首下がりを短時間で確認します。",
    description:
      "正面では側方偏位、側面では体幹前屈角と首下がり角をそれぞれ5秒ずつ計測します。条件が整うとすぐに測定へ入り、日ごとの変化を見やすく残します。",
    tools: ["Pose Landmarker", "正面/側面ガイド", "背面カメラ"],
    checks: ["側方偏位", "体幹前屈角", "首下がり角"],
    accent: "linear-gradient(135deg, #7b5313 0%, #c58a1c 48%, #f4d07c 100%)",
    to: "/posture"
  },
  expression: {
    title: "表情の検査",
    tagline: "自然表情と笑顔を比べて、まばたきと表情変化を確認します。",
    description:
      "自然な顔のまま10秒、続いて笑顔を5秒記録し、瞬目の回数や笑顔の左右差を見ます。仮面様顔貌の傾向を簡易に把握できるようにします。",
    tools: ["Face Landmarker", "Blendshape", "フロントカメラ"],
    checks: ["瞬目回数", "笑顔強度", "左右対称性"],
    accent: "linear-gradient(135deg, #6a3658 0%, #c35b9c 48%, #f1b5d8 100%)",
    to: "/expression"
  },
  voice: {
    title: "音声の検査",
    tagline: "3つの発話タスクで、声量とピッチの変化を記録します。",
    description:
      "持続母音、数字カウント、定型文音読を順に録音し、音量やピッチの基本指標を残します。案内音声を待たずに録音へ進めるので、テンポよく計測できます。",
    tools: ["マイク録音", "Web Audio解析", "音声ガイド"],
    checks: ["録音時間", "平均音量", "平均ピッチ"],
    accent: "linear-gradient(135deg, #254a7b 0%, #4f78c5 48%, #a9c3ff 100%)",
    to: "/voice"
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

type AssessmentGuideSpotlightProps = {
  defaultSelected?: AssessmentType;
};

export default function AssessmentGuideSpotlight({
  defaultSelected = "posture"
}: AssessmentGuideSpotlightProps) {
  const [selectedSpotlight, setSelectedSpotlight] =
    useState<AssessmentType>(defaultSelected);
  const spotlight = assessmentSpotlights[selectedSpotlight];
  const spotlightAccentStyle = {
    "--spotlight-accent": spotlight.accent
  } as CSSProperties;

  return (
    <>
      <style>{`
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
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transform: translateX(-100%) skewX(-15deg);
          animation: shine 3s infinite;
        }
        .dashboard-primary-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px rgba(18, 120, 88, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.3);
          filter: brightness(1.1);
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
        @keyframes shine {
          0% {
            transform: translateX(-100%) skewX(-15deg);
          }
          50%, 100% {
            transform: translateX(200%) skewX(-15deg);
          }
        }
      `}</style>

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

          <div
            className="dashboard-spotlight-tabs"
            role="tablist"
            aria-label="検査ガイド"
          >
            {(Object.keys(assessmentSpotlights) as AssessmentType[]).map((key) => (
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
            <div className="dashboard-spotlight-copy" style={spotlightAccentStyle}>
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
              <div className="dashboard-spotlight-card" style={spotlightAccentStyle}>
                <h3>使うツール</h3>
                <div className="dashboard-spotlight-tags">
                  {spotlight.tools.map((tool) => (
                    <span key={tool} className="dashboard-spotlight-tag">
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              <div className="dashboard-spotlight-card" style={spotlightAccentStyle}>
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
    </>
  );
}
