import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import PrimaryButton from "../components/PrimaryButton";

const TERMS_TEXT = `デジニューロマーカー ダミー利用規約

1. 目的
本アプリは、神経疾患に関連する症状変化を記録し、診療および研究で参照するための支援ツールです。

2. 医療判断について
本アプリの測定結果は、医師による診断、治療方針、投薬判断、緊急性判断を代替するものではありません。体調の急変、息苦しさ、転倒、強い脱力、嚥下困難などがある場合は、速やかに医療機関へ相談してください。

3. 取得される情報
本アプリでは、カメラ映像、動画、音声、測定日時、解析結果、質問票回答など、個人を識別し得る情報を取得する場合があります。

4. サーバー送信と利用目的
測定データは、個人情報保護を徹底した上で、診療および倫理審査で承認された研究目的に利用される想定です。実運用では安全なサーバー送信および保管を前提とします。

5. 免責
本アプリの利用により利用者に生じた損害について、提供者に故意または重過失がある場合を除き、提供者は責任を負いません。

6. ドラフトであること
本規約は開発中のダミー規約であり、正式運用前に所属機関、倫理審査委員会、法務担当者または弁護士の確認を受けて確定する必要があります。`;

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
    hash?: string;
  };
};

export default function Login() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const redirectTo = useMemo(() => {
    const state = location.state as LocationState | null;
    const from = state?.from;
    if (!from?.pathname || from.pathname === "/login") {
      return "/";
    }
    return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
  }, [location.state]);

  useEffect(() => {
    if (!showTerms) {
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
  }, [showTerms]);

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  function handleDownloadTerms() {
    const blob = new Blob([TERMS_TEXT], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "digineuro-marker-terms-draft.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleLogin() {
    if (!agreed) {
      return;
    }
    login({ userId: loginId || password || "demo-user", remember });
    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="login-page login-page-enhanced">
      <style>{`
        .login-page-enhanced {
          background: radial-gradient(circle at top right, #0e1a1c 0%, #050a0a 100%);
          min-height: 100vh;
          color: #ffffff;
        }
        .login-page-enhanced .login-brand p,
        .login-page-enhanced .login-brand h2 {
          color: rgba(255, 255, 255, 0.8);
        }
        .login-title-ripple {
          position: relative;
          display: inline-block;
          animation: titleRipple 2.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          background: linear-gradient(180deg, #ffffff 0%, #a3f0d1 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 4px 20px rgba(127, 214, 170, 0.2);
        }
        @keyframes titleRipple {
          0% {
            opacity: 0;
            transform: translateY(30px);
            filter: blur(10px);
            clip-path: polygon(0 100%, 100% 100%, 100% 100%, 0 100%);
          }
          50% {
            opacity: 0.6;
            filter: blur(4px);
            clip-path: polygon(0 40%, 100% 60%, 100% 100%, 0 100%);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
            clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);
          }
        }
        .login-glass-card {
          background: rgba(255, 255, 255, 0.05) !important;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important;
          border-radius: 24px !important;
        }
        .login-glass-card label span {
          color: rgba(255, 255, 255, 0.8) !important;
        }
        .login-glass-card .sync-input {
          background: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          color: #fff !important;
          border-radius: 12px !important;
        }
        .login-glass-card .sync-input:focus {
          border-color: #7fd6aa !important;
          box-shadow: 0 0 0 2px rgba(127, 214, 170, 0.2) !important;
        }
        .login-glass-card .sync-checkbox-row span {
          color: rgba(255, 255, 255, 0.9) !important;
        }
        .login-glass-card .sync-inline-link {
          color: #7fd6aa !important;
        }
        .modal-card-glass {
          background: rgba(20, 30, 30, 0.85) !important;
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #fff !important;
        }
        .modal-card-glass h2, .modal-card-glass .sync-banner-eyebrow {
          color: #fff !important;
        }
        .modal-card-glass .terms-pre {
          background: rgba(0, 0, 0, 0.3) !important;
          color: rgba(255, 255, 255, 0.8) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
        }
        .button-row-right {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          width: 100%;
        }
        .icon-close-button {
          background: rgba(255, 255, 255, 0.1);
          border: none;
          border-radius: 50%;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          cursor: pointer;
          transition: background 0.2s;
          flex-shrink: 0;
        }
        .icon-close-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        .modal-card-glass .ghost-button {
          color: #fff !important;
          background: rgba(255, 255, 255, 0.1) !important;
        }
        .modal-card-glass .ghost-button:hover {
          background: rgba(255, 255, 255, 0.2) !important;
        }
        .login-footer {
          color: rgba(255, 255, 255, 0.4);
        }
      `}</style>
      <main className="login-shell">
        <section className="login-brand">
          <h1 className="login-product-title login-title-ripple">
            <span data-title="DigiNeuro Marker">DigiNeuro Marker</span>
          </h1>
          <p className="login-product-copy">
            パーキンソン病・重症筋無力症の症状記録をサポートする包括的計測アプリ
          </p>
          <h2 className="login-form-heading">ログイン</h2>
          <p>
            開発版のため、任意のログインIDとパスワードでログインできます。利用規約への同意が必要です。
          </p>
        </section>

        <section className="card login-card login-glass-card">
          <label className="sync-field">
            <span>ログインIDまたはメールアドレス</span>
            <input
              className="sync-input"
              type="text"
              autoComplete="username"
              value={loginId}
              onChange={(event) => setLoginId(event.target.value)}
              placeholder="demo@example.jp"
            />
          </label>

          <label className="sync-field">
            <span>パスワード</span>
            <input
              className="sync-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="任意の値"
            />
          </label>

          <div className="sync-checkbox-group">
            <label className="sync-checkbox-row">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>ログイン状態を保持する</span>
            </label>

            <div className="sync-checkbox-row sync-checkbox-split">
              <label className="sync-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                />
                <span>利用規約に同意する</span>
              </label>
              <button
                type="button"
                className="sync-inline-link"
                onClick={() => setShowTerms(true)}
              >
                利用規約を確認する
              </button>
            </div>
          </div>

          <PrimaryButton type="button" onClick={handleLogin} disabled={!agreed}>
            ログイン
          </PrimaryButton>
        </section>
      </main>

      <footer className="login-footer">
        Copyright © 2026 奈良医大 脳神経内科 | All rights reserved.
      </footer>

      {showTerms ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setShowTerms(false)}
        >
          <div
            className="modal-card modal-card-glass"
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-terms-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sync-card-header">
              <div>
                <p className="sync-banner-eyebrow">Terms</p>
                <h2 id="login-terms-title">利用規約ドラフト</h2>
              </div>
              <button
                type="button"
                className="icon-close-button"
                onClick={() => setShowTerms(false)}
                aria-label="閉じる"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <pre className="terms-pre">{TERMS_TEXT}</pre>
            <div className="button-row button-row-right">
              <PrimaryButton type="button" onClick={handleDownloadTerms}>
                利用規約をダウンロード
              </PrimaryButton>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setAgreed(true);
                  setShowTerms(false);
                }}
              >
                同意して閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
