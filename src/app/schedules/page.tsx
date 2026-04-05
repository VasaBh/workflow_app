'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesApi, blueprintsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import KeyValueEditor from '@/components/ui/KeyValueEditor';
import RoleGate from '@/components/ui/RoleGate';
import { Schedule, PaginatedResponse, Blueprint } from '@/types';
import { Clock, Plus, Trash2, Play, Pause, History, Search, X, Edit2, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import cronstrue from 'cronstrue';
import toast from 'react-hot-toast';
import Link from 'next/link';

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs text-slate-500 font-mono hover:text-slate-300 transition-colors group">
      <span>{value.slice(0, 8)}…</span>
      {copied ? <Check className="w-3 h-3 text-green-400 flex-shrink-0" /> : <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

function parseCron(expr: string): string {
  try { return cronstrue.toString(expr); } catch { return expr; }
}

function formatInTz(isoStr: string, tz: string): string {
  try {
    // The backend returns a naive ISO string in the schedule's timezone
    // Treat it as UTC only if it already has a Z/offset; otherwise parse as-is
    const date = new Date(isoStr.includes('+') || isoStr.endsWith('Z') ? isoStr : isoStr + 'Z');
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return isoStr;
  }
}

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai',
  'Australia/Sydney',
];

export default function SchedulesPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Schedule | null>(null);
  const [form, setForm] = useState({
    name: '', blueprint_id: '', cron_expression: '0 9 * * 1-5', timezone: 'UTC', context: {} as Record<string, unknown>,
  });
  const [editForm, setEditForm] = useState({
    name: '', cron_expression: '', timezone: 'UTC', context: {} as Record<string, unknown>,
  });

  const { data, isLoading } = useQuery<PaginatedResponse<Schedule>>({
    queryKey: ['schedules', search],
    queryFn: async () => {
      const res = await schedulesApi.list({ search: search || undefined, page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  const { data: blueprints } = useQuery<Blueprint[]>({
    queryKey: ['blueprints-all'],
    queryFn: async () => {
      const res = await blueprintsApi.list({ page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.items)) return d.items;
      return [];
    },
    staleTime: 60_000,
  });

  const blueprintItems: Blueprint[] = Array.isArray(blueprints)
    ? blueprints
    : ((blueprints as unknown as PaginatedResponse<Blueprint>)?.items ?? []);
  const blueprintNames: Record<string, string> = {};
  blueprintItems.forEach((b) => { blueprintNames[b.id] = b.name; });

  const { data: historyData } = useQuery({
    queryKey: ['schedule-history', historyTarget?.id],
    queryFn: async () => {
      const res = await schedulesApi.history(historyTarget!.id, { limit: 20 });
      return res.data?.items ?? res.data ?? [];
    },
    enabled: !!historyTarget,
  });

  const createMutation = useMutation({
    mutationFn: () => schedulesApi.create(form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule created');
      setShowCreate(false);
      setForm({ name: '', blueprint_id: '', cron_expression: '0 9 * * 1-5', timezone: 'UTC', context: {} });
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to create schedule'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Schedule deleted'); setDeleteTarget(null); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete'),
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Schedule activated'); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to activate'),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schedules'] }); toast.success('Schedule deactivated'); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to deactivate'),
  });

  const updateMutation = useMutation({
    mutationFn: () => schedulesApi.update(editTarget!.id, editForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('Schedule updated');
      setEditTarget(null);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to update schedule'),
  });

  const triggerMutation = useMutation({
    mutationFn: (id: string) => schedulesApi.trigger(id),
    onSuccess: () => { toast.success('Schedule triggered manually'); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to trigger'),
  });

  const openEdit = (s: Schedule) => {
    setEditTarget(s);
    setEditForm({ name: s.name, cron_expression: s.cron_expression, timezone: s.timezone, context: s.context ?? {} });
  };

  const schedules = data?.items ?? [];
  const bpList = blueprintItems;

  return (
    <AppShell title="Schedules">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search schedules..."
              className="pl-9 pr-4 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60"
            />
          </div>
          <RoleGate minRole="editor">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
            >
              <Plus className="w-4 h-4" /> New Schedule
            </button>
          </RoleGate>
        </div>

        <div className="bg-slate-900 rounded-xl border border-slate-700">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500">Loading schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500">No schedules yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Blueprint</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Schedule</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Run</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Next Run</th>
                    <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {schedules.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3.5 font-medium text-slate-200">{s.name}</td>
                      <td className="px-5 py-3.5 text-slate-400">{blueprintNames[s.blueprint_id] ?? s.blueprint_name ?? s.blueprint_id.slice(0, 8)}</td>
                      <td className="px-5 py-3.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <code className="text-xs bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono border border-slate-600">{s.cron_expression}</code>
                            <span className="text-xs bg-slate-800 text-indigo-400 border border-slate-600 px-1.5 py-0.5 rounded">{s.timezone}</span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{parseCron(s.cron_expression)}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={s.status} /></td>
                      <td className="px-5 py-3.5 text-xs">
                        {s.last_run_at ? (
                          <div>
                            <p className="text-slate-300">{formatInTz(s.last_run_at, s.timezone)}</p>
                            <p className="text-slate-500 mt-0.5">{s.timezone}</p>
                          </div>
                        ) : <span className="text-slate-600">Never</span>}
                      </td>
                      <td className="px-5 py-3.5 text-xs">
                        {s.next_run_at ? (
                          <div>
                            <p className="text-slate-300">{formatInTz(s.next_run_at, s.timezone)}</p>
                            <p className="text-slate-500 mt-0.5">{s.timezone}</p>
                          </div>
                        ) : <span className="text-slate-600">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setHistoryTarget(s)}
                            className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                            title="History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          <RoleGate minRole="executor">
                            <button
                              onClick={() => triggerMutation.mutate(s.id)}
                              className="p-1.5 text-slate-500 hover:text-green-400 rounded-lg hover:bg-slate-700 transition-colors"
                              title="Trigger now"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          </RoleGate>
                          <RoleGate minRole="editor">
                            {s.status === 'active' ? (
                              <button
                                onClick={() => deactivateMutation.mutate(s.id)}
                                className="p-1.5 text-yellow-400 hover:text-yellow-300 rounded-lg hover:bg-slate-700 transition-colors"
                                title="Pause"
                              >
                                <Pause className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <button
                                onClick={() => activateMutation.mutate(s.id)}
                                className="p-1.5 text-green-400 hover:text-green-300 rounded-lg hover:bg-slate-700 transition-colors"
                                title="Activate"
                              >
                                <Play className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => openEdit(s)}
                              className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(s)}
                              className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/30 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </RoleGate>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Create Schedule</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily report"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Blueprint</label>
                <select value={form.blueprint_id} onChange={(e) => setForm({ ...form, blueprint_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Select blueprint...</option>
                  {bpList.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Cron Expression</label>
                <input type="text" value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })} placeholder="0 9 * * 1-5"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                {form.cron_expression && <p className="text-xs text-slate-500 mt-1">{parseCron(form.cron_expression)}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Timezone</label>
                <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Context (key-value)</label>
                <KeyValueEditor value={form.context} onChange={(ctx) => setForm({ ...form, context: ctx })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!form.name.trim() || !form.blueprint_id || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60">
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setEditTarget(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Edit Schedule — {editTarget.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Cron Expression</label>
                <input type="text" value={editForm.cron_expression} onChange={(e) => setEditForm({ ...editForm, cron_expression: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                {editForm.cron_expression && <p className="text-xs text-slate-500 mt-1">{parseCron(editForm.cron_expression)}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Timezone</label>
                <select value={editForm.timezone} onChange={(e) => setEditForm({ ...editForm, timezone: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Context (key-value)</label>
                <KeyValueEditor value={editForm.context} onChange={(ctx) => setEditForm({ ...editForm, context: ctx })} />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setEditTarget(null)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => updateMutation.mutate()} disabled={!editForm.name.trim() || !editForm.cron_expression.trim() || updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60">
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setHistoryTarget(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">Run History — {historyTarget.name}</h2>
              <button onClick={() => setHistoryTarget(null)} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              {!historyData || (historyData as unknown[]).length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-6">No history yet</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2 text-xs font-medium text-slate-500">Run ID</th>
                      <th className="text-left py-2 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-left py-2 text-xs font-medium text-slate-500">Started</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50">
                    {(historyData as Array<{ id: string; status: string; started_at?: string }>).map((h) => (
                      <tr key={h.id}>
                        <td className="py-2">
                          <div className="flex items-center gap-2">
                            <CopyId value={h.id} />
                            <Link href={`/runs/${h.id}`} onClick={() => setHistoryTarget(null)} className="text-xs text-indigo-400 hover:text-indigo-300">View →</Link>
                          </div>
                        </td>
                        <td className="py-2"><StatusBadge status={h.status as 'completed'} /></td>
                        <td className="py-2 text-xs text-slate-500">{h.started_at ? format(new Date(h.started_at), 'MMM d, HH:mm') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Schedule"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
