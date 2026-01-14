import { Outlet, NavLink } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>FlowState</h1>
        <nav>
          <NavLink 
            to="/integrations" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Integrations
          </NavLink>
          <NavLink 
            to="/preferences" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Preferences
          </NavLink>
          <NavLink 
            to="/agents" 
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            Agents
          </NavLink>
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
