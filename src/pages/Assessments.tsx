import { Link } from "react-router-dom";
import Layout from "../components/Layout";

const cards = [
  {
    to: "/ptosis",
    title: "眼の検査（Ptosis）",
    description:
      "頭を動かさずに目だけで天井を見てください。そのまま30秒キープします。"
  },
  {
    to: "/limbs",
    title: "腕の検査（Upper Limb）",
    description: "両腕を肩の高さに上げ、枠内でキープしてください。"
  },
  {
    to: "/gait",
    title: "歩行監視モード（Gait Monitor）",
    description:
      "カメラの前に立つと録画が始まります。いつも通り歩いてください。"
  },
  {
    to: "/questionnaire",
    title: "問診票（MG-ADL / MG-QOL）",
    description: "生活のしづらさや気持ちの影響を簡単に記録できます。"
  }
];

export default function Assessments() {
  return (
    <Layout>
      <section className="page-header">
        <h1>検査メニュー</h1>
        <p>本日の状態に合わせて検査を選択してください。</p>
      </section>
      <section className="grid-2">
        {cards.map((card) => (
          <Link key={card.to} className="card card-link" to={card.to}>
            <h2>{card.title}</h2>
            <p>{card.description}</p>
            <span className="text-link">開始する</span>
          </Link>
        ))}
      </section>
    </Layout>
  );
}
