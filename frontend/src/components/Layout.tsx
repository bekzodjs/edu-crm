import { useState } from 'react';
import { NavLink, Navigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Layers,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
  Wallet,
  FileText,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Sun,
  Moon,
  UserCircle,
} from './icons';
import { useAuth } from '../context/AuthContext';
import { AppRole } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { STATIC_URL } from '../api/client';
import ConfirmDialog from './ConfirmDialog';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: any;
  roles?: AppRole[];
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [{ to: '/', label: 'Bosh sahifa', end: true, icon: LayoutDashboard }],
  },
  {
    title: "Ta'lim",
    items: [
      { to: '/students', label: "O'quvchilar", icon: Users },
      { to: '/groups', label: 'Guruhlar', icon: Layers },
      { to: '/teachers', label: "O'qituvchilar", icon: GraduationCap, roles: ['SUPERADMIN', 'ADMIN', 'RAHBAR'] },
      { to: '/schedule', label: 'Dars jadvali', icon: CalendarDays },
    ],
  },
  {
    items: [
      { to: '/attendance', label: 'Davomat', icon: ClipboardCheck },
      { to: '/payments', label: "To'lovlar", icon: Wallet, roles: ['SUPERADMIN', 'ADMIN', 'RAHBAR'] },
    ],
  },
  {
    title: 'Boshqaruv',
    items: [
      { to: '/arizalar', label: 'Arizalar', icon: FileText },
      { to: '/users', label: 'Sozlamalar', icon: Settings, roles: ['SUPERADMIN', 'ADMIN'] },
    ],
  },
];

const ROLE_LABELS: Record<AppRole, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Administrator',
  RAHBAR: 'Rahbar',
  TEACHER: "O'qituvchi",
};

export function ProtectedRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Layout />;
}

function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [confirmLogout, setConfirmLogout] = useState(false);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sidebar_collapsed', next ? '1' : '0');
      } catch {}
      return next;
    });
  }

  return (
    <div className="h-screen flex overflow-hidden">
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen overflow-y-auto transition-all duration-200 ${
          collapsed ? 'w-[76px]' : 'w-64'
        }`}
      >
        <div className="px-4 py-4 border-b border-slate-100 flex items-center justify-between">
          {!collapsed && (
            <div>
              <div className="font-semibold text-brand-700 text-lg leading-tight">Edu CRM</div>
              <div className="text-xs text-slate-400">O'quv markazi boshqaruvi</div>
            </div>
          )}
          <button
            className="btn-ghost !px-2 !py-2 ml-auto"
            onClick={toggleCollapsed}
            title={collapsed ? "Sidebar'ni ochish" : "Sidebar'ni yig'ish"}
          >
            {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="flex-1 min-h-0 py-3 overflow-y-auto">
          {navGroups.map((group, gi) => {
            const items = group.items.filter((l) => !l.roles || (user?.role && l.roles.includes(user.role)));
            if (!items.length) return null;
            return (
              <div key={gi} className={gi > 0 ? 'mt-4' : undefined}>
                {group.title && !collapsed && (
                  <div className="px-5 mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.title}
                  </div>
                )}
                {group.title && collapsed && <div className="mx-3 mb-2 border-t border-slate-100" />}
                {items.map((l) => {
                  const Icon = l.icon;
                  return (
                    <NavLink
                      key={l.to}
                      to={l.to}
                      end={l.end}
                      title={collapsed ? l.label : undefined}
                      className={({ isActive }) =>
                        `flex items-center gap-3 mx-2 mb-1 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50'
                        }`
                      }
                    >
                      <Icon size={18} className="shrink-0" />
                      {!collapsed && <span className="truncate">{l.label}</span>}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-2">
          <button
            className="btn-ghost !px-2.5 !py-2 flex-1 justify-center"
            onClick={toggleTheme}
            title={theme === 'dark' ? "Kunduzgi rejimga o'tish" : 'Tungi rejimga o\'tish'}
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            {!collapsed && <span className="ml-1.5">{theme === 'dark' ? 'Kunduzgi' : 'Tungi'} rejim</span>}
          </button>
        </div>

        <div className="px-4 py-4 border-t border-slate-100">
          {!collapsed && (
            <NavLink to="/profile" className="flex items-center gap-2.5 mb-3 group">
              {user?.avatarUrl ? (
                <img src={`${STATIC_URL}${user.avatarUrl}`} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center shrink-0">
                  <UserCircle size={20} />
                </div>
              )}
              <div className="min-w-0">
                <div className="text-sm font-medium truncate group-hover:text-brand-700">{user?.name}</div>
                <div className="text-xs text-slate-400">{ROLE_LABELS[user?.role as AppRole] || user?.role}</div>
              </div>
            </NavLink>
          )}
          <button
            className="flex items-center gap-2 text-xs text-red-600 hover:underline"
            onClick={() => setConfirmLogout(true)}
            title={collapsed ? 'Chiqish' : undefined}
          >
            <LogOut size={14} />
            {!collapsed && 'Chiqish'}
          </button>
        </div>
      </aside>

      <main className="flex-1 h-screen overflow-y-auto p-6 max-w-6xl">
        <Outlet />
      </main>

      <ConfirmDialog
        open={confirmLogout}
        title="Tizimdan chiqmoqchimisiz?"
        description="Qayta kirish uchun telefon va parolingizni kiritishingiz kerak bo'ladi."
        confirmLabel="Ha, chiqish"
        cancelLabel="Yo'q"
        danger
        onConfirm={() => {
          setConfirmLogout(false);
          logout();
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </div>
  );
}
