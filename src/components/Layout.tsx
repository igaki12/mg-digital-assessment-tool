import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const isHome = location.pathname === "/";

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app">
      <header className={`app-header${isMobileNavOpen ? " is-mobile-open" : ""}`}>
        <div className="app-header-bar">
          <Link to="/" className="logo">
            MG Digital Assessment
          </Link>
          <button
            type="button"
            className="app-nav-toggle"
            aria-expanded={isMobileNavOpen}
            aria-controls="app-nav"
            aria-label={isMobileNavOpen ? "メニューを閉じる" : "メニューを開く"}
            onClick={() => setIsMobileNavOpen((prev) => !prev)}
          >
            <span className="app-nav-toggle-line" />
            <span className="app-nav-toggle-line" />
            <span className="app-nav-toggle-line" />
          </button>
        </div>
        <nav
          id="app-nav"
          className={`app-nav${isMobileNavOpen ? " is-open" : ""}`}
          aria-label="メインナビゲーション"
        >
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
          <button type="button" className="nav-link nav-logout-button" onClick={handleLogout}>
            ログアウト
          </button>
        </nav>
      </header>
      <main className="app-main">{children}</main>
      <footer className={isHome ? "app-footer" : "app-footer app-footer-mobile-hidden"}>
        <p>
          測定データは、個人情報保護を徹底した上で診療・研究に利用されます。医療判断は必ず医師へ相談してください。
        </p>
      </footer>
    </div>
  );
}
