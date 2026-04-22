import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

const navItems = [
  { to: '/dashboard',     label: 'Dashboard' },
  { to: '/ads/campaigns', label: 'Campaigns' },
  { to: '/ads',           label: 'Ads' },
  { to: '/users',         label: 'Users' },
  { to: '/reports',       label: 'Reports' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <nav className="sidebar">
        <div className="brand">Chunky Sports</div>
        <ul className="nav-list">
          {navItems.map(({ to, label }) => (
            <li key={to}>
              <NavLink to={to} className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <span className="env-badge">{user?.env === 'dev' ? 'DEV' : 'PROD'}</span>
          <span className="user-email">{user?.email}</span>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
