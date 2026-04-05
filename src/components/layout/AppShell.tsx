'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api';
import Sidebar from './Sidebar';
import NotificationBell from '@/components/ui/NotificationBell';

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const router = useRouter();
  const { isAuthenticated, setUser, setToken } = useAuthStore();

  useEffect(() => {
    // If not authenticated, try to restore session (noop for in-memory auth) else redirect
    if (!isAuthenticated) {
      // Check if there's a stored token attempt — for now, redirect to login
      router.replace('/login');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Optionally refresh user profile on mount
    if (isAuthenticated) {
      authApi.me().then((res) => {
        setUser(res.data);
      }).catch(() => {
        // silently fail
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6">
          <h1 className="text-lg font-semibold text-slate-100">{title ?? 'Flowcraft'}</h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
