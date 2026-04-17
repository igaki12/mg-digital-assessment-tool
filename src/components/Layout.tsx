import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";
import AppIcon from "./AppIcon";

type NavIconName =
  | "home"
  | "clipboard"
  | "records"
  | "share"
  | "settings"
  | "chevron";

type NavItem = {
  to: string;
  label: string;
  icon: Exclude<NavIconName, "chevron">;
};

const navItems: NavItem[] = [
  { to: "/", label: "ホーム", icon: "home" },
  { to: "/assessments", label: "検査を始める", icon: "clipboard" },
  { to: "/records", label: "記録を見る", icon: "records" },
  { to: "/review", label: "医師共有", icon: "share" },
  { to: "/settings", label: "設定", icon: "settings" }
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [isMobileNavExpanded, setIsMobileNavExpanded] = useState(false);

  useEffect(() => {
    setIsMobileNavExpanded(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="logo">
          MG Digital Assessment
        </Link>
        <nav
          className={`app-nav${isMobileNavExpanded ? " is-expanded" : ""}`}
          onClick={() => setIsMobileNavExpanded((prev) => !prev)}
          aria-label="メインナビゲーション"
        >
          <div className="app-nav-mobile-hint" aria-hidden="true">
            <span className="app-nav-mobile-text">メニュー</span>
            <span className="app-nav-chevron">
              <AppIcon
                name="chevron"
                className={`nav-icon${isMobileNavExpanded ? " is-expanded" : ""}`}
              />
            </span>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              <span className="nav-link-content">
                <span className="nav-link-icon">
                  <AppIcon name={item.icon} className="nav-icon" />
                </span>
                <span className="nav-link-label">{item.label}</span>
              </span>
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
