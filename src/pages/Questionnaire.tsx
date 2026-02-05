import { useMemo, useState } from "react";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import { mgAdlItems, mgQolItems } from "../data/questionnaires";
import { addSession, addTimeSeries } from "../storage/db";

export default function Questionnaire() {
  const [adlScores, setAdlScores] = useState<Record<string, number>>({});
  const [qolScores, setQolScores] = useState<Record<string, number>>({});

  const totals = useMemo(() => {
    const adlTotal = mgAdlItems.reduce(
      (acc, item) => acc + (adlScores[item.id] ?? 0),
      0
    );
    const qolTotal = mgQolItems.reduce(
      (acc, item) => acc + (qolScores[item.id] ?? 0),
      0
    );
    return { adlTotal, qolTotal, combined: adlTotal + qolTotal };
  }, [adlScores, qolScores]);

  const handleSave = async () => {
    const id = Date.now();
    await addSession({
      id,
      type: "epro",
      date: new Date().toISOString(),
      summaryScore: totals.combined,
      notes: `ADL:${totals.adlTotal} QOL:${totals.qolTotal}`
    });
    await addTimeSeries({
      sessionId: id,
      frameData: [],
      details: {
        adl: adlScores,
        qol: qolScores,
        adlTotal: totals.adlTotal,
        qolTotal: totals.qolTotal
      }
    });
  };

  return (
    <Layout>
      <section className="page-header">
        <h1>問診票（MG-ADL / MG-QOL15r）</h1>
        <p>最近の症状を思い出しながら、該当するスコアを選択してください。</p>
      </section>
      <section className="questionnaire">
        <div className="card">
          <h2>MG-ADL 相当 (0-3点)</h2>
          {mgAdlItems.map((item) => (
            <div key={item.id} className="question-row">
              <div>
                <p className="question-title">{item.label}</p>
                <p className="question-desc">{item.description}</p>
              </div>
              <div className="score-group">
                {Array.from({ length: item.maxScore + 1 }, (_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={
                      adlScores[item.id] === idx
                        ? "score-button active"
                        : "score-button"
                    }
                    onClick={() =>
                      setAdlScores((prev) => ({ ...prev, [item.id]: idx }))
                    }
                  >
                    {idx}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="total-row">
            <span>ADL 合計</span>
            <strong>{totals.adlTotal}</strong>
          </div>
        </div>

        <div className="card">
          <h2>MG-QOL15r 相当 (0-2点)</h2>
          {mgQolItems.map((item) => (
            <div key={item.id} className="question-row">
              <div>
                <p className="question-title">{item.label}</p>
                <p className="question-desc">{item.description}</p>
              </div>
              <div className="score-group">
                {Array.from({ length: item.maxScore + 1 }, (_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={
                      qolScores[item.id] === idx
                        ? "score-button active"
                        : "score-button"
                    }
                    onClick={() =>
                      setQolScores((prev) => ({ ...prev, [item.id]: idx }))
                    }
                  >
                    {idx}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="total-row">
            <span>QOL 合計</span>
            <strong>{totals.qolTotal}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="total-row">
          <span>総合スコア</span>
          <strong>{totals.combined}</strong>
        </div>
        <div className="button-row">
          <PrimaryButton onClick={handleSave}>回答を保存</PrimaryButton>
        </div>
      </section>
    </Layout>
  );
}
