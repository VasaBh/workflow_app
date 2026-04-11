"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { useNotificationStore } from "@/store/notifications";
import { authApi } from "@/lib/api";
import Sidebar, { navItems } from "./Sidebar";
import NotificationBell from "@/components/ui/NotificationBell";
import NotificationToast from "@/components/ui/NotificationToast";
import GettingStarted, { useGettingStarted } from "@/components/ui/GettingStarted";
import { unlockAudio } from "@/lib/notificationSounds";

interface AppShellProps {
  children: React.ReactNode;
  title?: string;
}

export default function AppShell({ children, title }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, setUser, setToken } = useAuthStore();
  const { hydrate } = useNotificationStore();
  const { open: guideOpen, setOpen: setGuideOpen } = useGettingStarted();

  const navItem = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/"),
  );
  const NavIcon = navItem?.icon ?? null;

  useEffect(() => {
    // Hydrate notification settings on mount
    hydrate();
  }, [hydrate]);

  // Unlock Web Audio API on first user interaction so WS-triggered sounds work
  useEffect(() => {
    const unlock = () => unlockAudio();
    document.addEventListener("click", unlock, { once: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("click", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    // If not authenticated, try to restore session (noop for in-memory auth) else redirect
    if (!isAuthenticated) {
      // Check if there's a stored token attempt — for now, redirect to login
      router.replace("/login");
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    // Optionally refresh user profile on mount
    if (isAuthenticated) {
      authApi
        .me()
        .then((res) => {
          setUser(res.data);
        })
        .catch(() => {
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
      <Sidebar onGetStarted={() => setGuideOpen(true)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex-shrink-0 h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6">
          <h1 className="flex items-center gap-2.5 text-lg font-semibold text-slate-100">
            {NavIcon && (
              <NavIcon className="w-5 h-5 text-slate-400 flex-shrink-0" />
            )}
            {title ?? "Flowcraft"}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700 hover:border-slate-600"
              title="Get Started guide"
            >
              <span>?</span> Help
            </button>
            <NotificationBell />
          </div>
        </header>
        {/* Main content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
      {/* Global floating notification toast */}
      <NotificationToast />
      {/* Get Started guide */}
      <GettingStarted open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
