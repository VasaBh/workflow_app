'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blueprintsApi, runsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleGate from '@/components/ui/RoleGate';
import { Blueprint, PaginatedResponse, BlueprintStatus } from '@/types';
import {
  Plus, Search, GitBranch, Play, Copy, Trash2, ChevronRight, MoreHorizontal, ListOrdered, Layers, PlayCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

const STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Published', value: 'published' },
  { label: 'Archived', value: 'archived' },
];

export default function BlueprintsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newSequential, setNewSequential] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Blueprint | null>(null);
  const [cloneTarget, setCloneTarget] = useState<Blueprint | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<Blueprint>>({
    queryKey: ['blueprints', search],
    queryFn: async () => {
      const res = await blueprintsApi.list({
        search: search || undefined,
        page: 1,
        limit: 200,
        sort: 'created_at',
        order: 'desc',
      });
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => blueprintsApi.create({ name: newName, description: newDesc, sequential: newSequential }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blueprints'] });
      toast.success('Blueprint created');
      setShowCreate(false);
      setNewName('');
      setNewDesc('');
      setNewSequential(false);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to create blueprint'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => blueprintsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blueprints'] });
      toast.success('Blueprint deleted');
      setDeleteTarget(null);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete blueprint'),
  });

  const cloneMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => blueprintsApi.clone(id, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blueprints'] });
      toast.success('Blueprint cloned');
      setCloneTarget(null);
      setCloneName('');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to clone blueprint'),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => runsApi.create(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['runs'] });
      toast.success('Run started');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to start run'),
  });

  const allBlueprints = data?.items ?? [];
  const blueprints = statusFilter
    ? allBlueprints.filter((bp) => bp.status === statusFilter)
    : allBlueprints;

  return (
    <AppShell title="Blueprints">
      <div className="p-6 space-y-5">
        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search blueprints..."
                className="pl-9 pr-4 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-60"
              />
            </div>
            <div className="flex gap-1">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatusFilter(opt.value)}
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
          <RoleGate minRole="editor">
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Blueprint
            </button>
          </RoleGate>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-500">Loading blueprints...</div>
        ) : blueprints.length === 0 ? (
          <div className="text-center py-12">
            <GitBranch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">No blueprints found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {blueprints.map((bp) => (
              <div
                key={bp.id}
                className="bg-slate-900 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 bg-indigo-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="min-w-0">
                      <Link href={`/blueprints/${bp.id}`}>
                        <h3 className="font-semibold text-slate-200 hover:text-indigo-400 truncate transition-colors">
                          {bp.name}
                        </h3>
                      </Link>
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setOpenMenu(openMenu === bp.id ? null : bp.id)}
                      className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                    {openMenu === bp.id && (
                      <div className="absolute right-0 top-7 bg-slate-800 border border-slate-600 rounded-lg shadow-lg z-10 w-40 py-1">
                        <Link
                          href={`/blueprints/${bp.id}`}
                          onClick={() => setOpenMenu(null)}
                          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                        >
                          <ChevronRight className="w-3.5 h-3.5" /> View
                        </Link>
                        <RoleGate minRole="executor">
                          <button
                            onClick={() => { setOpenMenu(null); runMutation.mutate(bp.id); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                          >
                            <Play className="w-3.5 h-3.5" /> Run
                          </button>
                        </RoleGate>
                        <RoleGate minRole="editor">
                          <button
                            onClick={() => { setOpenMenu(null); setCloneTarget(bp); setCloneName(`${bp.name} (copy)`); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700"
                          >
                            <Copy className="w-3.5 h-3.5" /> Clone
                          </button>
                          <button
                            onClick={() => { setOpenMenu(null); setDeleteTarget(bp); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-900/30"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </RoleGate>
                      </div>
                    )}
                  </div>
                </div>

                {bp.description && (
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{bp.description}</p>
                )}

                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={bp.status as BlueprintStatus} />
                    {bp.sequential && (
                      <span className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border bg-indigo-900/30 text-indigo-400 border-indigo-700">
                        <ListOrdered className="w-3 h-3" /> Sequential
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">v{bp.version}</span>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" />{bp.step_count} steps</span>
                  <span className="flex items-center gap-1"><PlayCircle className="w-3.5 h-3.5" />{bp.run_count} runs</span>
                  <span className="ml-auto">{format(new Date(bp.updated_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Create Blueprint</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Workflow"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSequential}
                  onChange={(e) => setNewSequential(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900"
                />
                <div>
                  <p className="text-sm font-medium text-slate-300">Sequential</p>
                  <p className="text-xs text-slate-500">Steps run one after another in order</p>
                </div>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!newName.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60 transition-colors"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clone modal */}
      {cloneTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCloneTarget(null)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Clone Blueprint</h2>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">New name</label>
              <input
                type="text"
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setCloneTarget(null)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button
                onClick={() => cloneMutation.mutate({ id: cloneTarget.id, name: cloneName })}
                disabled={!cloneName.trim() || cloneMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60 transition-colors"
              >
                {cloneMutation.isPending ? 'Cloning...' : 'Clone'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Blueprint"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
