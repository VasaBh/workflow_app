'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scriptsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleGate from '@/components/ui/RoleGate';
import { Script, PaginatedResponse } from '@/types';
import {
  Code2, Plus, Trash2, Save, CheckCircle, Copy, History,
  Search, Loader2, X,
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'sql'];

const DEFAULT_CODE: Record<string, string> = {
  python: `def run(params):\n    """Script entry point"""\n    print("Hello from Python!")\n    return {"status": "ok"}\n`,
  javascript: `async function run(params) {\n  console.log("Hello from JS!");\n  return { status: "ok" };\n}\n`,
  typescript: `async function run(params: Record<string, unknown>): Promise<unknown> {\n  console.log("Hello from TS!");\n  return { status: "ok" };\n}\n`,
  bash: `#!/bin/bash\necho "Hello from Bash!"\n`,
  sql: `-- SQL Script\nSELECT 1;\n`,
};

export default function ScriptsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [newScript, setNewScript] = useState({ name: '', description: '', language: 'python', entry: 'run' });
  const [validating, setValidating] = useState(false);
  const [validateResult, setValidateResult] = useState<{ valid: boolean; error?: string; error_line?: number; duration_ms?: number; logs?: unknown[]; output?: unknown } | null>(null);
  const [showTestParams, setShowTestParams] = useState(false);
  const [testParamsJson, setTestParamsJson] = useState('{}');
  const [testParamsError, setTestParamsError] = useState('');

  // Script list (no code field)
  const { data, isLoading } = useQuery<PaginatedResponse<Script>>({
    queryKey: ['scripts', search],
    queryFn: async () => {
      const res = await scriptsApi.list({ search: search || undefined, page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  // Full script detail including code — fetched when a script is selected
  const { data: selected, isLoading: loadingScript } = useQuery<Script>({
    queryKey: ['script', selectedId],
    queryFn: async () => {
      const res = await scriptsApi.get(selectedId!);
      return res.data;
    },
    enabled: !!selectedId,
  });

  // Sync editor content when selected script changes
  useEffect(() => {
    if (selected) setCode(selected.code ?? '');
  }, [selected]);

  const { data: versions } = useQuery({
    queryKey: ['script-versions', selectedId],
    queryFn: async () => {
      const res = await scriptsApi.versions(selectedId!);
      return res.data?.items ?? res.data ?? [];
    },
    enabled: !!selectedId && showVersions,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      scriptsApi.create({
        ...newScript,
        code: DEFAULT_CODE[newScript.language] ?? '',
        parameters: [],
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['scripts'] });
      toast.success('Script created');
      setShowCreate(false);
      setSelectedId(res.data.id);
      setNewScript({ name: '', description: '', language: 'python', entry: 'run' });
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to create script'),
  });

  const saveMutation = useMutation({
    mutationFn: () => scriptsApi.update(selectedId!, { code }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scripts'] });
      qc.invalidateQueries({ queryKey: ['script', selectedId] });
      qc.invalidateQueries({ queryKey: ['script-versions', selectedId] });
      toast.success('Script saved');
      setValidateResult(null);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => scriptsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scripts'] });
      toast.success('Script deleted');
      setDeleteTarget(null);
      if (selectedId === deleteTarget?.id) {
        setSelectedId(null);
        setCode('');
      }
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete'),
  });

  const cloneMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => scriptsApi.clone(id, name),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['scripts'] });
      toast.success('Script cloned');
      setSelectedId(res.data.id);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to clone'),
  });

  const restoreMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) => scriptsApi.restore(id, version),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['script', selectedId] });
      qc.invalidateQueries({ queryKey: ['scripts'] });
      toast.success('Version restored');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to restore'),
  });

  const handleValidate = async () => {
    if (!selectedId) return;
    let parsedParams: Record<string, unknown> = {};
    try {
      parsedParams = JSON.parse(testParamsJson);
    } catch {
      setTestParamsError('Invalid JSON');
      setShowTestParams(true);
      return;
    }
    setTestParamsError('');
    setValidating(true);
    try {
      const res = await scriptsApi.validate({
        code,
        entry: selected?.entry ?? 'run',
        parameters: selected?.parameters ?? [],
        test_params: parsedParams,
      });
      setValidateResult(res.data);
      if (res.data?.valid) toast.success(`Script is valid · ran in ${res.data.duration_ms}ms`);
      else toast.error(res.data?.error ?? 'Validation failed');
    } catch (err: unknown) {
      toast.error((err as Error).message || 'Validation request failed');
    } finally {
      setValidating(false);
    }
  };

  const scripts = data?.items ?? [];

  return (
    <AppShell title="Scripts">
      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar list */}
        <div className="w-64 flex-shrink-0 border-r border-slate-700 bg-slate-900 flex flex-col">
          <div className="p-3 border-b border-slate-700 space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search scripts..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <RoleGate minRole="editor">
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> New Script
              </button>
            </RoleGate>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {isLoading ? (
              <div className="text-center py-6 text-slate-400 text-xs">Loading...</div>
            ) : scripts.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-xs">No scripts</div>
            ) : (
              scripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedId(s.id);
                    setValidateResult(null);
                    setShowVersions(false);
                  }}
                  className={clsx(
                    'w-full text-left px-3 py-2.5 hover:bg-slate-800 transition-colors border-b border-slate-700/50 last:border-0',
                    selectedId === s.id && 'bg-indigo-900/30 border-r-2 border-r-indigo-500'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                    <span className="text-xs font-medium text-slate-200 truncate">{s.name}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-slate-500 capitalize">{s.language}</span>
                    <span className="text-[10px] text-slate-500">v{s.version}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Editor area */}
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <Code2 className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="text-sm">Select a script to edit</p>
            </div>
          </div>
        ) : loadingScript ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900 border-b border-slate-700 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <h2 className="font-semibold text-slate-100 truncate">{selected?.name}</h2>
                <span className="text-xs text-slate-400 bg-slate-700 px-2 py-0.5 rounded capitalize">{selected?.language}</span>
                <span className="text-xs text-slate-500">v{selected?.version}</span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800"
                >
                  <History className="w-3.5 h-3.5" /> History
                </button>
                <RoleGate minRole="editor">
                  <button
                    onClick={() => selected && cloneMutation.mutate({ id: selected.id, name: `${selected.name} (copy)` })}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-400 border border-slate-600 rounded-lg hover:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" /> Clone
                  </button>
                  <button
                    onClick={() => setShowTestParams((v) => !v)}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors',
                      showTestParams
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                        : 'text-slate-600 border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Validate
                  </button>
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60"
                  >
                    {saveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save
                  </button>
                  <button
                    onClick={() => selected && setDeleteTarget(selected)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </RoleGate>
              </div>
            </div>

            {/* Test params panel */}
            {showTestParams && (
              <div className="px-4 py-3 bg-slate-900 border-b border-slate-700 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">Test Params (JSON)</span>
                  <button
                    onClick={handleValidate}
                    disabled={validating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60 transition-colors"
                  >
                    {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                    Run Validate
                  </button>
                </div>
                <textarea
                  value={testParamsJson}
                  onChange={(e) => { setTestParamsJson(e.target.value); setTestParamsError(''); }}
                  rows={4}
                  spellCheck={false}
                  placeholder='{"param1": "value1"}'
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />
                {testParamsError && (
                  <p className="text-xs text-red-400">{testParamsError}</p>
                )}
              </div>
            )}

            <div className="flex-1 flex overflow-hidden">
              {/* Editor + output column */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Monaco editor */}
                <div className={clsx('overflow-hidden', validateResult ? 'flex-1' : 'flex-1')}>
                  <MonacoEditor
                    height="100%"
                    language={selected?.language ?? 'python'}
                    value={code}
                    onChange={(v) => setCode(v ?? '')}
                    theme="vs-dark"
                    options={{
                      fontSize: 13,
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      padding: { top: 16 },
                      tabSize: 2,
                      wordWrap: 'on',
                    }}
                  />
                </div>

                {/* Validate result output box */}
                {validateResult && (
                  <div className="flex-shrink-0 border-t border-slate-700 bg-slate-900 flex flex-col" style={{ height: '220px' }}>
                    {/* Output header */}
                    <div className={clsx('flex items-center gap-2 px-4 py-2 border-b flex-shrink-0', validateResult.valid ? 'border-green-700 bg-green-900/40' : 'border-red-700 bg-red-900/40')}>
                      {validateResult.valid
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                        : <X className="w-3.5 h-3.5 text-red-400" />}
                      <span className={clsx('text-xs font-semibold', validateResult.valid ? 'text-green-300' : 'text-red-300')}>
                        {validateResult.valid ? 'Validation Passed' : 'Validation Failed'}
                      </span>
                      {validateResult.duration_ms != null && (
                        <span className="text-[10px] text-slate-400 ml-1">· {validateResult.duration_ms}ms</span>
                      )}
                      <button onClick={() => setValidateResult(null)} className="ml-auto text-slate-500 hover:text-slate-300 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Output body */}
                    <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 font-mono text-xs">
                      {/* Error message */}
                      {!validateResult.valid && validateResult.error && (
                        <div>
                          <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Error</p>
                          <div className="text-red-400 whitespace-pre-wrap leading-relaxed">
                            {validateResult.error_line != null && (
                              <span className="text-slate-500 mr-2">Line {validateResult.error_line}:</span>
                            )}
                            {validateResult.error}
                          </div>
                        </div>
                      )}

                      {/* Logs */}
                      {validateResult.logs && (validateResult.logs as unknown[]).length > 0 && (
                        <div>
                          <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Logs</p>
                          <div className="space-y-0.5">
                            {(validateResult.logs as unknown[]).map((log, i) => (
                              <div key={i} className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {typeof log === 'string' ? log : JSON.stringify(log, null, 2)}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Output */}
                      {validateResult.output != null && (
                        <div>
                          <p className="text-[10px] font-sans font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Output</p>
                          <pre className="text-green-300 whitespace-pre-wrap leading-relaxed">
                            {typeof validateResult.output === 'string'
                              ? validateResult.output
                              : JSON.stringify(validateResult.output, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* Success with no output/logs */}
                      {validateResult.valid && validateResult.output == null && (!validateResult.logs || (validateResult.logs as unknown[]).length === 0) && (
                        <div className="text-green-400">Script executed successfully with no output.</div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Version history panel */}
              {showVersions && (
                <div className="w-56 border-l border-slate-700 bg-slate-900 flex flex-col">
                  <div className="px-3 py-2.5 border-b border-slate-700 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-300">Version History</span>
                    <button onClick={() => setShowVersions(false)} className="text-slate-500 hover:text-slate-300">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto py-1">
                    {!versions || (versions as unknown[]).length === 0 ? (
                      <div className="text-center py-4 text-xs text-slate-500">No versions</div>
                    ) : (
                      (versions as Array<{ version: number; updated_at: string; updated_by?: string }>).map((v) => (
                        <div key={v.version} className="px-3 py-2 border-b border-slate-700/50 last:border-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-300">v{v.version}</span>
                            {v.version !== selected?.version && (
                              <RoleGate minRole="editor">
                                <button
                                  onClick={() => selectedId && restoreMutation.mutate({ id: selectedId, version: v.version })}
                                  className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium"
                                >
                                  Restore
                                </button>
                              </RoleGate>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {v.updated_at ? format(new Date(v.updated_at), 'MMM d, HH:mm') : ''}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">Create Script</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
                <input type="text" value={newScript.name} onChange={(e) => setNewScript({ ...newScript, name: e.target.value })} placeholder="my_script" autoFocus
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Description</label>
                <input type="text" value={newScript.description} onChange={(e) => setNewScript({ ...newScript, description: e.target.value })} placeholder="Optional description"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Language</label>
                <select value={newScript.language} onChange={(e) => setNewScript({ ...newScript, language: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {LANGUAGES.map((l) => <option key={l} value={l} className="capitalize">{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Entry function</label>
                <input type="text" value={newScript.entry} onChange={(e) => setNewScript({ ...newScript, entry: e.target.value })} placeholder="run"
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => createMutation.mutate()} disabled={!newScript.name.trim() || createMutation.isPending}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60">
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Script"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
