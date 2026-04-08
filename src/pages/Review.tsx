import { useEffect, useMemo, useRef, useState } from "react";
import Layout from "../components/Layout";
import PrimaryButton from "../components/PrimaryButton";
import StatCard from "../components/StatCard";
import {
  deleteVideos,
  getTimeSeries,
  getVideo,
  listSessions
} from "../storage/db";
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

function getDayCount(values: string[]) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a.localeCompare(b));
  const first = new Date(sorted[0] ?? "");
  const last = new Date(sorted[sorted.length - 1] ?? sorted[0] ?? "");
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate());
  const end = new Date(last.getFullYear(), last.getMonth(), last.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
}

const typeLabels: Record<SessionMeta["type"], string> = {
  ptosis: "眼瞼下垂",
  limbs: "上肢の筋力",
  gait: "歩行動作",
  epro: "症状の問診"
};

type SyncCandidate = {
  session: SessionMeta;
  approxBytes: number;
  videoBytes: number;
  dataPoints: number;
};

type UploadPhase = "idle" | "authing" | "ready" | "uploading" | "success";

type LoginFormState = {
  email: string;
  password: string;
  rememberLogin: boolean;
  agreedToTerms: boolean;
};

const uploadSteps = ["準備中", "暗号化中", "アップロード中", "完了処理中"] as const;
const uploadStepDurations = [700, 900, 1400, 800] as const;

function formatBytes(value: number) {
  if (value <= 0) {
    return "0 B";
  }
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function estimateBytes(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

function wait(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export default function Review() {
  const mountedRef = useRef(true);
  const [candidates, setCandidates] = useState<SyncCandidate[]>([]);
  const [syncedSessionIds, setSyncedSessionIds] = useState<number[]>([]);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("idle");
  const [activeUploadStep, setActiveUploadStep] = useState(-1);
  const [loginForm, setLoginForm] = useState<LoginFormState>({
    email: "",
    password: "",
    rememberLogin: false,
    agreedToTerms: false
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncSummary, setLastSyncSummary] = useState<string | null>(null);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!showTermsModal) {
      return;
    }
    const { body, documentElement } = document;
    const originalBodyOverflow = body.style.overflow;
    const originalHtmlOverflow = documentElement.style.overflow;
    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    return () => {
      body.style.overflow = originalBodyOverflow;
      documentElement.style.overflow = originalHtmlOverflow;
    };
  }, [showTermsModal]);

  useEffect(() => {
    let active = true;
    async function loadCandidates() {
      const sessions = (await listSessions()).sort((a, b) =>
        b.date.localeCompare(a.date)
      );
      const nextCandidates = await Promise.all(
        sessions.map(async (session) => {
          const [record, video] = await Promise.all([
            getTimeSeries(session.id),
            getVideo(session.id)
          ]);
          return {
            session,
            approxBytes:
              estimateBytes(session) +
              (record ? estimateBytes(record) : 0) +
              (video?.blob.size ?? 0),
            videoBytes: video?.blob.size ?? 0,
            dataPoints: record?.frameData.length ?? 0
          } satisfies SyncCandidate;
        })
      );
      if (!active || !mountedRef.current) {
        return;
      }
      setCandidates(nextCandidates);
    }
    loadCandidates();
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const syncedIdSet = useMemo(() => new Set(syncedSessionIds), [syncedSessionIds]);
  const unsyncedCandidates = useMemo(
    () => candidates.filter((candidate) => !syncedIdSet.has(candidate.session.id)),
    [candidates, syncedIdSet]
  );
  const syncedVideoCandidates = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          syncedIdSet.has(candidate.session.id) && candidate.videoBytes > 0
      ),
    [candidates, syncedIdSet]
  );
  const pendingBytes = useMemo(
    () =>
      unsyncedCandidates.reduce(
        (total, candidate) => total + candidate.approxBytes,
        0
      ),
    [unsyncedCandidates]
  );
  const pendingDayCount = useMemo(
    () => getDayCount(unsyncedCandidates.map((candidate) => candidate.session.date)),
    [unsyncedCandidates]
  );
  const estimatedUploadSeconds = useMemo(() => {
    if (unsyncedCandidates.length === 0) {
      return 0;
    }
    const mb = pendingBytes / (1024 * 1024);
    return Math.min(5, Math.max(3, Math.round(3 + mb * 0.6)));
  }, [pendingBytes, unsyncedCandidates.length]);
  const displayedCandidates = useMemo(
    () =>
      [...candidates].sort((a, b) => {
        const aSynced = syncedIdSet.has(a.session.id);
        const bSynced = syncedIdSet.has(b.session.id);
        if (aSynced !== bSynced) {
          return aSynced ? 1 : -1;
        }
        return b.session.date.localeCompare(a.session.date);
      }),
    [candidates, syncedIdSet]
  );
  const cleanupBytes = useMemo(
    () =>
      syncedVideoCandidates.reduce(
        (total, candidate) => total + candidate.videoBytes,
        0
      ),
    [syncedVideoCandidates]
  );
  const canSubmit =
    Boolean(isLoggedIn) &&
    Boolean(loginForm.agreedToTerms) &&
    unsyncedCandidates.length > 0 &&
    uploadPhase !== "authing" &&
    uploadPhase !== "uploading";

  async function handleLogin() {
    if (!loginForm.email.trim() || !loginForm.password.trim()) {
      setStatusMessage("メールアドレスとパスワードを入力してください。");
      return;
    }
    setActiveUploadStep(-1);
    setUploadPhase("authing");
    setStatusMessage("医療機関ポータルへ接続しています。");
    await wait(520);
    if (!mountedRef.current) {
      return;
    }
    setIsLoggedIn(true);
    setUploadPhase("ready");
    setStatusMessage(
      loginForm.rememberLogin
        ? "ログインを確認しました。このデモでは再読込後に状態がリセットされます。"
        : "ログインを確認しました。"
    );
  }

  function handleLogout() {
    setIsLoggedIn(false);
    setUploadPhase("idle");
    setActiveUploadStep(-1);
    setStatusMessage("ログアウトしました。");
  }

  function clearCredentials() {
    setLoginForm((prev) => ({
      ...prev,
      email: "",
      password: "",
      rememberLogin: false
    }));
    setIsLoggedIn(false);
    setUploadPhase("idle");
    setActiveUploadStep(-1);
    setStatusMessage("入力内容をクリアしました。");
  }

  async function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    const targetIds = unsyncedCandidates.map((candidate) => candidate.session.id);
    setUploadPhase("uploading");
    setStatusMessage("クラウドへ送信しています。");
    for (let index = 0; index < uploadSteps.length; index += 1) {
      setActiveUploadStep(index);
      await wait(uploadStepDurations[index] ?? 800);
      if (!mountedRef.current) {
        return;
      }
    }
    setSyncedSessionIds((prev) => Array.from(new Set([...prev, ...targetIds])));
    setLastSyncAt(new Date().toISOString());
    setLastSyncSummary(`${targetIds.length}件の測定データをダミー送信しました。`);
    setStatusMessage("ダミー送信が完了しました。必要に応じて動画を削除できます。");
    setUploadPhase("success");
    setActiveUploadStep(uploadSteps.length - 1);
    setShowCleanupConfirm(false);
  }

  async function handleDeleteSyncedVideos() {
    const targetIds = syncedVideoCandidates.map((candidate) => candidate.session.id);
    if (targetIds.length === 0) {
      return;
    }
    setStatusMessage("同期済みの動画を削除して端末容量を確保しています。");
    await deleteVideos(targetIds);
    if (!mountedRef.current) {
      return;
    }
    setStatusMessage(
      `${targetIds.length}件の動画を削除しました。約${formatBytes(cleanupBytes)}を確保しました。`
    );
    setShowCleanupConfirm(false);
    setReloadToken((value) => value + 1);
  }

  return (
    <Layout>
      <section className="page-header">
        <h1>医師共有</h1>
        <p>端末内の測定データを、必要なタイミングで医師向けクラウドへ送信するダミー画面です。</p>
      </section>

      <section className="sync-banner card">
        <p className="sync-banner-eyebrow">Demo Sync Mode</p>
        <h2>実サーバー送信は行いません</h2>
        <p>
          このページは送信前チェック、ローディング表示、同期済み動画の整理動線を確認するためのダミー実装です。
        </p>
      </section>

      <section className="review-summary-grid">
        <StatCard
          title="未同期データ"
          value={`${formatBytes(pendingBytes)} / ${unsyncedCandidates.length}件`}
          note={
            unsyncedCandidates.length
              ? "このページ内でまだ送信されていない測定です。"
              : "送信待ちのデータはありません。"
          }
        />
        <StatCard
          title="未同期期間"
          value={pendingDayCount > 0 ? `${pendingDayCount}日間` : "0日"}
          note="未同期データがまたがる期間を日数で表示しています。"
        />
        <StatCard
          title="最終送信"
          value={lastSyncAt ? formatDate(lastSyncAt) : "未送信"}
          note={lastSyncSummary ?? "まだクラウド送信は行われていません。"}
        />
      </section>

      <section className="card sync-auth-card">
        <div className="sync-card-header">
          <div>
            <h2>送信前チェック</h2>
            <p>データ送信時のみログインが必要です。任意の値でダミーログインできます。</p>
          </div>
          <div className={isLoggedIn ? "sync-login-badge is-active" : "sync-login-badge"}>
            {isLoggedIn ? "ログイン済み" : "未ログイン"}
          </div>
        </div>

        <div className="sync-auth-grid">
          <label className="sync-field">
            <span>メールアドレス</span>
            <input
              className="sync-input"
              type="email"
              placeholder="doctor@example.jp"
              value={loginForm.email}
              onChange={(event) =>
                setLoginForm((prev) => ({ ...prev, email: event.target.value }))
              }
              disabled={uploadPhase === "authing" || uploadPhase === "uploading"}
            />
          </label>

          <label className="sync-field">
            <span>パスワード</span>
            <input
              className="sync-input"
              type="password"
              placeholder="8文字以上"
              value={loginForm.password}
              onChange={(event) =>
                setLoginForm((prev) => ({
                  ...prev,
                  password: event.target.value
                }))
              }
              disabled={uploadPhase === "authing" || uploadPhase === "uploading"}
            />
          </label>
        </div>

        <div className="sync-checkbox-group">
          <label className="sync-checkbox-row">
            <input
              type="checkbox"
              checked={loginForm.rememberLogin}
              onChange={(event) =>
                setLoginForm((prev) => ({
                  ...prev,
                  rememberLogin: event.target.checked
                }))
              }
              disabled={uploadPhase === "authing" || uploadPhase === "uploading"}
            />
            <span>ログイン状態を保持する</span>
          </label>

          <div className="sync-checkbox-row sync-checkbox-split">
            <label className="sync-checkbox-label">
              <input
                type="checkbox"
                checked={loginForm.agreedToTerms}
                onChange={(event) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    agreedToTerms: event.target.checked
                  }))
                }
                disabled={uploadPhase === "authing" || uploadPhase === "uploading"}
              />
              <span>利用規約に同意する</span>
            </label>
            <button
              type="button"
              className="sync-inline-link"
              onClick={() => setShowTermsModal(true)}
            >
              利用規約を開く
            </button>
          </div>
        </div>

        <div className="button-row">
          {!isLoggedIn ? (
            <PrimaryButton
              type="button"
              onClick={handleLogin}
              disabled={uploadPhase === "authing" || uploadPhase === "uploading"}
            >
              {uploadPhase === "authing" ? (
                <span className="button-spinner-wrap">
                  <span className="spinner spinner-on-button" aria-hidden="true" />
                  ログイン確認中
                </span>
              ) : (
                "ログインして送信準備をする"
              )}
            </PrimaryButton>
          ) : (
            <button
              type="button"
              className="ghost-button"
              onClick={handleLogout}
              disabled={uploadPhase === "uploading"}
            >
              ログアウト
            </button>
          )}

          <button
            type="button"
            className="ghost-button"
            onClick={clearCredentials}
            disabled={uploadPhase === "authing" || uploadPhase === "uploading"}
          >
            入力をクリア
          </button>
        </div>

        <p className="sync-reset-note">
          「ログイン状態を保持する」を選んでも、このデモでは再読込で状態がリセットされます。
        </p>
      </section>

      <section className="review-workspace">
        <div className="card sync-actions-card">
          <div className="sync-card-header">
            <div>
              <h2>送信を実行</h2>
              <p>
                推定送信時間は約{estimatedUploadSeconds}秒です。送信中は操作を一時停止します。
              </p>
            </div>
            <div className="sync-upload-meta">
              <span className="sync-meta-chip">{formatBytes(pendingBytes)}</span>
              <span className="sync-meta-chip">{unsyncedCandidates.length}件</span>
            </div>
          </div>

          <div className="button-row">
            <PrimaryButton type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {uploadPhase === "uploading" ? (
                <span className="button-spinner-wrap">
                  <span className="spinner spinner-on-button" aria-hidden="true" />
                  クラウドへ送信中
                </span>
              ) : (
                "クラウドへ送信する"
              )}
            </PrimaryButton>
          </div>

          <div className="sync-callout-row">
            {!isLoggedIn ? (
              <p className="sync-hint">送信前にログインが必要です。</p>
            ) : null}
            {isLoggedIn && !loginForm.agreedToTerms ? (
              <p className="sync-hint">送信前に利用規約への同意が必要です。</p>
            ) : null}
            {syncedVideoCandidates.length === 0 ? (
              <p className="sync-hint">削除できる同期済み動画はまだありません。</p>
            ) : null}
          </div>

          {uploadPhase === "uploading" || uploadPhase === "success" ? (
            <div className="sync-progress-panel">
              <div className="sync-progress-header">
                <h3>送信進捗</h3>
                {uploadPhase === "uploading" ? (
                  <span className="sync-progress-status is-live">
                    <span className="spinner" aria-hidden="true" />
                    {uploadSteps[Math.max(activeUploadStep, 0)]}
                  </span>
                ) : (
                  <span className="sync-progress-status is-done">送信完了</span>
                )}
              </div>

              <ol className="sync-progress-list">
                {uploadSteps.map((step, index) => {
                  const state =
                    uploadPhase === "success"
                      ? "done"
                      : uploadPhase === "uploading" && index < activeUploadStep
                        ? "done"
                        : index === activeUploadStep && uploadPhase === "uploading"
                          ? "active"
                          : "pending";
                  return (
                    <li key={step} className={`sync-progress-step is-${state}`}>
                      <span className="sync-progress-index">{index + 1}</span>
                      <div>
                        <p className="sync-progress-title">{step}</p>
                        <p className="sync-progress-note">
                          {index === 0 && "送信対象を束ねて確認します。"}
                          {index === 1 && "端末内のデータを保護した形に変換します。"}
                          {index === 2 && "クラウド送信を模した待機演出を行います。"}
                          {index === 3 && "送信済み扱いへ切り替えて完了通知を出します。"}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          ) : null}

          {statusMessage ? <p className="sync-status-message">{statusMessage}</p> : null}

          {candidates.length === 0 ? (
            <div className="sync-empty card">
              <h3>まだ共有できるデータがありません</h3>
              <p>検査を保存すると、この画面に送信対象として表示されます。</p>
            </div>
          ) : null}
        </div>

        <div className="card sync-targets-card">
          <div className="sync-card-header">
            <div>
              <h2>同期対象一覧</h2>
              <p>未同期データが先頭に表示されます。動画の有無と概算サイズを確認できます。</p>
            </div>
          </div>

          <div className="sync-session-list">
            {displayedCandidates.map((candidate) => {
              const synced = syncedIdSet.has(candidate.session.id);
              return (
                <div key={candidate.session.id} className="sync-session-row">
                  <div className="sync-session-main">
                    <div className="sync-session-head">
                      <span className="badge">{typeLabels[candidate.session.type]}</span>
                      <span
                        className={
                          synced
                            ? "sync-pill sync-pill-synced"
                            : "sync-pill sync-pill-pending"
                        }
                      >
                        {synced ? "送信済み" : "未同期"}
                      </span>
                    </div>
                    <p className="list-title">{formatDate(candidate.session.date)}</p>
                    <p className="list-sub">
                      スコア {candidate.session.summaryScore.toFixed(2)} ・
                      {candidate.videoBytes > 0 ? " 動画あり" : " 数値のみ"} ・
                      {candidate.dataPoints}フレーム
                    </p>
                    {candidate.session.notes ? (
                      <p className="sync-session-note">{candidate.session.notes}</p>
                    ) : null}
                  </div>
                  <div className="sync-session-side">
                    <strong>{formatBytes(candidate.approxBytes)}</strong>
                    <span>{candidate.videoBytes > 0 ? "動画含む" : "軽量データ"}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="button-row">
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowCleanupConfirm((value) => !value)}
              disabled={syncedVideoCandidates.length === 0 || uploadPhase === "uploading"}
            >
              同期済み動画を削除して容量を確保
            </button>
          </div>

          {showCleanupConfirm ? (
            <div className="cleanup-confirm">
              <p className="cleanup-title">同期済み動画を端末から削除しますか？</p>
              <p>
                数値データと履歴は残したまま、動画のみ削除します。想定削減容量は
                <strong> {formatBytes(cleanupBytes)}</strong> です。
              </p>
              <div className="button-row">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={handleDeleteSyncedVideos}
                >
                  動画を削除する
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setShowCleanupConfirm(false)}
                >
                  キャンセル
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {showTermsModal ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowTermsModal(false)}
        >
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="terms-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sync-card-header">
              <div>
                <p className="sync-banner-eyebrow">Terms</p>
                <h2 id="terms-modal-title">医師共有デモ利用規約</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setShowTermsModal(false)}
              >
                閉じる
              </button>
            </div>

            <div className="terms-body">
              <section>
                <h3>1. 送信データの範囲</h3>
                <p>
                  共有対象には測定メタデータ、時系列数値、動画が含まれる想定です。この画面では送信先を持たず、送信完了表示のみ再現します。
                </p>
              </section>
              <section>
                <h3>2. 医療判断ではありません</h3>
                <p>
                  本アプリの出力は診療補助を想定した参考情報です。診断や治療方針の決定は、必ず医師による確認を前提とします。
                </p>
              </section>
              <section>
                <h3>3. 端末保存と削除</h3>
                <p>
                  データは端末内に保存されます。同期済み動画の削除を実行すると、動画のみが端末から消去され、数値データと履歴は保持されます。
                </p>
              </section>
              <section>
                <h3>4. デモ送信について</h3>
                <p>
                  この同期画面は UI 検証用のダミーであり、実ネットワーク通信や正式な認証は実施しません。表示上の待機時間とローディングのみ提供します。
                </p>
              </section>
            </div>

            <div className="button-row">
              <PrimaryButton
                type="button"
                onClick={() => {
                  setLoginForm((prev) => ({ ...prev, agreedToTerms: true }));
                  setShowTermsModal(false);
                }}
              >
                同意して閉じる
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
}
