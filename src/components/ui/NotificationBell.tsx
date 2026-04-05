'use client';

import { useEffect, useRef, useState } from 'react';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { createNotificationWebSocket } from '@/lib/ws';
import { getAccessToken } from '@/lib/api';
import { Notification } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import Link from 'next/link';

const EVENT_COLORS: Record<string, string> = {
  run_completed:      'bg-green-900/40 text-green-300',
  run_failed:         'bg-red-900/40 text-red-300',
  run_started:        'bg-blue-900/40 text-blue-300',
  step_pending:       'bg-orange-900/40 text-orange-300',
  step_failed:        'bg-red-900/40 text-red-300',
  schedule_triggered: 'bg-indigo-900/40 text-indigo-300',
};

export default function NotificationBell() {
  const qc = useQueryClient();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const wsRef = useRef<WebSocket | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return res.data as { unread_count: number };
    },
    enabled: isAuthenticated,
    refetchInterval: 30_000,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'dropdown'],
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
    const ws = createNotificationWebSocket(token, () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    wsRef.current = ws;
    return () => ws.close();
  }, [isAuthenticated, qc]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const count = countData?.unread_count ?? 0;
  const notifications: Notification[] = data?.items ?? [];

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-96 max-h-[520px] flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 flex-shrink-0">
            <h3 className="text-sm font-semibold text-slate-200">Notifications</h3>
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
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <div className="py-10 text-center text-slate-500 text-sm">Loading...</div>
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
                      'flex gap-3 px-4 py-3 group hover:bg-slate-800/60 transition-colors',
                      !n.read && 'bg-indigo-950/20'
                    )}
                  >
                    <div className="flex-shrink-0 pt-1.5">
                      <div className={clsx('w-2 h-2 rounded-full', !n.read ? 'bg-indigo-500' : 'bg-transparent')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${EVENT_COLORS[n.event_type] ?? 'bg-slate-700 text-slate-400'}`}>
                            {n.event_type.replace(/_/g, ' ')}
                          </span>
                          <p className="text-sm font-medium text-slate-200 mt-1 truncate">{n.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
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
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
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
