import { Link, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState, type ReactNode } from "react";

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

function NavIcon({
  name,
  className = ""
}: {
  name: NavIconName;
  className?: string;
}) {
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="m4 11 8-6 8 6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M6.5 10.5V19h11v-8.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "clipboard":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <rect
            x="6"
            y="5"
            width="12"
            height="15"
            rx="2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M9 5.5h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M9 10.5h6M9 14.5h6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "records":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M5 18V9"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M12 18V6"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M19 18v-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="5" cy="18" r="1.4" fill="currentColor" />
          <circle cx="12" cy="6" r="1.4" fill="currentColor" />
          <circle cx="19" cy="14" r="1.4" fill="currentColor" />
        </svg>
      );
    case "share":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="M12 14V5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="m8.5 8.5 3.5-3.5 3.5 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect
            x="5"
            y="13"
            width="14"
            height="6"
            rx="2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.8 6.8l1.4 1.4M15.8 15.8l1.4 1.4M17.2 6.8l-1.4 1.4M8.2 15.8l-1.4 1.4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      );
    case "chevron":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path
            d="m7 10 5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

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
              <NavIcon
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
                  <NavIcon name={item.icon} className="nav-icon" />
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
