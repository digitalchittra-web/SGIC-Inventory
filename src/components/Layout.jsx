import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../store.jsx'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: '⊞' },
  { to: '/requisitions', label: 'Requisitions', icon: '📋' },
  { to: '/inventory', label: 'Inventory', icon: '📦' },
  { to: '/inbound', label: 'Inbound (Purchase)', icon: '↓', adminOnly: true },
  { to: '/outbound', label: 'Outbound (Transfer)', icon: '↑', adminOnly: true },
  { to: '/branches', label: 'Branches', icon: '🏢' },
  { to: '/categories', label: 'Categories', icon: '🏷️', adminOnly: true },
  { to: '/units', label: 'Units', icon: '📏', adminOnly: true },
  { to: '/vendors', label: 'Vendors', icon: '🏭', adminOnly: true },
  { to: '/users', label: 'Users', icon: '👥', adminOnly: true },
  { to: '/departments', label: 'Departments', icon: '🏛️', adminOnly: true },
  { to: '/reports', label: 'Reports', icon: '📊', adminOnly: true },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() { logout(); navigate('/login') }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">📦</span>
            <div>
              <div className="logo-title">Sanima GIC</div>
              <div className="logo-sub">Inventory System</div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter(item => !item.adminOnly || ['admin', 'user_admin'].includes(user?.role))
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
            <div>
              <div className="user-name">{user?.username}</div>
              <span className={'badge badge-' + user?.role}>{user?.role}</span>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout}>Logout</button>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
