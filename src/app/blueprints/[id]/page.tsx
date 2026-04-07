'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { blueprintsApi, stepsApi, runsApi, scriptsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar, { runStatusColor } from '@/components/ui/ProgressBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleGate from '@/components/ui/RoleGate';
import { Blueprint, Step, Script, PaginatedResponse, Run, RunProgress, RunStatus } from '@/types';
import {
  ArrowLeft, Play, Globe, Trash2, Plus, ChevronDown, ChevronRight,
  Code2, FileText, CheckSquare, Settings, Loader2, Pencil, Copy, Check, Clock,
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';

function CopyId({ value, short }: { value: string; short?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-600 font-mono hover:text-slate-300 transition-colors group flex-shrink-0">
      <span>{short ? value.slice(0, 8) : value}</span>
      {copied ? <Check className="w-3 h-3 text-green-400 flex-shrink-0" /> : <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

const STEP_ICONS: Record<string, React.ElementType> = {
  manual:   FileText,
  script:   Code2,
  approval: CheckSquare,
};

const STEP_TYPE_COLORS: Record<string, string> = {
  manual:   'bg-slate-700 text-slate-300',
  script:   'bg-indigo-900/40 text-indigo-300',
  approval: 'bg-orange-900/40 text-orange-300',
};

type StepFormData = {
  name: string;
  type: string;
  order: number;
  on_failure: string;
  retry_count: number;
  timeout_seconds: number;
  script_id: string;
  script_params: Record<string, unknown>;
};

function StepNode({
  step, blueprintId, scriptsById, onEdit, level = 0, sequential = false, index,
}: {
  step: Step;
  blueprintId: string;
  scriptsById: Record<string, string>;
  onEdit: (step: Step) => void;
  level?: number;
  sequential?: boolean;
  index?: number;
}) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(true);
  const Icon = STEP_ICONS[step.type] ?? FileText;

  const deleteMutation = useMutation({
    mutationFn: () => stepsApi.delete(blueprintId, step.id),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['steps', blueprintId] });
      toast.success('Step deleted');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete step'),
  });

  const hasChildren = step.children && step.children.length > 0;
  const scriptName = step.script_id ? (scriptsById[step.script_id] ?? step.script_id.slice(0, 8)) : null;

  return (
    <div className="select-none">
      <div
        className={`flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-slate-800 group transition-colors ${level > 0 ? 'ml-6' : ''}`}
      >
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400 hover:text-slate-600 flex-shrink-0">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}
        {sequential && index != null && (
          <span className="w-5 h-5 rounded-full bg-slate-700 text-slate-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
            {index}
          </span>
        )}
        <span className={`text-xs font-medium px-2 py-0.5 rounded flex items-center gap-1 flex-shrink-0 ${STEP_TYPE_COLORS[step.type]}`}>
          <Icon className="w-3 h-3" /> {step.type}
        </span>
        <CopyId value={step.id} short />
        <span className="text-sm font-medium text-slate-200 truncate">{step.name}</span>
        {scriptName && (
          <span className="flex items-center gap-1 text-[11px] text-indigo-400 bg-indigo-900/30 px-2 py-0.5 rounded font-mono truncate max-w-[140px]">
            <Code2 className="w-3 h-3 flex-shrink-0" />{scriptName}
          </span>
        )}
        <span className="text-xs text-slate-600 font-mono ml-auto">#{step.order}</span>
        <RoleGate minRole="editor">
          <button
            onClick={() => onEdit(step)}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-indigo-400 transition-colors"
            title="Edit step"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
            className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-colors"
            title="Delete step"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </RoleGate>
      </div>
      {hasChildren && expanded && (
        <div>
          {step.children!.map((child, ci) => (
            <StepNode key={child.id} step={child} blueprintId={blueprintId} scriptsById={scriptsById} onEdit={onEdit} level={level + 1} sequential={sequential} index={ci + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepModal({
  title,
  data,
  onChange,
  onSubmit,
  onClose,
  submitting,
  submitLabel,
  scripts,
}: {
  title: string;
  data: StepFormData;
  onChange: (d: StepFormData) => void;
  onSubmit: () => void;
  onClose: () => void;
  submitting: boolean;
  submitLabel: string;
  scripts: Script[];
}) {
  const [paramRows, setParamRows] = useState<Array<{ key: string; value: string }>>(() =>
    Object.entries(data.script_params ?? {}).map(([k, v]) => ({ key: k, value: String(v) }))
  );

  function updateParams(rows: Array<{ key: string; value: string }>) {
    setParamRows(rows);
    const params: Record<string, unknown> = {};
    rows.forEach(({ key, value }) => { if (key.trim()) params[key.trim()] = value; });
    onChange({ ...data, script_params: params });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-slate-100 mb-4">{title}</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Name</label>
            <input type="text" value={data.name} onChange={(e) => onChange({ ...data, name: e.target.value })} placeholder="Step name" autoFocus
              className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Type</label>
            <select value={data.type} onChange={(e) => onChange({ ...data, type: e.target.value, script_id: '', script_params: {} })}
              className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="manual">Manual</option>
              <option value="script">Script</option>
              <option value="approval">Approval</option>
            </select>
          </div>
          {data.type === 'script' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  Script {scripts.length === 0 && <span className="ml-2 text-xs text-slate-500 font-normal">— no scripts found</span>}
                </label>
                <select value={data.script_id} onChange={(e) => onChange({ ...data, script_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">— Select a script —</option>
                  {scripts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.language})</option>)}
                </select>
                {data.script_id && <p className="mt-1 text-[11px] text-slate-500 font-mono truncate">{data.script_id}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-300">Script Parameters</label>
                  <button
                    type="button"
                    onClick={() => updateParams([...paramRows, { key: '', value: '' }])}
                    className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                </div>
                {paramRows.length === 0 ? (
                  <p className="text-xs text-slate-600 italic py-1">No parameters defined.</p>
                ) : (
                  <div className="space-y-2">
                    {paramRows.map((row, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          placeholder="key"
                          value={row.key}
                          onChange={(e) => updateParams(paramRows.map((r, ri) => ri === i ? { ...r, key: e.target.value } : r))}
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-800 text-slate-100 placeholder-slate-600 border border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                        />
                        <span className="text-slate-600 text-xs flex-shrink-0">:</span>
                        <input
                          type="text"
                          placeholder="value"
                          value={row.value}
                          onChange={(e) => updateParams(paramRows.map((r, ri) => ri === i ? { ...r, value: e.target.value } : r))}
                          className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-slate-800 text-slate-100 placeholder-slate-600 border border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateParams(paramRows.filter((_, ri) => ri !== i))}
                          className="flex-shrink-0 p-1 text-slate-600 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">On Failure</label>
            <select value={data.on_failure} onChange={(e) => onChange({ ...data, on_failure: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="block">Block</option>
              <option value="skip">Skip</option>
              <option value="retry">Retry</option>
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Order</label>
              <input type="number" value={data.order} onChange={(e) => onChange({ ...data, order: Number(e.target.value) })} min={1}
                className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Retry Count</label>
              <input type="number" value={data.retry_count} onChange={(e) => onChange({ ...data, retry_count: Number(e.target.value) })} min={0} max={10}
                className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">Timeout (s)</label>
              <input type="number" value={data.timeout_seconds} onChange={(e) => onChange({ ...data, timeout_seconds: Number(e.target.value) })} min={1}
                className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
          <button onClick={onSubmit} disabled={!data.name.trim() || submitting}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg disabled:opacity-60 transition-colors">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}{submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const EMPTY_STEP: StepFormData = { name: '', type: 'manual', order: 1, on_failure: 'block', retry_count: 0, timeout_seconds: 300, script_id: '', script_params: {} };

export default function BlueprintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;

  const [showAddStep, setShowAddStep] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newStep, setNewStep] = useState<StepFormData>(EMPTY_STEP);

  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [editData, setEditData] = useState<StepFormData>(EMPTY_STEP);

  const { data: blueprint, isLoading: bpLoading } = useQuery<Blueprint>({
    queryKey: ['blueprint', id],
    queryFn: async () => {
      const res = await blueprintsApi.get(id);
      return res.data;
    },
  });

  const { data: steps, isLoading: stepsLoading } = useQuery<Step[]>({
    queryKey: ['steps', id],
    queryFn: async () => {
      const res = await stepsApi.list(id);
      return res.data?.items ?? res.data ?? [];
    },
  });

  const { data: runsData } = useQuery<Run[]>({
    queryKey: ['blueprint-runs', id],
    queryFn: async () => {
      const res = await runsApi.list({ blueprint_id: id, page: 1, limit: 50, sort: 'started_at', order: 'desc' });
      const d = res.data;
      if (Array.isArray(d)) return d;
      if (Array.isArray(d?.items)) return d.items;
      return [];
    },
    refetchInterval: 5000,
  });

  const deleteRunMutation = useMutation({
    mutationFn: (runId: string) => runsApi.delete(runId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blueprint-runs', id] });
      qc.invalidateQueries({ queryKey: ['blueprint', id] });
      toast.success('Run deleted');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete run'),
  });
  const blueprintRuns: Run[] = (runsData ?? []).slice().sort((a, b) => {
    const at = a.started_at ?? a.created_at ?? '';
    const bt = b.started_at ?? b.created_at ?? '';
    return bt.localeCompare(at);
  });

  const { data: scriptsData } = useQuery<PaginatedResponse<Script>>({
    queryKey: ['scripts-list'],
    queryFn: async () => {
      const res = await scriptsApi.list({ page: 1, limit: 100, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  const scriptsList: Script[] = scriptsData?.items ?? [];
  const scriptsById: Record<string, string> = {};
  scriptsList.forEach((s) => { scriptsById[s.id] = s.name; });

  const publishMutation = useMutation({
    mutationFn: () => blueprintsApi.publish(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blueprint', id] });
      toast.success('Blueprint published');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to publish'),
  });

  const runMutation = useMutation({
    mutationFn: () => runsApi.create(id),
    onSuccess: () => {
      toast.success('Run started');
      qc.invalidateQueries({ queryKey: ['blueprint-runs', id] });
      qc.invalidateQueries({ queryKey: ['blueprint', id] });
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to start run'),
  });

  const addStepMutation = useMutation({
    mutationFn: () =>
      stepsApi.create(id, {
        name: newStep.name,
        type: newStep.type,
        order: newStep.order,
        on_failure: newStep.on_failure,
        retry_count: newStep.retry_count,
        timeout_seconds: newStep.timeout_seconds,
        dependencies: [],
        ...(newStep.type === 'script' && newStep.script_id ? { script_id: newStep.script_id } : {}),
        ...(newStep.type === 'script' ? { script_params: newStep.script_params } : {}),
      }),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['steps', id] });
      toast.success('Step added');
      setShowAddStep(false);
      setNewStep(EMPTY_STEP);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to add step'),
  });

  const updateStepMutation = useMutation({
    mutationFn: () =>
      stepsApi.update(id, editingStep!.id, {
        name: editData.name,
        type: editData.type,
        order: editData.order,
        on_failure: editData.on_failure,
        retry_count: editData.retry_count,
        timeout_seconds: editData.timeout_seconds,
        script_id: editData.type === 'script' && editData.script_id ? editData.script_id : null,
        ...(editData.type === 'script' ? { script_params: editData.script_params } : { script_params: null }),
      }),
    onSuccess: () => {
      qc.refetchQueries({ queryKey: ['steps', id] });
      toast.success('Step updated');
      setEditingStep(null);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to update step'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => blueprintsApi.delete(id),
    onSuccess: () => {
      toast.success('Blueprint deleted');
      router.push('/blueprints');
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to delete'),
  });

  const toggleSequentialMutation = useMutation({
    mutationFn: (val: boolean) => blueprintsApi.update(id, { sequential: val }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['blueprint', id] });
      qc.invalidateQueries({ queryKey: ['blueprints'] });
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to update'),
  });

  function openEdit(step: Step) {
    setEditingStep(step);
    setEditData({
      name: step.name,
      type: step.type,
      order: step.order,
      on_failure: step.on_failure,
      retry_count: step.retry_count,
      timeout_seconds: step.timeout_seconds,
      script_id: step.script_id ?? '',
      script_params: (step.script_params as Record<string, unknown>) ?? {},
    });
  }

  if (bpLoading) {
    return (
      <AppShell title="Blueprint">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!blueprint) {
    return (
      <AppShell title="Blueprint">
        <div className="p-6 text-slate-500">Blueprint not found</div>
      </AppShell>
    );
  }

  return (
    <AppShell title={blueprint.name}>
      <div className="p-6 space-y-5">
        {/* Back + header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-2 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-100">{blueprint.name}</h1>
              <StatusBadge status={blueprint.status} />
              <span className="text-xs text-slate-400">v{blueprint.version}</span>
            </div>
            {blueprint.description && (
              <p className="text-sm text-slate-500 mt-1">{blueprint.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <RoleGate minRole="executor">
              <button
                onClick={() => runMutation.mutate()}
                disabled={runMutation.isPending || blueprint.status !== 'published'}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
                title={blueprint.status !== 'published' ? 'Publish blueprint first' : ''}
              >
                <Play className="w-4 h-4" />
                Run
              </button>
            </RoleGate>
            <RoleGate minRole="editor">
              {blueprint.status === 'draft' && (
                <button
                  onClick={() => publishMutation.mutate()}
                  disabled={publishMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors"
                >
                  <Globe className="w-4 h-4" />
                  Publish
                </button>
              )}
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center gap-2 px-3 py-2 text-red-600 border border-red-200 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </RoleGate>
          </div>
        </div>

        {/* Details + Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Info card */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              Details
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={blueprint.status} />
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Version</span>
                <span className="text-slate-300 font-medium">v{blueprint.version}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Steps</span>
                <span className="text-slate-300 font-medium">{blueprint.step_count}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Runs</span>
                <span className="text-slate-300 font-medium">{blueprint.run_count}</span>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-slate-500">Sequential</p>
                  <p className="text-xs text-slate-600 mt-0.5">Steps run in order</p>
                </div>
                <RoleGate minRole="editor" fallback={
                  <span className="text-slate-300 font-medium">{!!blueprint.sequential ? 'Yes' : 'No'}</span>
                }>
                  <input
                    type="checkbox"
                    checked={!!blueprint.sequential}
                    disabled={toggleSequentialMutation.isPending}
                    onChange={(e) => toggleSequentialMutation.mutate(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-900 cursor-pointer"
                  />
                </RoleGate>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">ID</span>
                <CopyId value={id} />
              </div>
            </div>
          </div>

          {/* Steps tree */}
          <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-700">
            <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-200">
                  Steps ({steps?.length ?? 0})
                </h2>
                {!!blueprint.sequential && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-indigo-900/30 text-indigo-400 border-indigo-700">Sequential</span>
                )}
              </div>
              <RoleGate minRole="editor">
                <button
                  onClick={() => { setNewStep({ ...EMPTY_STEP, order: (steps?.length ?? 0) + 1 }); setShowAddStep(true); }}
                  className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </RoleGate>
            </div>
            <div className="p-3">
              {stepsLoading ? (
                <div className="py-8 text-center text-slate-500 text-sm">Loading steps...</div>
              ) : !steps || steps.length === 0 ? (
                <div className="py-8 text-center">
                  <Code2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">No steps yet</p>
                  <RoleGate minRole="editor">
                    <button
                      onClick={() => { setNewStep({ ...EMPTY_STEP, order: 1 }); setShowAddStep(true); }}
                      className="mt-2 text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      Add first step
                    </button>
                  </RoleGate>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {[...steps].sort((a, b) => a.order - b.order).map((step, idx) => (
                    <StepNode
                      key={step.id}
                      step={step}
                      blueprintId={id}
                      scriptsById={scriptsById}
                      onEdit={openEdit}
                      sequential={!!blueprint.sequential}
                      index={idx + 1}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Runs table */}
        <div className="bg-slate-900 rounded-xl border border-slate-700">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Runs ({blueprintRuns.length})</h2>
            <Link href="/runs" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">View all</Link>
          </div>
          {blueprintRuns.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-sm">No runs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Run ID</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Triggered By</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Started</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Duration</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {blueprintRuns.map((run) => {
                    const p = run.progress;
                    const detail = (p && typeof p === 'object' && 'percentage' in p) ? p as RunProgress : null;
                    const pct = run.status === 'completed' ? 100
                      : run.status === 'not_started' ? 0
                      : detail ? detail.percentage
                      : typeof p === 'number' && Number.isFinite(p) ? p : 0;
                    return (
                      <tr key={run.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3">
                          <Link href={`/runs/${run.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 font-mono">
                            {run.id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={run.status as RunStatus} /></td>
                        <td className="px-5 py-3 w-40">
                          <ProgressBar value={pct} showLabel color={runStatusColor(run.status as RunStatus)} />
                          {detail && detail.total > 0 && (
                            <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">
                              {detail.completed}✓ {detail.failed > 0 ? `${detail.failed}✗ ` : ''}{detail.skipped > 0 ? `${detail.skipped} skip ` : ''}{detail.in_progress > 0 ? `${detail.in_progress} active` : ''}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-400">{run.triggered_by ?? '—'}</td>
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {run.started_at ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(run.started_at), 'MMM d, HH:mm')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-500">{
                          (() => {
                            const secs = run.duration ??
                              (run.started_at && run.completed_at
                                ? Math.round((new Date(run.completed_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                                : null);
                            return secs != null ? `${secs}s` : '—';
                          })()
                        }</td>
                        <td className="px-4 py-3">
                          <RoleGate minRole="editor">
                            <button
                              onClick={() => deleteRunMutation.mutate(run.id)}
                              disabled={deleteRunMutation.isPending || ['in_progress', 'not_started', 'paused'].includes(run.status)}
                              title={['in_progress', 'not_started', 'paused'].includes(run.status) ? 'Cancel run before deleting' : 'Delete run'}
                              className="p-1.5 text-slate-600 hover:text-red-400 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </RoleGate>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add step modal */}
      {showAddStep && (
        <StepModal
          title="Add Step"
          data={newStep}
          onChange={setNewStep}
          onSubmit={() => addStepMutation.mutate()}
          onClose={() => { setShowAddStep(false); setNewStep(EMPTY_STEP); }}
          submitting={addStepMutation.isPending}
          submitLabel="Add Step"
          scripts={scriptsList}
        />
      )}

      {/* Edit step modal */}
      {editingStep && (
        <StepModal
          title={`Edit Step — ${editingStep.name}`}
          data={editData}
          onChange={setEditData}
          onSubmit={() => updateStepMutation.mutate()}
          onClose={() => setEditingStep(null)}
          submitting={updateStepMutation.isPending}
          submitLabel="Save Changes"
          scripts={scriptsList}
        />
      )}

      <ConfirmDialog
        open={showDelete}
        title="Delete Blueprint"
        message={`Delete "${blueprint.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => deleteMutation.mutate()}
        onCancel={() => setShowDelete(false)}
      />
    </AppShell>
  );
}
