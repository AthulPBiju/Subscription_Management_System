import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Repeat, Receipt,
  Wallet, Tag, ChartNoAxesCombined, Settings, LogOut, Menu,
  ChevronDown, Bell, Search, UserCheck, Check,
} from 'lucide-react';
import api from '../api';

const ADMIN_NAV = [
  { label: 'Overview',        Icon: LayoutDashboard,     path: '/' },
  { label: 'Customers',       Icon: Users,               path: '/customers' },
  { label: 'Products & plans', Icon: Package,            path: '/catalog' },
  { label: 'Subscriptions',   Icon: Repeat,              path: '/subscriptions' },
  { label: 'Invoices',        Icon: Receipt,             path: '/invoices' },
  { label: 'Payments',        Icon: Wallet,              path: '/payments' },
  { label: 'Discounts',       Icon: Tag,                 path: '/discounts' },
  { label: 'Reports',         Icon: ChartNoAxesCombined, path: '/reports' },
];

const CUSTOMER_NAV = [
  { label: 'My Subscriptions', Icon: Repeat,              path: '/portal' },
  { label: 'Invoices & Billing', Icon: Receipt,           path: '/invoices' },
  { label: 'Catalog & Plans', Icon: Package,             path: '/catalog' },
];

function NavItem({ label, Icon, path, collapsed, badge }) {
  const loc = useLocation();
  const active = loc.pathname === path;
  return (
    <Link
      to={path}
      className={`nav-item ${active ? 'active' : ''}`}
      title={collapsed ? label : undefined}
    >
      <Icon size={18} />
      {!collapsed && <span>{label}</span>}
      {!collapsed && badge != null && badge > 0 && <em>{badge}</em>}
    </Link>
  );
}

export default function Layout({ user, onLogout, overdue = 0, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchRef = useRef(null);
  const loc = useLocation();
  const navigate = useNavigate();

  const isCustomer = user?.role === 'customer';
  const navItems = isCustomer ? CUSTOMER_NAV : ADMIN_NAV;
  const currentLabel = navItems.find(n => n.path === loc.pathname)?.label || 'Workspace';

  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchResults = [
    { label: 'Subscriptions', path: '/subscriptions', desc: 'Search recurring contracts' },
    { label: 'Invoices', path: '/invoices', desc: 'Search billing register' },
    { label: 'Customers', path: '/customers', desc: 'Search customer directory' },
    { label: 'Catalog & Plans', path: '/catalog', desc: 'Browse products & tiers' },
    { label: 'Reports', path: '/reports', desc: 'Analytics & MRR breakdown' },
    { label: 'Settings', path: '/settings', desc: 'System configuration' },
  ].filter(item =>
    !isCustomer || ['/portal', '/invoices', '/catalog', '/settings'].includes(item.path)
  ).filter(item =>
    !searchTerm.trim() || item.label.toLowerCase().includes(searchTerm.toLowerCase()) || item.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function loadNotifications() {
    try {
      const res = await api.get('/notifications?limit=10');
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Ignore background notification fetch errors
    }
  }

  useEffect(() => {
    loadNotifications();
  }, [loc.pathname]);

  async function handleMarkAllRead() {
    try {
      await api.post('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch {
      // Ignore
    }
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="shell">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <div className="brand-mark">b</div>
          {!collapsed && (
            <div>
              <b>brightloop</b>
              <small>{isCustomer ? 'CLIENT PORTAL' : 'SUBSCRIPTION OS'}</small>
            </div>
          )}
        </div>

        <div className="workspace">
          <div className="workspace-icon">{isCustomer ? 'C' : 'B'}</div>
          {!collapsed && (
            <div>
              <b>{isCustomer ? 'Customer Portal' : 'Brightloop Software'}</b>
              <small>{isCustomer ? 'Subscriber Workspace' : 'Business workspace'}</small>
            </div>
          )}
          <ChevronDown size={15} />
        </div>

        <div className="nav-label">{!collapsed ? (isCustomer ? 'PORTAL' : 'WORKSPACE') : ''}</div>
        <nav>
          {navItems.map(({ label, Icon, path }) => (
            <NavItem
              key={path}
              label={label}
              Icon={Icon}
              path={path}
              collapsed={collapsed}
              badge={path === '/invoices' ? overdue : undefined}
            />
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="nav-label">{!collapsed ? 'PREFERENCES' : ''}</div>
          <NavItem label="Settings" Icon={Settings} path="/settings" collapsed={collapsed} />
          <button className="collapse" onClick={() => setCollapsed(v => !v)}>
            <Menu size={17} />
            {!collapsed && ' Collapse sidebar'}
          </button>
        </div>

        <div className="profile">
          <div className="avatar">{user?.name?.[0] || 'U'}</div>
          {!collapsed && (
            <div className="profile-info">
              <b>{user?.name || 'Account'}</b>
              <small>{user?.role || 'user'}</small>
            </div>
          )}
          <button onClick={onLogout} title="Sign out">
            <LogOut size={17} />
          </button>
        </div>
      </aside>

      {/* ── Main Area ────────────────────────────────────────────────────── */}
      <main className="main">
        <header className="topbar">
          <div className="crumb">
            Workspace <span>/</span> <b>{currentLabel}</b>
          </div>
          <div className="top-actions" style={{ position: 'relative' }}>
            <div className="searchbox" ref={searchRef} style={{ position: 'relative' }}>
              <Search size={16} />
              <input
                placeholder="Jump to or search..."
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onFocus={() => setShowSearchDropdown(true)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && searchResults.length > 0) {
                    navigate(searchResults[0].path);
                    setShowSearchDropdown(false);
                    setSearchTerm('');
                  }
                }}
              />
              {showSearchDropdown && (
                <div
                  style={{
                    position: 'absolute',
                    top: '38px',
                    left: 0,
                    width: '260px',
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    zIndex: 60,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '8px 12px', fontSize: '9px', fontWeight: 700, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' }}>
                    QUICK NAVIGATION
                  </div>
                  {searchResults.slice(0, 5).map(res => (
                    <div
                      key={res.path}
                      onClick={() => {
                        navigate(res.path);
                        setShowSearchDropdown(false);
                        setSearchTerm('');
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f1f5f9'}
                      onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    >
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b' }}>{res.label}</div>
                      <div style={{ fontSize: '9px', color: '#64748b' }}>{res.desc}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notification Bell */}
            <button
              className="icon-btn"
              aria-label="Notifications"
              onClick={() => setShowNotifs(!showNotifs)}
            >
              <Bell size={18} />
              {unreadCount > 0 && <i />}
            </button>

            {/* Notification Popover Dropdown */}
            {showNotifs && (
              <div
                style={{
                  position: 'absolute',
                  top: '48px',
                  right: '40px',
                  width: '320px',
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                  zIndex: 50,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <b style={{ fontSize: '12px', color: '#1e293b' }}>Notifications</b>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: '#536fe0',
                        fontSize: '10px',
                        cursor: 'pointer',
                        fontWeight: 600,
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        style={{
                          padding: '10px 16px',
                          borderBottom: '1px solid #f8fafc',
                          background: n.is_read ? '#fff' : '#f0f7ff',
                        }}
                      >
                        <div style={{ fontSize: '11px', fontWeight: 600, color: '#1e293b' }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>
                          {n.message}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                      No notifications right now.
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="top-avatar" title={user?.name}>
              {user?.name?.[0] || 'U'}
            </div>
          </div>
        </header>

        <div className="content">{children}</div>
      </main>
    </div>
  );
}
