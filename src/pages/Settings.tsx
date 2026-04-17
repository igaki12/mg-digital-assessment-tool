import { useState } from "react";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import PrimaryButton from "../components/PrimaryButton";
import { clearAllData } from "../storage/db";
import { getUserHeight, setUserHeight } from "../storage/settings";

export default function Settings() {
  const [height, setHeight] = useState(getUserHeight());
  const [message, setMessage] = useState<string | null>(null);

  const saveHeight = () => {
    setUserHeight(height);
    setMessage("設定を保存しました。");
  };

  const clearData = async () => {
    await clearAllData();
    setMessage("ローカルデータを削除しました。");
  };

  return (
    <Layout>
      <PageHeader
        icon="settings"
        title="設定"
        description="身長設定やデータ削除を行います。"
      />

      <section className="card">
        <h2>身長設定</h2>
        <div className="settings-row">
          <label htmlFor="height">身長（cm）</label>
          <input
            id="height"
            type="number"
            min={100}
            max={220}
            value={height}
            onChange={(event) => setHeight(Number(event.target.value))}
          />
        </div>
        <div className="button-row">
          <PrimaryButton onClick={saveHeight}>保存</PrimaryButton>
        </div>
      </section>

      <section className="card danger">
        <h2>データ削除</h2>
        <p>端末内に保存された測定データと動画を削除します。</p>
        <div className="button-row">
          <button className="ghost-button" onClick={clearData}>
            すべて削除
          </button>
        </div>
      </section>

      {message ? <p className="status">{message}</p> : null}
    </Layout>
  );
}
