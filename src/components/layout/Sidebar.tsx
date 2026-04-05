'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitBranch,
  Play,
  Code2,
  Clock,
  Bell,
  Webhook,
  Users,
  LogOut,
  Workflow,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/types';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  minRole: UserRole;
}

const navItems: NavItem[] = [
  { href: '/dashboard',      label: 'Dashboard',     icon: LayoutDashboard, minRole: 'viewer' },
  { href: '/blueprints',     label: 'Blueprints',    icon: GitBranch,       minRole: 'viewer' },
  { href: '/runs',           label: 'Runs',          icon: Play,            minRole: 'viewer' },
  { href: '/scripts',        label: 'Scripts',       icon: Code2,           minRole: 'viewer' },
  { href: '/schedules',      label: 'Schedules',     icon: Clock,           minRole: 'viewer' },
  { href: '/notifications',  label: 'Notifications', icon: Bell,            minRole: 'viewer' },
  { href: '/webhooks',       label: 'Webhooks',      icon: Webhook,         minRole: 'editor' },
  { href: '/users',          label: 'Users',         icon: Users,           minRole: 'admin' },
];

const roleRank: Record<UserRole, number> = {
  admin: 4,
  editor: 3,
  executor: 2,
  viewer: 1,
};

const roleColors: Record<UserRole, string> = {
  admin:    'bg-red-500/20 text-red-300',
  editor:   'bg-indigo-500/20 text-indigo-300',
  executor: 'bg-blue-500/20 text-blue-300',
  viewer:   'bg-slate-500/20 text-slate-400',
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const userRank = user ? (roleRank[user.role] ?? 0) : 0;

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    logout();
    toast.success('Logged out');
    router.push('/login');
  };

  const visibleItems = navItems.filter(
    (item) => userRank >= roleRank[item.minRole]
  );

  return (
    <div className="flex flex-col h-full w-64 bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Workflow className="w-4 h-4 text-white" />
        </div>
        <span className="text-white font-bold text-lg tracking-tight">Flowcraft</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        {user && (
          <div className="px-3 py-3 rounded-lg bg-slate-800">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 text-slate-400 hover:text-white transition-colors flex-shrink-0"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
            <div className="mt-2">
              <span className={clsx('text-[11px] font-semibold px-1.5 py-0.5 rounded capitalize', roleColors[user.role])}>
                {user.role}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
