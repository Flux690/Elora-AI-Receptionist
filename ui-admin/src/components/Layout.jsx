import { NavLink, Outlet } from "react-router-dom";
import ThemeToggle from "./ThemeTogle";

function Layout() {
  return (
    <div className="app-layout">
      <nav className="app-nav" aria-label="Main navigation">
        <div>
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/knowledge">Knowledge Base</NavLink>
        </div>
        <ThemeToggle />
      </nav>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
