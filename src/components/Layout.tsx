import { Link, NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const navItems = [
  { to: "/", label: "ホーム" },
  { to: "/assessments", label: "検査を始める" },
  { to: "/records", label: "記録を見る" },
  { to: "/review", label: "医師レビュー" },
  { to: "/settings", label: "設定" }
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo">
          MG Digital Assessment
        </Link>
        <nav className="app-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              {item.label}
            </NavLink>
          ))}
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
