'use client';

import React, { useState, useEffect, useRef } from 'react';
import SideNavigation from '@cloudscape-design/components/side-navigation';
import AppLayout from '@cloudscape-design/components/app-layout';
import BreadcrumbGroup from '@cloudscape-design/components/breadcrumb-group';
import Flashbar, { FlashbarProps } from '@cloudscape-design/components/flashbar';
import Modal from '@cloudscape-design/components/modal';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
import { applyMode, Mode } from '@cloudscape-design/global-styles';
import { useRouter, usePathname } from 'next/navigation';
import {
  api,
  AuthUser,
  clearSession,
  FlashNotificationPayload,
  getStoredToken,
  getStoredUser,
  notify,
  saveSession,
} from '../lib/api';

interface ConsoleLayoutProps {
  children: React.ReactNode;
  breadcrumbs?: Array<{ text: string; href: string }>;
  contentType?: 'default' | 'table' | 'form' | 'cards';
  defaultNavOpen?: boolean;
  hideBreadcrumbs?: boolean;
  disableContentPaddings?: boolean;
}

const QUICK_ROUTES = [
  { label: 'Amazon Route 53 (Overview)', href: '/', desc: 'Service landing page' },
  { label: 'Dashboard', href: '/dashboard', desc: 'Route 53 resource overview & metrics' },
  { label: 'Hosted zones', href: '/hosted-zones', desc: 'Manage domains and DNS records' },
  { label: 'Create hosted zone', href: '/hosted-zones/create', desc: 'Create a public or private hosted zone' },
  { label: 'Health checks', href: '/health-checks', desc: 'Monitor endpoint availability' },
  { label: 'Traffic policies', href: '/traffic-policies', desc: 'Create DNS traffic flow policies' },
  { label: 'Policy records', href: '/policy-records', desc: 'Associate traffic policies with hosted zones' },
  { label: 'Resolver', href: '/resolver', desc: 'Inbound & outbound VPC DNS endpoints and rules' },
  { label: 'Profiles', href: '/profiles', desc: 'Share Route 53 configurations across VPCs' },
];

const SHORTCUTS_LIST = [
  { key: 'Alt + S', action: 'Focus global AWS Console search bar' },
  { key: 'Alt + H', action: 'Go to Hosted zones' },
  { key: 'Alt + D', action: 'Go to Dashboard' },
  { key: 'Alt + N', action: 'Go to Create hosted zone' },
  { key: 'Alt + C', action: 'Go to Health checks' },
  { key: 'Alt + T', action: 'Toggle Dark / Light mode' },
  { key: '?', action: 'Open keyboard shortcuts reference' },
  { key: 'Esc', action: 'Close open menus and modals' },
];

export default function ConsoleLayout({
  children,
  breadcrumbs = [
    { text: 'Route 53', href: '/' },
    { text: 'Hosted zones', href: '/hosted-zones' },
  ],
  contentType = 'table',
  defaultNavOpen,
  hideBreadcrumbs = false,
  disableContentPaddings = false,
}: ConsoleLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(
    defaultNavOpen !== undefined ? defaultNavOpen : pathname !== '/'
  );
  const [darkMode, setDarkMode] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notifications, setNotifications] = useState<FlashbarProps.MessageDefinition[]>([]);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [openMenu, setOpenMenu] = useState<'services' | 'notif' | 'help' | 'settings' | 'account' | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Sync theme preference & responsive nav drawer from viewport
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedTheme = window.localStorage.getItem('r53_dark_mode');
    if (savedTheme !== null) {
      setDarkMode(savedTheme === 'true');
    }
    if (defaultNavOpen === undefined && window.innerWidth < 960) {
      setNavigationOpen(false);
    }
  }, [defaultNavOpen]);

  useEffect(() => {
    applyMode(darkMode ? Mode.Dark : Mode.Light);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('awsui-dark-mode', darkMode);
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('r53_dark_mode', String(darkMode));
    }
  }, [darkMode]);

  // Auth guard & session sync
  useEffect(() => {
    setUser(getStoredUser());
    const token = getStoredToken();
    const isPublicRoute = pathname === '/' || pathname === '/login';

    if (!token && !isPublicRoute) {
      router.replace('/login');
      return;
    }

    if (token) {
      api
        .get('/auth/me')
        .then((res) => {
          const freshUser: AuthUser = {
            id: res.data.id,
            username: res.data.username,
            account_id: res.data.account_id,
          };
          setUser(freshUser);
          saveSession(token, freshUser);
        })
        .catch(() => {
          // 401 interceptor handles clearing session and redirecting when appropriate
        });
    }

    const onAuthChanged = () => setUser(getStoredUser());
    window.addEventListener('r53-auth-changed', onAuthChanged);
    return () => window.removeEventListener('r53-auth-changed', onAuthChanged);
  }, [pathname, router]);

  // Global Flashbar notifications listener
  useEffect(() => {
    const onNotify = (ev: Event) => {
      const detail = (ev as CustomEvent<FlashNotificationPayload & { id: string }>).detail;
      if (!detail) return;
      const itemId = detail.id || String(Date.now());
      const newItem: FlashbarProps.MessageDefinition = {
        id: itemId,
        type: detail.type,
        header: detail.header,
        content: detail.content,
        dismissible: true,
        dismissLabel: 'Dismiss notification',
        onDismiss: () => {
          setNotifications((prev) => prev.filter((n) => n.id !== itemId));
        },
      };
      setNotifications((prev) => [newItem, ...prev].slice(0, 4));

      if (detail.type !== 'error') {
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== itemId));
        }, 5000);
      }
    };
    window.addEventListener('r53-notify', onNotify);
    return () => window.removeEventListener('r53-notify', onNotify);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        router.push('/hosted-zones');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        router.push('/dashboard');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push('/hosted-zones/create');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        router.push('/health-checks');
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        setDarkMode((prev) => !prev);
        return;
      }
      if (!isTyping && e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        setSearchFocused(false);
        setOpenMenu(null);
        setShortcutsOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  const handleSignOut = () => {
    setOpenMenu(null);
    clearSession();
    notify({ type: 'info', header: 'Signed out of AWS Route 53 Console' });
    router.push('/login');
  };

  const searchMatches = QUICK_ROUTES.filter(
    (r) =>
      r.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.desc.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const navigate = (href: string) => {
    setOpenMenu(null);
    setSearchFocused(false);
    setSearchQuery('');
    router.push(href);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: darkMode ? '#0f141a' : '#f2f3f3' }}>
      {/* Authentic AWS Console Top Header */}
      <header className="aws-console-header">
        {/* Left: AWS Logo + Services + Global Search */}
        <div className="aws-header-left">
          {/* AWS Logo */}
          <div
            onClick={() => navigate('/')}
            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, paddingRight: 4, flexShrink: 0 }}
            title="AWS Home / Route 53 Overview"
          >
            <svg width="34" height="22" viewBox="0 0 40 24" fill="none">
              <text x="2" y="15" fill="#ffffff" fontSize="14" fontWeight="800" fontFamily="Arial, sans-serif">
                aws
              </text>
              <path d="M4 18.5C11 22.5 23 22.5 31 18.5" stroke="#ff9900" strokeWidth="2" strokeLinecap="round" />
              <path d="M29 17.5L32.5 18.3L30.8 21.5" stroke="#ff9900" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <span className="aws-hide-sm" style={{ color: '#3b4754' }}>|</span>

          {/* AI Sparkle icon */}
          <button
            type="button"
            className="aws-hide-sm"
            onClick={() => navigate('/dashboard')}
            title="Route 53 Dashboard"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#d1d5db',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" />
            </svg>
          </button>

          {/* Services 9-dot Grid */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'services' ? null : 'services')}
              title="Services"
              style={{
                background: openMenu === 'services' ? '#1f2937' : 'transparent',
                border: 'none',
                borderRadius: 4,
                color: '#d1d5db',
                cursor: 'pointer',
                padding: 5,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="3" height="3" rx="0.5" />
                <rect x="6.5" y="1" width="3" height="3" rx="0.5" />
                <rect x="12" y="1" width="3" height="3" rx="0.5" />
                <rect x="1" y="6.5" width="3" height="3" rx="0.5" />
                <rect x="6.5" y="6.5" width="3" height="3" rx="0.5" />
                <rect x="12" y="6.5" width="3" height="3" rx="0.5" />
                <rect x="1" y="12" width="3" height="3" rx="0.5" />
                <rect x="6.5" y="12" width="3" height="3" rx="0.5" />
                <rect x="12" y="12" width="3" height="3" rx="0.5" />
              </svg>
            </button>
            {openMenu === 'services' ? (
              <div
                style={{
                  position: 'absolute',
                  top: 36,
                  left: 0,
                  width: 280,
                  maxWidth: 'calc(100vw - 24px)',
                  backgroundColor: '#161d26',
                  border: '1px solid #354150',
                  borderRadius: 8,
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 1100,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8d99a6', padding: '4px 8px', textTransform: 'uppercase' }}>
                  Network &amp; Content Delivery
                </div>
                {QUICK_ROUTES.map((item) => (
                  <div
                    key={item.href}
                    onClick={() => navigate(item.href)}
                    style={{
                      padding: '7px 10px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      color: '#e5e7eb',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#232f3e')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{ fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: '#8d99a6' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Search Input */}
          <div className="aws-header-search">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#161d26',
                border: searchFocused ? '1px solid #539fe5' : '1px solid #414d5c',
                borderRadius: 8,
                padding: '3px 10px',
                gap: 8,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ba7b6" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21L16.65 16.65" />
              </svg>
              <input
                id="aws-console-search"
                name="aws_console_search"
                aria-label="Search Route 53 pages"
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 180)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchMatches.length > 0) {
                    navigate(searchMatches[0].href);
                  }
                }}
                placeholder="Search"
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: 13,
                  width: '100%',
                  minWidth: 0,
                }}
              />
              <span className="aws-hide-sm" style={{ fontSize: 11, color: '#9ba7b6', whiteSpace: 'nowrap' }}>[Alt+S] ✦</span>
            </div>

            {searchFocused ? (
              <div
                style={{
                  position: 'absolute',
                  top: 34,
                  left: 0,
                  right: 0,
                  backgroundColor: '#161d26',
                  border: '1px solid #354150',
                  borderRadius: 8,
                  padding: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 1100,
                }}
              >
                {searchMatches.length === 0 ? (
                  <div style={{ padding: 8, color: '#8d99a6', fontSize: 12 }}>No matching Route 53 pages</div>
                ) : (
                  searchMatches.map((m) => (
                    <div
                      key={m.href}
                      onMouseDown={() => navigate(m.href)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#232f3e')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <div style={{ fontWeight: 600, color: '#539fe5' }}>{m.label}</div>
                      <div style={{ fontSize: 11, color: '#8d99a6' }}>{m.desc}</div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: CloudShell, Bell, Help, Settings, Global, User */}
        <div className="aws-header-right">
          {/* CloudShell */}
          <button
            type="button"
            className="aws-hide-sm"
            onClick={() => navigate('/hosted-zones')}
            title="Hosted zones"
            style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M7 9L10 12L7 15M12 15H16" />
            </svg>
          </button>

          {/* Notification Bell */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'notif' ? null : 'notif')}
              title="Notifications"
              style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 4, position: 'relative' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -4,
                  backgroundColor: '#ec7211',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: '50%',
                  width: 15,
                  height: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                1
              </span>
            </button>
            {openMenu === 'notif' ? (
              <div
                style={{
                  position: 'absolute',
                  top: 34,
                  right: 0,
                  width: 260,
                  backgroundColor: '#161d26',
                  border: '1px solid #354150',
                  borderRadius: 8,
                  padding: 12,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 1100,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>AWS Health</div>
                <div style={{ fontSize: 12, color: '#9ba7b6' }}>
                  Amazon Route 53 (Global) is operating normally. All DNS &amp; Health Check services are healthy.
                </div>
              </div>
            ) : null}
          </div>

          {/* Help */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'help' ? null : 'help')}
              title="Support & Documentation"
              style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
            {openMenu === 'help' ? (
              <div
                style={{
                  position: 'absolute',
                  top: 34,
                  right: 0,
                  width: 220,
                  backgroundColor: '#161d26',
                  border: '1px solid #354150',
                  borderRadius: 8,
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 1100,
                }}
              >
                <a className="aws-link" style={{ display: 'block', padding: '6px 8px' }} href="https://docs.aws.amazon.com/route53/" target="_blank" rel="noreferrer">
                  Route 53 Documentation ↗
                </a>
                <a
                  className="aws-link"
                  style={{ display: 'block', padding: '6px 8px' }}
                  href={`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/docs`}
                  target="_blank"
                  rel="noreferrer"
                >
                  API Reference (Swagger) ↗
                </a>
                <div
                  onClick={() => {
                    setOpenMenu(null);
                    setShortcutsOpen(true);
                  }}
                  style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4, color: '#539fe5' }}
                >
                  Keyboard shortcuts (?)
                </div>
              </div>
            ) : null}
          </div>

          {/* Quick Theme Toggle (Dark / Light) */}
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            title={darkMode ? 'Switch to Light mode (Alt+T)' : 'Switch to Dark mode (Alt+T)'}
            style={{
              background: 'transparent',
              border: '1px solid #354150',
              borderRadius: 6,
              color: '#d1d5db',
              cursor: 'pointer',
              padding: '3px 8px',
              fontSize: 11,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              whiteSpace: 'nowrap',
            }}
          >
            {darkMode ? '☀ Light' : '☾ Dark'}
          </button>

          {/* Quick Keyboard Shortcuts Button */}
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            style={{
              background: 'transparent',
              border: '1px solid #354150',
              borderRadius: 6,
              color: '#d1d5db',
              cursor: 'pointer',
              padding: '3px 7px',
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            }}
          >
            ?
          </button>

          {/* Settings (Theme Toggle) */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setOpenMenu(openMenu === 'settings' ? null : 'settings')}
              title="Console Settings"
              style={{ background: 'transparent', border: 'none', color: '#d1d5db', cursor: 'pointer', padding: 4 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            {openMenu === 'settings' ? (
              <div
                style={{
                  position: 'absolute',
                  top: 34,
                  right: 0,
                  width: 210,
                  backgroundColor: '#161d26',
                  border: '1px solid #354150',
                  borderRadius: 8,
                  padding: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                  zIndex: 1100,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Display</div>
                <button
                  type="button"
                  onClick={() => {
                    setDarkMode(!darkMode);
                    setOpenMenu(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #414d5c',
                    backgroundColor: '#232f3e',
                    color: '#ffffff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: 8,
                  }}
                >
                  Switch to {darkMode ? 'Light' : 'Dark'} mode
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpenMenu(null);
                    setShortcutsOpen(true);
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: '1px solid #414d5c',
                    backgroundColor: '#161d26',
                    color: '#d1d5db',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  Keyboard shortcuts (?)
                </button>
              </div>
            ) : null}
          </div>

          <span className="aws-hide-sm" style={{ color: '#e5e7eb', fontWeight: 500, whiteSpace: 'nowrap' }}>Global ▾</span>

          {/* Account Menu */}
          <div style={{ position: 'relative' }}>
            {user ? (
              <>
                <button
                  type="button"
                  onClick={() => setOpenMenu(openMenu === 'account' ? null : 'account')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    textAlign: 'right',
                    lineHeight: 1.15,
                    padding: '2px 4px',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>
                    {user.username} ({(user.account_id || '1793-0234-9211').replace(/-/g, '')}) ▾
                  </div>
                  <div style={{ fontSize: 11, color: '#9ba7b6' }}>{user.username}</div>
                </button>
                {openMenu === 'account' ? (
                  <div
                    style={{
                      position: 'absolute',
                      top: 38,
                      right: 0,
                      width: 230,
                      backgroundColor: '#161d26',
                      border: '1px solid #354150',
                      borderRadius: 8,
                      padding: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      zIndex: 1100,
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#9ba7b6', marginBottom: 4 }}>
                      IAM User: <strong style={{ color: '#ffffff' }}>{user.username}</strong>
                    </div>
                    <div style={{ fontSize: 12, color: '#9ba7b6', marginBottom: 8 }}>
                      Account ID: {user.account_id || '1793-0234-9211'}
                    </div>
                    <div style={{ borderTop: '1px solid #2b3645', paddingTop: 8 }}>
                      <div
                        onClick={() => navigate('/dashboard')}
                        style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4 }}
                      >
                        Route 53 Dashboard
                      </div>
                      <div
                        onClick={() => navigate('/hosted-zones')}
                        style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4 }}
                      >
                        Hosted zones
                      </div>
                      <div
                        onClick={() => {
                          setOpenMenu(null);
                          setShortcutsOpen(true);
                        }}
                        style={{ padding: '6px 8px', cursor: 'pointer', borderRadius: 4 }}
                      >
                        Keyboard shortcuts (?)
                      </div>
                      <div style={{ borderTop: '1px solid #2b3645', marginTop: 6, paddingTop: 6 }}>
                        <button
                          type="button"
                          onClick={handleSignOut}
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            borderRadius: 6,
                            border: '1px solid #ff9900',
                            backgroundColor: 'transparent',
                            color: '#ff9900',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Sign out
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <button
                type="button"
                onClick={() => router.push('/login')}
                style={{
                  backgroundColor: '#ff9900',
                  color: '#0f141a',
                  border: 'none',
                  borderRadius: 14,
                  padding: '4px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign in (IAM)
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main AppLayout */}
      <div style={{ flex: 1 }}>
        <AppLayout
          contentType={contentType}
          navigationOpen={navigationOpen}
          onNavigationChange={({ detail }) => setNavigationOpen(detail.open)}
          toolsHide={true}
          disableContentPaddings={disableContentPaddings}
          notifications={notifications.length > 0 ? <Flashbar items={notifications} /> : undefined}
          breadcrumbs={
            hideBreadcrumbs ? undefined : (
              <BreadcrumbGroup
                items={breadcrumbs}
                onFollow={(event) => {
                  event.preventDefault();
                  router.push(event.detail.href);
                }}
              />
            )
          }
          navigation={
            <SideNavigation
              activeHref={pathname}
              header={{
                href: '/',
                text: 'Route 53',
              }}
              onFollow={(event) => {
                event.preventDefault();
                router.push(event.detail.href);
              }}
              items={[
                { type: 'link', text: 'Overview', href: '/' },
                { type: 'link', text: 'Dashboard', href: '/dashboard' },
                { type: 'link', text: 'Hosted zones', href: '/hosted-zones' },
                { type: 'divider' },
                {
                  type: 'section',
                  text: 'Traffic management',
                  items: [
                    { type: 'link', text: 'Traffic policies', href: '/traffic-policies' },
                    { type: 'link', text: 'Policy records', href: '/policy-records' },
                  ],
                },
                {
                  type: 'section',
                  text: 'Availability monitoring',
                  items: [
                    { type: 'link', text: 'Health checks', href: '/health-checks' },
                  ],
                },
                {
                  type: 'section',
                  text: 'DNS Firewall & Resolver',
                  items: [
                    { type: 'link', text: 'Resolver', href: '/resolver' },
                    { type: 'link', text: 'Profiles', href: '/profiles' },
                  ],
                },
              ]}
            />
          }
          content={children}
        />
      </div>

      {/* Authentic AWS Console Footer */}
      <footer className="aws-console-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span>&gt;_ CloudShell</span>
          <span>Agent Toolkit for AWS</span>
          <span>Feedback</span>
          <span
            style={{ cursor: 'pointer', color: '#539fe5' }}
            onClick={() => setShortcutsOpen(true)}
          >
            Keyboard shortcuts (?)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <span>© 2026, Amazon Web Services, Inc. or its affiliates.</span>
          <span>Privacy</span>
          <span>Terms</span>
          <span>Cookie preferences</span>
        </div>
      </footer>

      <Modal
        visible={shortcutsOpen}
        onDismiss={() => setShortcutsOpen(false)}
        header="Keyboard shortcuts"
        footer={
          <Box float="right">
            <Button variant="primary" onClick={() => setShortcutsOpen(false)}>
              Close
            </Button>
          </Box>
        }
      >
        <Table
          variant="embedded"
          columnDefinitions={[
            {
              id: 'key',
              header: 'Shortcut',
              cell: (item) => <code>{item.key}</code>,
              width: 140,
            },
            {
              id: 'action',
              header: 'Action',
              cell: (item) => item.action,
            },
          ]}
          items={SHORTCUTS_LIST}
        />
      </Modal>
    </div>
  );
}
