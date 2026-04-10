"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  X,
  Loader2,
  Radio,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { createNotificationWebSocket } from "@/lib/ws";
import { getAccessToken } from "@/lib/api";
import { Notification } from "@/types";
import { formatDistanceToNow } from "date-fns";
import clsx from "clsx";
import Link from "next/link";
import { useNotificationStore } from "@/store/notifications";
import { playNotificationSound } from "@/lib/notificationSounds";

const EVENT_COLORS: Record<string, string> = {
  run_completed: "bg-green-900/40 text-green-300",
  run_failed: "bg-red-900/40 text-red-300",
  run_started: "bg-blue-900/40 text-blue-300",
  step_pending: "bg-orange-900/40 text-orange-300",
  step_failed: "bg-red-900/40 text-red-300",
  schedule_triggered: "bg-indigo-900/40 text-indigo-300",
};

export default function NotificationBell() {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { settings, toggleSound, toggleAnimations, hydrate, setLiveMessage, liveMessage } =
    useNotificationStore();
  const wsRef = useRef<WebSocket | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [bellFlash, setBellFlash] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const liveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const shownToastIds = useRef<Set<string>>(new Set());
  const lastWsFiredRef = useRef<number>(0);

  // Hydrate settings on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const { data: countData } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return res.data as { unread_count: number };
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["notifications", "dropdown"],
    queryFn: async () => {
      const res = await notificationsApi.list({ page: 1, limit: 20 });
      return res.data;
    },
    enabled: isAuthenticated && open,
    refetchInterval: open ? 15_000 : false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = getAccessToken();
    if (!token) return;
    const ws = createNotificationWebSocket(token, (data) => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
      lastWsFiredRef.current = Date.now();

      // Flash bell
      setBellFlash(true);
      setTimeout(() => setBellFlash(false), 1200);

      const raw = data as Record<string, unknown>;
      // Handle both direct `{title, message}` and wrapped `{data: {...}}` formats
      const msg = (raw?.notification ?? raw?.data ?? raw) as Record<string, unknown>;
      if (msg && (msg.title || msg.message)) {
        const eventType = msg.event_type ? String(msg.event_type) : undefined;
        const notifId = msg.id ? String(msg.id) : null;
        if (notifId) shownToastIds.current.add(notifId);

        // Play notification sound if enabled
        if (settings.enableSound && eventType) {
          playNotificationSound(
            eventType as any,
            settings.soundVolume,
          ).catch((err) => console.warn("Failed to play sound:", err));
        }

        setLiveMessage({
          title: String(msg.title ?? ""),
          message: String(msg.message ?? ""),
          event_type: eventType,
        });
        if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
        liveTimerRef.current = setTimeout(() => setLiveMessage(null), 8000);
      }
    });
    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    wsRef.current = ws;
    return () => {
      ws.close();
      if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
    };
  }, [isAuthenticated, qc, settings]);

  // Polling fallback: if count increases but WS didn't fire (connection issue, page was
  // backgrounded, etc.) — fetch the latest notification and trigger toast + sound.
  useEffect(() => {
    const currentCount = countData?.unread_count ?? 0;
    const prev = prevCountRef.current;
    prevCountRef.current = currentCount;

    if (prev === null || currentCount <= prev) return;

    // WS already handled this notification within the last 5 seconds — skip
    if (Date.now() - lastWsFiredRef.current < 5000) return;

    notificationsApi
      .list({ page: 1, limit: 1 })
      .then((res) => {
        const latest = res.data?.items?.[0];
        if (!latest || latest.read || shownToastIds.current.has(latest.id)) return;

        shownToastIds.current.add(latest.id);
        setBellFlash(true);
        setTimeout(() => setBellFlash(false), 1200);

        const { settings: s } = useNotificationStore.getState();
        if (s.enableSound) {
          playNotificationSound(
            latest.event_type as any,
            s.soundVolume,
          ).catch(console.warn);
        }
        setLiveMessage({
          title: latest.title,
          message: latest.message,
          event_type: latest.event_type,
        });
        if (liveTimerRef.current) clearTimeout(liveTimerRef.current);
        liveTimerRef.current = setTimeout(() => setLiveMessage(null), 8000);
      })
      .catch(console.warn);
  }, [countData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const count = countData?.unread_count ?? 0;
  const notifications: Notification[] = data?.items ?? [];

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors",
          bellFlash && settings.enableAnimations && "animate-notification-bounce",
        )}
        aria-label="Notifications"
      >
        <Bell
          className={clsx(
            "w-5 h-5 transition-transform",
            bellFlash && settings.enableAnimations && "animate-notification-ring",
          )}
        />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 animate-pulse">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-96 max-h-[520px] flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 animate-notification-slide-down">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-200">
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200"
                  title="Mark all read"
                >
                  <CheckCheck className="w-3.5 h-3.5" /> All read
                </button>
              )}
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-slate-500 hover:text-slate-300 p-1 hover:bg-slate-800 rounded transition-colors"
                title="Notification settings"
              >
                {settings.enableSound ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {showSettings && (
            <div className="px-4 py-3 border-b border-slate-700 bg-slate-800/50 flex-shrink-0 space-y-3 animate-notification-slide-down">
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableSound}
                    onChange={() => toggleSound()}
                    className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">
                    Enable sound notifications
                  </span>
                </label>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enableAnimations}
                    onChange={() => toggleAnimations()}
                    className="w-4 h-4 rounded border-slate-600 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-300">
                    Enable visual notifications
                  </span>
                </label>
              </div>

              {settings.enableSound && (
                <div>
                  <label className="text-xs text-slate-400 block mb-2">
                    Volume
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.soundVolume * 100}
                    onChange={(e) => {
                      const { setSettings } = useNotificationStore.getState();
                      setSettings({
                        soundVolume: parseInt(e.target.value) / 100,
                      });
                    }}
                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    Volume: {Math.round(settings.soundVolume * 100)}%
                  </div>
                </div>
              )}

              <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-700">
                Sounds & toasts: Run started, Run completed, Run failed
              </div>
            </div>
          )}

          {/* Status bar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-700/60 bg-slate-800/40 flex-shrink-0">
            {isLoading ? (
              <>
                <Loader2 className="w-3 h-3 text-indigo-400 animate-spin flex-shrink-0" />
                <span className="text-[11px] text-slate-400">Loading…</span>
              </>
            ) : wsConnected ? (
              <>
                <Radio className="w-3 h-3 text-green-400 flex-shrink-0 animate-notification-pulse" />
                <span className="text-[11px] text-green-400">Live</span>
              </>
            ) : (
              <>
                <Radio className="w-3 h-3 text-slate-600 flex-shrink-0" />
                <span className="text-[11px] text-slate-600">Offline</span>
              </>
            )}
          </div>

          {/* Live incoming message banner */}
          {liveMessage && (
            <div className="flex items-start gap-3 px-4 py-2.5 bg-indigo-950/60 border-b border-indigo-800/50 flex-shrink-0 animate-notification-banner">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 flex-shrink-0 animate-pulse" />
              <div className="flex-1 min-w-0">
                {liveMessage.event_type && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${EVENT_COLORS[liveMessage.event_type] ?? "bg-slate-700 text-slate-400"}`}
                  >
                    {liveMessage.event_type.replace(/_/g, " ")}
                  </span>
                )}
                {liveMessage.title && (
                  <p className="text-xs font-medium text-slate-200 mt-0.5 truncate">
                    {liveMessage.title}
                  </p>
                )}
                {liveMessage.message && (
                  <p className="text-[11px] text-slate-400 line-clamp-2">
                    {liveMessage.message}
                  </p>
                )}
              </div>
              <button
                onClick={() => setLiveMessage(null)}
                className="text-slate-600 hover:text-slate-400 flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="py-10 text-center text-slate-500 text-sm">
                Loading...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/50">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className={clsx(
                      "flex gap-3 px-4 py-3 group hover:bg-slate-800/60 transition-colors",
                      !n.read && "bg-indigo-950/20",
                    )}
                  >
                    <div className="flex-shrink-0 pt-1.5">
                      <div
                        className={clsx(
                          "w-2 h-2 rounded-full",
                          !n.read ? "bg-indigo-500" : "bg-transparent",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${EVENT_COLORS[n.event_type] ?? "bg-slate-700 text-slate-400"}`}
                          >
                            {n.event_type.replace(/_/g, " ")}
                          </span>
                          <p className="text-sm font-medium text-slate-200 mt-1 truncate">
                            {n.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
                            {n.message}
                          </p>
                          {n.run_id && (
                            <Link
                              href={`/runs/${n.run_id}`}
                              onClick={() => setOpen(false)}
                              className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block"
                            >
                              View run →
                            </Link>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {!n.read && (
                            <button
                              onClick={() => markReadMutation.mutate(n.id)}
                              className="p-1 text-slate-500 hover:text-green-400 rounded hover:bg-green-900/30 transition-colors"
                              title="Mark read"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteMutation.mutate(n.id)}
                            className="p-1 text-slate-500 hover:text-red-400 rounded hover:bg-red-900/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
