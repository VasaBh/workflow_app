'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { runsApi, blueprintsApi, getAccessToken } from '@/lib/api';
import { createRunWebSocket } from '@/lib/ws';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar, { runStatusColor } from '@/components/ui/ProgressBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RoleGate from '@/components/ui/RoleGate';
import { Run, RunProgress, StepRun, LogEntry, RunStatus, StepStatus } from '@/types';
import {
  ArrowLeft, Pause, Play, XCircle, RefreshCw, CheckCircle, XIcon,
  ChevronDown, ChevronRight, Terminal, Loader2, Clock, AlertCircle,
  Circle, MinusCircle, Lock, Copy, Check,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import clsx from 'clsx';

function CopyId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-slate-500 font-mono mt-0.5 hover:text-slate-300 transition-colors group">
      <span>{value}</span>
      {copied ? <Check className="w-3 h-3 text-green-400 flex-shrink-0" /> : <Copy className="w-3 h-3 flex-shrink-0 opacity-0 group-hover:opacity-100" />}
    </button>
  );
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  INFO:    'text-blue-400',
  DEBUG:   'text-slate-400',
  WARNING: 'text-yellow-400',
  ERROR:   'text-red-400',
};

function StepRunNode({ stepRun, runId, level = 0 }: { stepRun: StepRun; runId: string; level?: number }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [showComplete, setShowComplete] = useState(false);

  const { data: logs } = useQuery<string[]>({
    queryKey: ['step-logs', runId, stepRun.id],
    queryFn: async () => {
      const res = await runsApi.stepLogs(runId, stepRun.id);
      const raw = res.data?.logs ?? res.data?.items ?? [];
      return Array.isArray(raw) ? raw : [];
    },
    enabled: showLogs,
    refetchInterval: showLogs ? 5000 : false,
  });

  const invalidateRun = () => {
    qc.invalidateQueries({ queryKey: ['run-steps', runId] });
    qc.invalidateQueries({ queryKey: ['run', runId] });
    qc.invalidateQueries({ queryKey: ['runs'] });
  };

  const approveMutation = useMutation({
    mutationFn: () => runsApi.approveStep(runId, stepRun.id, approveNotes),
    onSuccess: () => { invalidateRun(); toast.success('Step approved'); setShowApprove(false); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to approve'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => runsApi.rejectStep(runId, stepRun.id, rejectReason),
    onSuccess: () => { invalidateRun(); toast.success('Step rejected'); setShowReject(false); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to reject'),
  });

  const completeMutation = useMutation({
    mutationFn: () => runsApi.completeStep(runId, stepRun.id, {}, completeNotes),
    onSuccess: () => { invalidateRun(); toast.success('Step completed'); setShowComplete(false); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to complete'),
  });

  const hasChildren = stepRun.children && stepRun.children.length > 0;

  const STATUS_ICONS: Record<string, React.ReactNode> = {
    completed:        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />,
    failed:           <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
    in_progress:      <Loader2 className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />,
    pending_approval: <Clock className="w-4 h-4 text-orange-400 flex-shrink-0" />,
    blocked:          <Lock className="w-4 h-4 text-orange-400 flex-shrink-0" />,
    not_started:      <Circle className="w-4 h-4 text-slate-500 flex-shrink-0" />,
    skipped:          <MinusCircle className="w-4 h-4 text-slate-500 flex-shrink-0" />,
    paused:           <Pause className="w-4 h-4 text-yellow-500 flex-shrink-0" />,
  };
  const statusIcon = STATUS_ICONS[stepRun.status] ?? <Circle className="w-4 h-4 text-slate-600 flex-shrink-0" />;

  return (
    <div className={clsx(level > 0 && 'ml-6 border-l border-slate-700 pl-3')}>
      <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-800 group transition-colors">
        {hasChildren ? (
          <button onClick={() => setExpanded(!expanded)} className="text-slate-400">
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        ) : <span className="w-3.5" />}
        {statusIcon}
        <span className="text-sm font-medium text-slate-200 flex-1 truncate">{stepRun.name}</span>
        {stepRun.type && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border flex-shrink-0 ${
            stepRun.type === 'script'   ? 'bg-indigo-900/30 text-indigo-400 border-indigo-700' :
            stepRun.type === 'approval' ? 'bg-orange-900/30 text-orange-400 border-orange-700' :
                                          'bg-slate-800 text-slate-400 border-slate-600'
          }`}>{stepRun.type}</span>
        )}
        <StatusBadge status={stepRun.status as StepStatus} />
        {stepRun.duration != null && (
          <span className="text-xs text-slate-400">{Math.round(stepRun.duration)}s</span>
        )}

        {/* Action buttons — always visible when action is needed */}
        {stepRun.type === 'manual' && (stepRun.status === 'in_progress' || stepRun.status === 'blocked') && (
          <RoleGate minRole="executor">
            <button
              onClick={() => setShowComplete(true)}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-900/40 text-green-400 border border-green-700 rounded-lg hover:bg-green-900/60 transition-colors flex-shrink-0"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Complete
            </button>
          </RoleGate>
        )}
        {stepRun.type === 'approval' && (stepRun.status === 'pending_approval' || stepRun.status === 'blocked' || stepRun.status === 'in_progress') && (
          <RoleGate minRole="editor">
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => setShowApprove(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-green-900/40 text-green-400 border border-green-700 rounded-lg hover:bg-green-900/60 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" /> Approve
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-900/40 text-red-400 border border-red-700 rounded-lg hover:bg-red-900/60 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </div>
          </RoleGate>
        )}

        {/* Logs — visible on hover */}
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            title="View logs"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error display */}
      {stepRun.error && (
        <div className="mx-3 mb-2 p-2 bg-red-900/30 border border-red-800 rounded-lg text-xs text-red-400 font-mono">
          {stepRun.error}
          {stepRun.error_line != null && <span className="ml-2 text-red-500">(line {stepRun.error_line})</span>}
        </div>
      )}

      {/* Log viewer */}
      {showLogs && (
        <div className="mx-3 mb-2 bg-slate-950 rounded-lg overflow-hidden border border-slate-700">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700">
            <span className="text-xs font-medium text-slate-300">Logs</span>
            <button onClick={() => setShowLogs(false)} className="text-slate-500 hover:text-slate-300">
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-3 max-h-48 overflow-y-auto font-mono text-xs space-y-1">
            {!logs || logs.length === 0 ? (
              <span className="text-slate-500">No logs yet</span>
            ) : (
              (logs as unknown as string[]).map((log, i) => {
                const line = typeof log === 'string' ? log : (log as LogEntry).message ?? String(log);
                const levelMatch = line.match(/^\[(INFO|DEBUG|WARNING|ERROR)\]/);
                const level = levelMatch?.[1] ?? '';
                return (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500 flex-shrink-0 select-none">{String(i + 1).padStart(3, ' ')}.</span>
                    <span className={`break-all ${LOG_LEVEL_COLORS[level] ?? 'text-slate-200'}`}>{line}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Children */}
      {hasChildren && expanded && stepRun.children!.map((child) => (
        <StepRunNode key={child.id} stepRun={child} runId={runId} level={level + 1} />
      ))}

      {/* Approve modal */}
      {showApprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowApprove(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Approve Step</h3>
            <textarea
              value={approveNotes}
              onChange={(e) => setApproveNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowApprove(false)} className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg">
                {approveMutation.isPending ? 'Approving...' : 'Approve'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {showReject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowReject(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Reject Step</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
              className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowReject(false)} className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending || !rejectReason} className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-60">
                {rejectMutation.isPending ? 'Rejecting...' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete modal */}
      {showComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowComplete(false)} />
          <div className="relative bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-100 mb-3">Complete Step</h3>
            <textarea
              value={completeNotes}
              onChange={(e) => setCompleteNotes(e.target.value)}
              placeholder="Notes (optional)"
              rows={3}
              className="w-full px-3 py-2 text-sm bg-slate-800 text-slate-100 placeholder-slate-500 border border-slate-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowComplete(false)} className="px-3 py-1.5 text-sm text-slate-300 border border-slate-600 rounded-lg hover:bg-slate-800">Cancel</button>
              <button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending} className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg">
                {completeMutation.isPending ? 'Completing...' : 'Complete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function parseProgress(run: Run): { pct: number; detail: RunProgress | null } {
  if (run.status === 'completed') return { pct: 100, detail: null };
  if (run.status === 'not_started') return { pct: 0, detail: null };
  const p = run.progress;
  if (p && typeof p === 'object' && 'percentage' in p) {
    return { pct: (p as RunProgress).percentage, detail: p as RunProgress };
  }
  if (typeof p === 'number' && Number.isFinite(p)) return { pct: p, detail: null };
  return { pct: 0, detail: null };
}

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const qc = useQueryClient();
  const id = params.id as string;
  const wsRef = useRef<WebSocket | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const { data: run, isLoading: runLoading } = useQuery<Run>({
    queryKey: ['run', id],
    queryFn: async () => {
      const res = await runsApi.get(id);
      return res.data;
    },
    refetchInterval: (query) => {
      const status = (query.state.data as Run | undefined)?.status;
      return status && ['in_progress', 'not_started', 'paused'].includes(status) ? 3000 : false;
    },
  });

  const { data: stepRuns, isLoading: stepsLoading } = useQuery<StepRun[]>({
    queryKey: ['run-steps', id],
    queryFn: async () => {
      const res = await runsApi.steps(id);
      return res.data?.items ?? res.data ?? [];
    },
    refetchInterval: 5000,
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

  // WebSocket for live updates
  useEffect(() => {
    const token = getAccessToken() ?? '';
    const ws = createRunWebSocket(id, token, (data) => {
      const msg = data as {
        run_id?: string;
        run_status?: string;
        step_updates?: Array<{
          step_run_id: string;
          step_id: string;
          name: string;
          status: string;
          started_at?: string | null;
          completed_at?: string | null;
        }>;
        timestamp?: string;
      };

      // Patch run status immediately — no waiting for refetch
      if (msg.run_status) {
        qc.setQueryData<Run>(['run', id], (old) =>
          old ? { ...old, status: msg.run_status as RunStatus } : old,
        );
      }

      // Patch step statuses immediately
      if (msg.step_updates?.length) {
        const applyUpdates = (steps: StepRun[]): StepRun[] =>
          steps.map((s) => {
            const u = msg.step_updates!.find((u) => u.step_run_id === s.id);
            const patched = u
              ? {
                  ...s,
                  status: u.status as StepStatus,
                  started_at: u.started_at ?? s.started_at,
                  completed_at: u.completed_at ?? s.completed_at,
                }
              : s;
            return patched.children?.length
              ? { ...patched, children: applyUpdates(patched.children) }
              : patched;
          });

        qc.setQueryData<StepRun[]>(['run-steps', id], (old) =>
          old ? applyUpdates(old) : old,
        );
      }

      // Still invalidate to pull full data (progress %, duration, etc.)
      qc.invalidateQueries({ queryKey: ['run', id] });
      qc.invalidateQueries({ queryKey: ['run-steps', id] });
    });
    wsRef.current = ws;
    return () => ws.close();
  }, [id, qc]);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ['run', id] });
    qc.invalidateQueries({ queryKey: ['run-steps', id] });
    qc.invalidateQueries({ queryKey: ['runs'] });
  };

  const pauseMutation = useMutation({
    mutationFn: () => runsApi.pause(id),
    onSuccess: () => { invalidateAll(); toast.success('Run paused'); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to pause'),
  });

  const resumeMutation = useMutation({
    mutationFn: () => runsApi.resume(id),
    onSuccess: () => { invalidateAll(); toast.success('Run resumed'); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to resume'),
  });

  const SKIPPABLE = new Set(['not_started', 'blocked', 'pending_approval']);

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await runsApi.cancel(id);
      // Skip all pending steps via API
      const current = qc.getQueryData<StepRun[]>(['run-steps', id]) ?? [];
      const collectSkippable = (steps: StepRun[]): StepRun[] =>
        steps.flatMap((s) => [
          ...(SKIPPABLE.has(s.status) ? [s] : []),
          ...(s.children ? collectSkippable(s.children) : []),
        ]);
      const toSkip = collectSkippable(current);
      await Promise.allSettled(toSkip.map((s) => runsApi.skipStep(id, s.id, 'Run cancelled')));
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Run cancelled — remaining steps skipped');
      setCancelConfirm(false);
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to cancel'),
  });

  const retryMutation = useMutation({
    mutationFn: () => runsApi.retry(id),
    onSuccess: () => { invalidateAll(); toast.success('Run retried'); },
    onError: (err: unknown) => toast.error((err as Error).message || 'Failed to retry'),
  });

  if (runLoading) {
    return (
      <AppShell title="Run">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!run) {
    return <AppShell title="Run"><div className="p-6 text-slate-500">Run not found</div></AppShell>;
  }

  const isActive = run.status === 'in_progress' || run.status === 'not_started';
  const blueprintName = (run.blueprint_id ? blueprintNames[run.blueprint_id] : null) ?? run.blueprint_name ?? 'Run';

  return (
    <AppShell title="Run Detail">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 mb-2"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-slate-100">{blueprintName}</h1>
              <CopyId value={run.id} />
              <StatusBadge status={run.status as RunStatus} />
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <RoleGate minRole="executor">
              {run.status === 'in_progress' && (
                <button
                  onClick={() => pauseMutation.mutate()}
                  disabled={pauseMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-yellow-400 bg-yellow-900/30 border border-yellow-700 rounded-lg hover:bg-yellow-900/50 disabled:opacity-60"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              {run.status === 'paused' && (
                <button
                  onClick={() => resumeMutation.mutate()}
                  disabled={resumeMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-green-400 bg-green-900/30 border border-green-700 rounded-lg hover:bg-green-900/50 disabled:opacity-60"
                >
                  <Play className="w-4 h-4" /> Resume
                </button>
              )}
              {(run.status === 'failed') && (
                <button
                  onClick={() => retryMutation.mutate()}
                  disabled={retryMutation.isPending}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-400 bg-indigo-900/30 border border-indigo-700 rounded-lg hover:bg-indigo-900/50 disabled:opacity-60"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </button>
              )}
              {isActive && (
                <button
                  onClick={() => setCancelConfirm(true)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 bg-red-900/30 border border-red-700 rounded-lg hover:bg-red-900/50"
                >
                  <XCircle className="w-4 h-4" /> Cancel
                </button>
              )}
            </RoleGate>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
          {(() => {
            const { pct, detail } = parseProgress(run);
            const total = detail?.total ?? 0;
            const barColor = runStatusColor(run.status);
            return (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-200">Progress</h2>
                  <span className="text-sm font-semibold text-slate-300">
                    {pct}%
                    {total > 0 && <span className="text-xs text-slate-500 ml-1">({total} steps)</span>}
                  </span>
                </div>
                <ProgressBar value={pct} color={barColor} />
                {detail && total > 0 && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs">
                    {detail.completed > 0 && (
                      <span className="flex items-center gap-1 text-green-400">
                        <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{detail.completed} completed
                      </span>
                    )}
                    {detail.in_progress > 0 && (
                      <span className="flex items-center gap-1 text-blue-400">
                        <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{detail.in_progress} in progress
                      </span>
                    )}
                    {detail.failed > 0 && (
                      <span className="flex items-center gap-1 text-red-400">
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{detail.failed} failed
                      </span>
                    )}
                    {detail.skipped > 0 && (
                      <span className="flex items-center gap-1 text-slate-400">
                        <span className="w-2 h-2 rounded-full bg-slate-500 inline-block" />{detail.skipped} skipped
                      </span>
                    )}
                    {detail.not_started > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-slate-700 inline-block" />{detail.not_started} not started
                      </span>
                    )}
                  </div>
                )}
              </>
            );
          })()}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-700 text-sm">
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Triggered by</p>
              <p className="font-medium text-slate-200">{run.triggered_by ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Started</p>
              <p className="font-medium text-slate-200">
                {run.started_at ? format(new Date(run.started_at), 'MMM d, HH:mm:ss') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Completed</p>
              <p className="font-medium text-slate-200">
                {run.completed_at ? format(new Date(run.completed_at), 'MMM d, HH:mm:ss') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 mb-0.5">Duration</p>
              <p className="font-medium text-slate-200">{run.duration ? `${Math.round(run.duration)}s` : '—'}</p>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-slate-900 rounded-xl border border-slate-700">
          <div className="px-5 py-4 border-b border-slate-700">
            <h2 className="text-sm font-semibold text-slate-200">Steps ({stepRuns?.length ?? 0})</h2>
          </div>
          <div className="p-3">
            {stepsLoading ? (
              <div className="py-8 text-center text-slate-500 text-sm">Loading steps...</div>
            ) : !stepRuns || stepRuns.length === 0 ? (
              <div className="py-8 text-center text-slate-500 text-sm">No step data yet</div>
            ) : (
              <div className="space-y-0.5">
                {stepRuns.map((sr) => (
                  <StepRunNode key={sr.id} stepRun={sr} runId={id} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={cancelConfirm}
        title="Cancel Run"
        message="Are you sure you want to cancel this run? This cannot be undone."
        confirmLabel="Cancel Run"
        onConfirm={() => cancelMutation.mutate()}
        onCancel={() => setCancelConfirm(false)}
      />
    </AppShell>
  );
}
