import React, { useState } from 'react';
import { Layout, Button, Avatar, Dropdown, Space, Typography, Drawer, Divider, App } from 'antd';
import type { MenuProps } from 'antd';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { Video, Calendar, Settings, LogOut, Menu as MenuIcon, X } from 'lucide-react';
import { useAuth } from '../../contexts';
import { LiveClock } from '../common/LiveClock';
import { APP_NAME, ROUTES } from '../../constants';
import { tokens } from '../../styles/tokens';
import type { UserStatus } from '../../types';

const { Header, Content, Footer } = Layout;
const { Text } = Typography;

export const MainLayout: React.FC = () => {
  const { user, isAuthenticated, logout, updateStatus } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const handleSignOut = () => {
    logout();
    message.success('Signed out successfully');
    navigate(ROUTES.HOME);
    setMobileDrawerOpen(false);
  };

  const navLinks = [
    { label: 'Home', path: ROUTES.HOME, icon: <Video size={16} /> },
    { label: 'History', path: ROUTES.HISTORY, icon: <Calendar size={16} /> },
    { label: 'Settings', path: ROUTES.SETTINGS, icon: <Settings size={16} /> },
  ];

  const statusColors: Record<UserStatus, string> = {
    online: tokens.colors.success,
    busy: tokens.colors.error,
    away: tokens.colors.warning,
    offline: tokens.colors.textMuted,
  };

  const profileMenuItems: MenuProps['items'] = [
    {
      key: 'user-info',
      disabled: true,
      label: (
        <div style={{ padding: '4px 0', cursor: 'default' }}>
          <div style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{user?.name}</div>
          <div style={{ fontSize: '12px', color: tokens.colors.textMuted }}>{user?.email}</div>
        </div>
      ),
    },
    { type: 'divider' },
    {
      key: 'status',
      label: 'Status',
      children: [
        {
          key: 'status-online',
          label: 'Available',
          onClick: () => updateStatus('online'),
        },
        {
          key: 'status-busy',
          label: 'Busy',
          onClick: () => updateStatus('busy'),
        },
        {
          key: 'status-away',
          label: 'Away',
          onClick: () => updateStatus('away'),
        },
      ],
    },
    {
      key: 'settings',
      icon: <Settings size={14} />,
      label: <Link to={ROUTES.SETTINGS}>Preferences</Link>,
    },
    {
      key: 'history',
      icon: <Calendar size={14} />,
      label: <Link to={ROUTES.HISTORY}>My Meetings</Link>,
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogOut size={14} />,
      label: 'Sign Out',
      danger: true,
      onClick: handleSignOut,
    },
  ];

  return (
    <div className="app-bg-wrapper">
      <Header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          background: 'rgba(255, 255, 255, 0.94)',
          backdropFilter: 'blur(8px)',
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          height: tokens.layout.headerHeight,
          lineHeight: tokens.layout.headerHeight,
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Logo and Name */}
        <Link
          to={ROUTES.HOME}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
          }}
        >
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: tokens.borderRadius.base,
              backgroundColor: tokens.colors.accentPrimaryLight,
              border: `1px solid ${tokens.colors.accentPrimaryBorder}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Video size={18} color={tokens.colors.accentPrimary} />
          </div>
          <span
            style={{
              fontSize: '17px',
              fontWeight: 600,
              color: tokens.colors.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            {APP_NAME}
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '28px',
          }}
          className="desktop-nav"
        >
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? tokens.colors.accentPrimary : tokens.colors.textSecondary,
                  textDecoration: 'none',
                  padding: '6px 0',
                  borderBottom: isActive
                    ? `2px solid ${tokens.colors.accentPrimary}`
                    : '2px solid transparent',
                }}
              >
                {link.icon}
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Right Action / Authentication Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="desktop-clock" style={{ display: 'none' }}>
            <LiveClock compact />
          </div>

          {isAuthenticated && user ? (
            <Dropdown
              menu={{ items: profileMenuItems }}
              trigger={['click']}
              placement="bottomRight"
            >
              <button
                type="button"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '4px 8px',
                  background: 'transparent',
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                  borderRadius: tokens.borderRadius.base,
                  cursor: 'pointer',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <Avatar
                    size={28}
                    style={{
                      backgroundColor: tokens.colors.accentPrimaryLight,
                      color: tokens.colors.accentPrimary,
                      fontWeight: 600,
                      fontSize: '13px',
                      border: `1px solid ${tokens.colors.accentPrimaryBorder}`,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <span
                    style={{
                      position: 'absolute',
                      bottom: '-1px',
                      right: '-1px',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: statusColors[user.status],
                      border: '1.5px solid #ffffff',
                    }}
                  />
                </div>
                <span
                  className="desktop-username"
                  style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: tokens.colors.textPrimary,
                    display: 'none',
                  }}
                >
                  {user.name}
                </span>
              </button>
            </Dropdown>
          ) : (
            <Space size={8} className="desktop-auth" style={{ display: 'none' }}>
              <Button type="default" onClick={() => navigate(ROUTES.LOGIN)}>
                Sign In
              </Button>
              <Button type="primary" onClick={() => navigate(ROUTES.REGISTER)}>
                Register
              </Button>
            </Space>
          )}

          {/* Mobile Menu Hamburger */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileDrawerOpen(true)}
            aria-label="Open Navigation Menu"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              background: 'transparent',
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              borderRadius: tokens.borderRadius.base,
              cursor: 'pointer',
              color: tokens.colors.textPrimary,
            }}
          >
            <MenuIcon size={18} />
          </button>
        </div>
      </Header>

      {/* Mobile Navigation Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Video size={18} color={tokens.colors.accentPrimary} />
            <span style={{ fontWeight: 600 }}>{APP_NAME}</span>
          </div>
        }
        placement="right"
        onClose={() => setMobileDrawerOpen(false)}
        open={mobileDrawerOpen}
        closeIcon={<X size={18} />}
        styles={{ wrapper: { width: 280 } }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ marginBottom: '20px' }}>
            <LiveClock compact />
          </div>

          <Divider style={{ margin: '12px 0' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileDrawerOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: tokens.borderRadius.base,
                    backgroundColor: isActive ? tokens.colors.accentPrimaryLight : 'transparent',
                    color: isActive ? tokens.colors.accentPrimary : tokens.colors.textPrimary,
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: 'none',
                  }}
                >
                  {link.icon}
                  {link.label}
                </Link>
              );
            })}
          </div>

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ marginTop: 'auto' }}>
            {isAuthenticated && user ? (
              <div
                style={{
                  padding: '12px',
                  backgroundColor: tokens.colors.surfaceSecondary,
                  borderRadius: tokens.borderRadius.base,
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    marginBottom: '12px',
                  }}
                >
                  <Avatar
                    size={36}
                    style={{
                      backgroundColor: tokens.colors.accentPrimaryLight,
                      color: tokens.colors.accentPrimary,
                      fontWeight: 600,
                    }}
                  >
                    {user.name.charAt(0).toUpperCase()}
                  </Avatar>
                  <div style={{ overflow: 'hidden' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: tokens.colors.textPrimary,
                      }}
                    >
                      {user.name}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        color: tokens.colors.textMuted,
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                </div>
                <Button danger block icon={<LogOut size={14} />} onClick={handleSignOut}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Button
                  block
                  onClick={() => {
                    navigate(ROUTES.LOGIN);
                    setMobileDrawerOpen(false);
                  }}
                >
                  Sign In
                </Button>
                <Button
                  type="primary"
                  block
                  onClick={() => {
                    navigate(ROUTES.REGISTER);
                    setMobileDrawerOpen(false);
                  }}
                >
                  Register
                </Button>
              </div>
            )}
          </div>
        </div>
      </Drawer>

      {/* Main Content Area */}
      <Content style={{ flex: 1, position: 'relative' }}>
        <Outlet />
      </Content>

      {/* Subtle Footer */}
      <Footer
        style={{
          background: 'transparent',
          borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
          padding: '20px 24px',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            maxWidth: tokens.layout.maxWidth,
            margin: '0 auto',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <Text style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
            {APP_NAME} &copy; 2026. Production-grade video communication.
          </Text>
          <Space size={16} orientation="horizontal">
            <Link
              to={ROUTES.HOME}
              style={{ fontSize: '13px', color: tokens.colors.textMuted, textDecoration: 'none' }}
            >
              Home
            </Link>
            <Link
              to={ROUTES.HISTORY}
              style={{ fontSize: '13px', color: tokens.colors.textMuted, textDecoration: 'none' }}
            >
              History
            </Link>
            <Link
              to={ROUTES.SETTINGS}
              style={{ fontSize: '13px', color: tokens.colors.textMuted, textDecoration: 'none' }}
            >
              Settings
            </Link>
          </Space>
        </div>
      </Footer>

      {/* Responsive media query overrides */}
      <style>{`
        @media (min-width: 768px) {
          .desktop-nav {
            display: flex !important;
          }
          .desktop-clock {
            display: block !important;
          }
          .desktop-username {
            display: inline !important;
          }
          .desktop-auth {
            display: flex !important;
          }
          .mobile-menu-btn {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
