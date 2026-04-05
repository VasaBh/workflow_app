'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import { Notification, PaginatedResponse } from '@/types';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const EVENT_COLORS: Record<string, string> = {
  run_completed:       'bg-green-900/40 text-green-300',
  run_failed:          'bg-red-900/40 text-red-300',
  run_started:         'bg-blue-900/40 text-blue-300',
  step_pending:        'bg-orange-900/40 text-orange-300',
  step_failed:         'bg-red-900/40 text-red-300',
  schedule_triggered:  'bg-indigo-900/40 text-indigo-300',
};

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [page, setPage] = useState(1);
  const LIMIT = 25;

  const { data, isLoading } = useQuery<PaginatedResponse<Notification>>({
    queryKey: ['notifications', filter, page],
    queryFn: async () => {
      const res = await notificationsApi.list({
        read: filter === 'unread' ? false : undefined,
        page,
        limit: LIMIT,
      });
      return res.data;
    },
    refetchInterval: 15_000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      toast.success('All notifications marked as read');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notifications'] }); },
  });

  const notifications = data?.items ?? [];
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <AppShell title="Notifications">
      <div className="p-6 max-w-3xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex gap-1">
            {(['all', 'unread'] as const).map((f) => (
              <button
                key={f}
                onClick={() => { setFilter(f); setPage(1); }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition-colors ${
                  filter === f
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 border border-slate-600 hover:bg-slate-700'
                }`}
              >
                {f} {f === 'unread' && unreadCount > 0 && `(${unreadCount})`}
              </button>
            ))}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 font-medium"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all read
            </button>
          )}
        </div>

        <div className="space-y-2">
          {isLoading ? (
            <div className="text-center py-12 text-slate-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No notifications</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={clsx(
                  'bg-slate-900 rounded-xl border p-4 flex gap-3 group transition-all',
                  !n.read ? 'border-indigo-700/60' : 'border-slate-700'
                )}
              >
                <div className="flex-shrink-0 mt-1">
                  {!n.read ? (
                    <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-transparent mt-1" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${EVENT_COLORS[n.event_type] ?? 'bg-slate-700 text-slate-400'}`}>
                          {n.event_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-200">{n.title}</p>
                      <p className="text-sm text-slate-400 mt-0.5">{n.message}</p>
                      {n.run_id && (
                        <Link href={`/runs/${n.run_id}`} className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 inline-block">
                          View run →
                        </Link>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!n.read && (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          className="p-1.5 text-slate-500 hover:text-green-400 rounded-lg hover:bg-green-900/30 transition-colors"
                          title="Mark read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMutation.mutate(n.id)}
                        className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-red-900/30 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-center gap-3 mt-5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-slate-600 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">Page {page} of {data?.pages}</span>
            <button
              onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))}
              disabled={page === (data?.pages ?? 1)}
              className="px-3 py-1.5 text-sm border border-slate-600 text-slate-400 rounded-lg disabled:opacity-40 hover:bg-slate-800"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
