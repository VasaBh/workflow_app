'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleGate from '@/components/ui/RoleGate';
import { Webhook, PaginatedResponse } from '@/types';
import { Webhook as WebhookIcon, Plus, Trash2, Send, Edit2, X, Eye, EyeOff, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const ALL_EVENTS = [
  'run.started', 'run.completed', 'run.failed', 'run.cancelled',
  'step.pending_approval', 'step.completed', 'step.failed', 'schedule.triggered',
];

type FormState = { name: string; url: string; events: string[]; secret: string; active: boolean };
const defaultForm = (): FormState => ({ name: '', url: '', events: [], secret: '', active: true });

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Webhook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Webhook | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [showSecret, setShowSecret] = useState(false);

  const { data, isLoading } = useQuery<PaginatedResponse<Webhook>>({
    queryKey: ['webhooks'],
    queryFn: async () => {
      const res = await webhooksApi.list({ page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => webhooksApi.create(form as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook created'); setShowForm(false); setForm(defaultForm()); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to create webhook'),
  });

  const updateMutation = useMutation({
    mutationFn: () => webhooksApi.update(editTarget!.id, form as Record<string, unknown>),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook updated'); setEditTarget(null); setForm(defaultForm()); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to update webhook'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Webhook deleted'); setDeleteTarget(null); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete'),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => webhooksApi.test(id),
    onSuccess: () => toast.success('Test delivery sent'),
    onError: (err: unknown) => toast.error((err as Error).message || 'Test delivery failed'),
  });

  const openCreate = () => { setEditTarget(null); setForm(defaultForm()); setShowForm(true); };
  const openEdit = (w: Webhook) => { setEditTarget(w); setForm({ name: w.name, url: w.url, events: w.events, secret: w.secret ?? '', active: w.active }); setShowForm(true); };
  const toggleEvent = (event: string) => setForm((f) => ({
    ...f, events: f.events.includes(event) ? f.events.filter((e) => e !== event) : [...f.events, event],
  }));

  const webhooks = data?.items ?? [];

  return (
    <AppShell title="Webhooks">
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{webhooks.length} webhook{webhooks.length !== 1 ? 's' : ''} configured</p>
          <RoleGate minRole="editor">
            <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg">
              <Plus className="w-4 h-4" /> New Webhook
            </button>
          </RoleGate>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-12">
            <WebhookIcon className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">No webhooks configured</p>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((w) => (
              <div key={w.id} className="bg-slate-900 rounded-xl border border-slate-700 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', w.active ? 'bg-green-900/30' : 'bg-slate-800')}>
                      <WebhookIcon className={clsx('w-4 h-4', w.active ? 'text-green-400' : 'text-slate-500')} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-200">{w.name}</h3>
                        <StatusBadge status={w.active ? 'active' : 'paused'} />
                        {w.last_delivery_status && (
                          w.last_delivery_status === 'success'
                            ? <CheckCircle className="w-4 h-4 text-green-400" title="Last delivery: success" />
                            : <AlertCircle className="w-4 h-4 text-red-400" title="Last delivery: failed" />
                        )}
                      </div>
                      <p className="text-sm text-slate-500 font-mono truncate mt-0.5">{w.url}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {w.events.map((e) => (
                          <span key={e} className="text-[10px] bg-slate-800 text-slate-400 border border-slate-600 px-1.5 py-0.5 rounded">{e}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <RoleGate minRole="editor">
                      <button onClick={() => testMutation.mutate(w.id)} disabled={testMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800">
                        <Send className="w-3.5 h-3.5" /> Test
                      </button>
                      <button onClick={() => openEdit(w)} className="p-1.5 text-slate-500 hover:text-slate-300 rounded-lg hover:bg-slate-700 transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setDeleteTarget(w)} className="p-1.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-900/30 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </RoleGate>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                  Created {format(new Date(w.created_at), 'MMM d, yyyy')}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => { setShowForm(false); setEditTarget(null); }} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-100">{editTarget ? 'Edit Webhook' : 'Create Webhook'}</h2>
              <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="text-slate-500 hover:text-slate-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My webhook" autoFocus
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Endpoint URL</label>
                <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://example.com/webhook"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Events</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALL_EVENTS.map((event) => (
                    <label key={event} className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs transition-colors',
                      form.events.includes(event) ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300' : 'border-slate-600 hover:bg-slate-700 text-slate-400'
                    )}>
                      <input type="checkbox" checked={form.events.includes(event)} onChange={() => toggleEvent(event)} className="sr-only" />
                      <div className={clsx('w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0', form.events.includes(event) ? 'bg-indigo-600 border-indigo-600' : 'border-slate-500')}>
                        {form.events.includes(event) && <div className="w-2 h-2 rounded-sm bg-white" />}
                      </div>
                      {event}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Secret (optional)</label>
                <div className="relative">
                  <input type={showSecret ? 'text' : 'password'} value={form.secret} onChange={(e) => setForm({ ...form, secret: e.target.value })} placeholder="HMAC secret key"
                    className="w-full px-3 py-2 pr-10 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono" />
                  <button type="button" onClick={() => setShowSecret((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setForm({ ...form, active: !form.active })}
                  className={clsx('relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0', form.active ? 'bg-indigo-600' : 'bg-slate-600')}>
                  <span className={clsx('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform', form.active ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
                <span className="text-sm text-slate-300">Active</span>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => { setShowForm(false); setEditTarget(null); }} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => editTarget ? updateMutation.mutate() : createMutation.mutate()}
                disabled={!form.name.trim() || !form.url.trim() || createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60">
                {(createMutation.isPending || updateMutation.isPending) ? 'Saving...' : editTarget ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Webhook"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
