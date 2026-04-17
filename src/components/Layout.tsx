import { Link, NavLink } from "react-router-dom";
import { type ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo">
          MG Digital Assessment
        </Link>
        <nav className="app-nav" aria-label="メインナビゲーション">
          <NavLink to="/" className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}>
            ホーム
          </NavLink>
          <NavLink
            to="/assessments"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            検査を始める
          </NavLink>
          <NavLink
            to="/records"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            記録を見る
          </NavLink>
          <NavLink
            to="/review"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            医師共有
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
          >
            設定
          </NavLink>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <p>
          すべての解析は端末内で完結します。医療判断は必ず医師へ相談してください。
        </p>
      </footer>
    </div>
  );
}
