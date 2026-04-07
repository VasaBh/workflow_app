'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runsApi, blueprintsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar, { runStatusColor } from '@/components/ui/ProgressBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { Run, PaginatedResponse, RunStatus } from '@/types';
import { Play, Clock, Search, RefreshCw, ChevronLeft, ChevronRight, Trash2, Trash } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Not Started', value: 'not_started' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Paused', value: 'paused' },
  { label: 'Completed', value: 'completed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

const ACTIVE_STATUSES = new Set(['in_progress', 'not_started', 'paused']);

function runProgress(run: import('@/types').Run): number {
  if (run.status === 'completed') return 100;
  if (run.status === 'not_started') return 0;
  const p = run.progress;
  if (p && typeof p === 'object' && 'percentage' in p) return p.percentage;
  if (run.total_steps && run.total_steps > 0) {
    const pct = ((run.completed_steps ?? 0) / run.total_steps) * 100;
    return Number.isFinite(pct) ? Math.round(pct) : 0;
  }
  return typeof p === 'number' && Number.isFinite(p) ? p : 0;
}

export default function RunsPage() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Run | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const LIMIT = 20;

  const { data, isLoading, isFetching } = useQuery<PaginatedResponse<Run>>({
    queryKey: ['runs', statusFilter, search, page],
    queryFn: async () => {
      const res = await runsApi.list({
        status: statusFilter || undefined,
        search: search || undefined,
        page,
        limit: LIMIT,
        sort: 'created_at',
        order: 'desc',
      });
      return res.data;
    },
    refetchInterval: 10_000,
  });

  const { data: blueprintsData } = useQuery({
    queryKey: ['blueprints-all'],
    queryFn: async () => {
      const res = await blueprintsApi.list({ page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      return res.data;
    },
    staleTime: 60_000,
  });

  const blueprintNames: Record<string, string> = {};
  (blueprintsData?.items ?? []).forEach((b: { id: string; name: string }) => { blueprintNames[b.id] = b.name; });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => runsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
      toast.success('Run deleted');
      setDeleteTarget(null);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete run'),
  });

  const handleClearAll = async () => {
    // Fetch all non-active runs and delete them sequentially
    setClearing(true);
    setClearAllConfirm(false);
    try {
      let pg = 1;
      let deleted = 0;
      while (true) {
        const res = await runsApi.list({ page: pg, limit: 100, sort: 'created_at', order: 'desc' });
        const items: Run[] = res.data?.items ?? [];
        if (items.length === 0) break;
        const deletable = items.filter((r) => !ACTIVE_STATUSES.has(r.status));
        for (const r of deletable) {
          await runsApi.delete(r.id);
          deleted++;
        }
        if (items.length < 100) break;
        pg++;
      }
      qc.invalidateQueries({ queryKey: ['runs'] });
      toast.success(`Cleared ${deleted} run${deleted !== 1 ? 's' : ''}`);
    } catch {
      toast.error('Some runs could not be deleted');
      qc.invalidateQueries({ queryKey: ['runs'] });
    } finally {
      setClearing(false);
    }
  };

  const runs = data?.items ?? [];
  const totalPages = data?.pages ?? 1;

  return (
    <AppShell title="Runs">
      <div className="p-6 space-y-5">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search runs..."
                className="pl-9 pr-4 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setStatusFilter(opt.value); setPage(1); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    statusFilter === opt.value
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-400 border border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setClearAllConfirm(true)}
              disabled={clearing || runs.length === 0}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Delete all non-active runs"
            >
              <Trash className={`w-4 h-4 ${clearing ? 'animate-pulse' : ''}`} />
              {clearing ? 'Clearing...' : 'Clear all'}
            </button>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ['runs'] })}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-slate-900 rounded-xl border border-slate-700">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">Loading runs...</div>
          ) : runs.length === 0 ? (
            <div className="py-12 text-center">
              <Play className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No runs found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Blueprint</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Triggered by</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Started</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {runs.map((run) => {
                    const isActive = ACTIVE_STATUSES.has(run.status);
                    return (
                      <tr key={run.id} className="hover:bg-slate-800/50 transition-colors group">
                        <td className="px-5 py-3.5">
                          <Link href={`/runs/${run.id}`} className="font-medium text-indigo-400 hover:text-indigo-300">
                            {blueprintNames[run.blueprint_id] ?? run.blueprint_name ?? run.blueprint_id.slice(0, 8)}
                          </Link>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">{run.id.slice(0, 12)}...</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusBadge status={run.status as RunStatus} />
                        </td>
                        <td className="px-5 py-3.5 w-36">
                          <ProgressBar value={runProgress(run)} showLabel color={runStatusColor(run.status)} />
                        </td>
                        <td className="px-5 py-3.5 text-slate-400">{run.triggered_by ?? '—'}</td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {(() => {
                            const secs = run.duration ??
                              (run.started_at && run.completed_at
                                ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                                : null);
                            return secs != null ? `${secs}s` : '—';
                          })()}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap">
                          {run.started_at ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDistanceToNow(new Date(run.started_at), { addSuffix: true })}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3.5">
                          <button
                            onClick={() => setDeleteTarget(run)}
                            disabled={isActive}
                            title={isActive ? 'Cancel the run before deleting' : 'Delete run'}
                            className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="px-5 py-4 border-t border-slate-700 flex items-center justify-between">
              <p className="text-sm text-slate-500">
                Page {page} of {totalPages} ({data?.total ?? 0} total)
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 border border-slate-600 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors text-slate-400"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 border border-slate-600 rounded-lg disabled:opacity-40 hover:bg-slate-800 transition-colors text-slate-400"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Run"
        message={`Delete run ${deleteTarget?.id.slice(0, 12)}...? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={clearAllConfirm}
        title="Clear All Runs"
        message="Delete all completed, failed, and cancelled runs? Active runs will not be affected."
        confirmLabel="Clear All"
        onConfirm={handleClearAll}
        onCancel={() => setClearAllConfirm(false)}
      />
    </AppShell>
  );
}
