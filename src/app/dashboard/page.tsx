'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { runsApi, blueprintsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar, { runStatusColor } from '@/components/ui/ProgressBar';
import { Run, Blueprint, PaginatedResponse, RunStatus } from '@/types';
import { GitBranch, Play, CheckCircle2, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  completed:   '#22c55e',
  in_progress: '#3b82f6',
  failed:      '#ef4444',
  paused:      '#f97316',
  cancelled:   '#64748b',
  not_started: '#475569',
};

function runProgress(run: Run): number {
  if (run.status === 'completed') return 100;
  if (run.status === 'not_started') return 0;
  if (run.total_steps && run.total_steps > 0) {
    const pct = ((run.completed_steps ?? 0) / run.total_steps) * 100;
    return Number.isFinite(pct) ? Math.round(pct) : 0;
  }
  const p = run.progress;
  if (p && typeof p === 'object' && 'percentage' in p) return p.percentage;
  return typeof p === 'number' && Number.isFinite(p) ? p : 0;
}


export default function DashboardPage() {
  const { data: runsData } = useQuery<PaginatedResponse<Run>>({
    queryKey: ['runs', 'dashboard'],
    queryFn: async () => {
      const res = await runsApi.list({ limit: 100, page: 1, sort: 'created_at', order: 'desc' });
      return res.data;
    },
    refetchInterval: 15_000,
  });

  const { data: blueprintsData, isLoading: blueprintsLoading } = useQuery<PaginatedResponse<Blueprint>>({
    queryKey: ['blueprints', 'dashboard'],
    queryFn: async () => {
      const res = await blueprintsApi.list({ limit: 100, page: 1, sort: 'created_at', order: 'desc' });
      return res.data;
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const runs = runsData?.items ?? [];
  const blueprints = blueprintsData?.items ?? [];

  // Latest run per blueprint
  const latestRunByBlueprint: Record<string, Run> = {};
  for (const r of runs) {
    const existing = latestRunByBlueprint[r.blueprint_id];
    if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
      latestRunByBlueprint[r.blueprint_id] = r;
    }
  }

  const totalBlueprints = blueprints.length;
  const publishedBlueprints = blueprints.filter((b) => b.status === 'published').length;
  const totalRuns = runsData?.total ?? 0;
  const activeRuns = runs.filter((r) => r.status === 'in_progress').length;
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;

  const statusCounts: Record<string, number> = {};
  for (const r of runs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const bpRunCounts: Record<string, { name: string; completed: number; in_progress: number; failed: number; paused: number; cancelled: number }> = {};
  for (const r of runs) {
    const k = r.blueprint_id;
    if (!bpRunCounts[k]) bpRunCounts[k] = { name: r.blueprint_name ?? k.slice(0, 8), completed: 0, in_progress: 0, failed: 0, paused: 0, cancelled: 0 };
    if (r.status === 'completed')        bpRunCounts[k].completed++;
    else if (r.status === 'in_progress') bpRunCounts[k].in_progress++;
    else if (r.status === 'failed')      bpRunCounts[k].failed++;
    else if (r.status === 'paused')      bpRunCounts[k].paused++;
    else if (r.status === 'cancelled')   bpRunCounts[k].cancelled++;
  }
  const barData = Object.values(bpRunCounts).slice(0, 8);

  // Scatter chart: runs over time per blueprint
  const [scatterBpId, setScatterBpId] = useState('');
  const scatterRuns = scatterBpId ? runs.filter((r) => r.blueprint_id === scatterBpId) : runs;

  const SCATTER_STATUSES = ['completed', 'in_progress', 'failed', 'paused', 'cancelled'] as const;
  const dayStatusCounts: Record<string, Record<string, number>> = {};
  for (const r of scatterRuns) {
    const d = r.started_at ?? r.created_at;
    if (!d) continue;
    const day = format(new Date(d), 'yyyy-MM-dd');
    if (!dayStatusCounts[day]) dayStatusCounts[day] = {};
    dayStatusCounts[day][r.status] = (dayStatusCounts[day][r.status] ?? 0) + 1;
  }
  const scatterData: Record<string, Array<{ x: number; y: number; date: string }>> = {};
  for (const st of SCATTER_STATUSES) scatterData[st] = [];
  for (const [day, counts] of Object.entries(dayStatusCounts).sort()) {
    const ts = new Date(day).getTime();
    for (const st of SCATTER_STATUSES) {
      if (counts[st]) scatterData[st].push({ x: ts, y: counts[st], date: day });
    }
  }
  const hasScatterData = SCATTER_STATUSES.some((st) => scatterData[st].length > 0);

  const statCards = [
    { label: 'Total Blueprints', value: totalBlueprints, sub: `${publishedBlueprints} published`, icon: GitBranch, color: 'text-indigo-400', bg: 'bg-indigo-900/30' },
    { label: 'Total Runs',       value: totalRuns,        sub: `${activeRuns} active`,             icon: Play,        color: 'text-blue-400',   bg: 'bg-blue-900/30' },
    { label: 'Completed',        value: completedRuns,    sub: 'Last 100 runs',                    icon: CheckCircle2,color: 'text-green-400',  bg: 'bg-green-900/30' },
    { label: 'Failed',           value: failedRuns,       sub: 'Last 100 runs',                    icon: AlertCircle, color: 'text-red-400',    bg: 'bg-red-900/30' },
  ];

  return (
    <AppShell title="Dashboard">
      <div className="p-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-slate-900 rounded-xl border border-slate-700 p-5 flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-100">{card.value}</p>
                  <p className="text-sm font-medium text-slate-300">{card.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{card.sub}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Blueprint Summary */}
        <div className="bg-slate-900 rounded-xl border border-slate-700">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Blueprint Summary</h2>
            <Link href="/blueprints" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              View all
            </Link>
          </div>
          {blueprintsLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">Loading...</div>
          ) : blueprints.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No blueprints yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Name</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Steps</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Runs</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Version</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Last Run</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Run Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Triggered By</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {[...blueprints].filter((bp) => bp.status === 'published').sort((a, b) => {
                    const aRun = latestRunByBlueprint[a.id];
                    const bRun = latestRunByBlueprint[b.id];
                    const aTime = (aRun?.started_at ?? aRun?.created_at) ?? '';
                    const bTime = (bRun?.started_at ?? bRun?.created_at) ?? '';
                    return bTime.localeCompare(aTime);
                  }).map((bp) => {
                    const lastRun = latestRunByBlueprint[bp.id];
                    const now = new Date();
                    const runDate = lastRun ? new Date(lastRun.started_at ?? lastRun.created_at ?? '') : null;
                    const ranToday = runDate && !isNaN(runDate.getTime()) &&
                      runDate.getFullYear() === now.getFullYear() &&
                      runDate.getMonth() === now.getMonth() &&
                      runDate.getDate() === now.getDate();
                    const borderColor = ranToday
                      ? lastRun?.status === 'completed'   ? 'border-l-green-500'
                        : lastRun?.status === 'in_progress' ? 'border-l-blue-500'
                        : lastRun?.status === 'failed'      ? 'border-l-red-500'
                        : lastRun?.status === 'paused'      ? 'border-l-orange-500'
                        : lastRun?.status === 'cancelled'   ? 'border-l-slate-500'
                        : 'border-l-slate-700'
                      : '';
                    return (
                      <tr key={bp.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className={`px-5 py-3 ${ranToday ? `border-l-[6px] ${borderColor}` : ''}`}>
                          <Link href={`/blueprints/${bp.id}`} className="font-medium text-indigo-400 hover:text-indigo-300">
                            {bp.name}
                          </Link>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge status={bp.status} />
                        </td>
                        <td className="px-5 py-3 text-slate-400">{bp.step_count}</td>
                        <td className="px-5 py-3 text-slate-400">{bp.run_count}</td>
                        <td className="px-5 py-3 text-slate-500">v{bp.version}</td>
                        <td className="px-5 py-3">
                          {lastRun ? (
                            <Link href={`/runs/${lastRun.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 font-mono">
                              {lastRun.id.slice(0, 8)}…
                            </Link>
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          {lastRun ? <StatusBadge status={lastRun.status as RunStatus} /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 w-32">
                          {lastRun ? (
                            <ProgressBar
                              value={runProgress(lastRun)}
                              showLabel
                              color={runStatusColor(lastRun.status)}
                            />
                          ) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3 text-slate-400">{lastRun?.triggered_by ?? '—'}</td>
                        <td className="px-5 py-3 text-slate-500 whitespace-nowrap">
                          {lastRun?.started_at ? (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              {format(new Date(lastRun.started_at), 'MMM d, HH:mm')}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200">Run Status Distribution</h2>
            </div>
            {runs.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={STATUS_COLORS[entry.name] ?? '#475569'} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: number, name: string) => [v, name.replace(/_/g, ' ')]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #334155', background: '#1e293b', fontSize: 12, color: '#f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Runs Over Time scatter */}
          <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-200">Runs Over Time</h2>
              </div>
              <select
                value={scatterBpId}
                onChange={(e) => setScatterBpId(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-800 text-slate-200 border border-slate-600 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Blueprints</option>
                {blueprints.map((bp) => (
                  <option key={bp.id} value={bp.id}>{bp.name}</option>
                ))}
              </select>
            </div>
            {!hasScatterData ? (
              <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <ScatterChart margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="x" type="number" domain={['auto', 'auto']} scale="time"
                    tickFormatter={(ts) => format(new Date(ts), 'MMM d')}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                  <YAxis dataKey="y" type="number" allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} />
                  <ZAxis range={[40, 40]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3', stroke: '#475569' }}
                    content={({ payload }) => {
                      if (!payload?.length) return null;
                      const { date, y } = payload[0].payload as { date: string; y: number };
                      const name = payload[0].name as string;
                      return (
                        <div className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs shadow-lg">
                          <p className="text-slate-300 font-medium mb-1">{date}</p>
                          <p style={{ color: STATUS_COLORS[name] ?? '#94a3b8' }}>{name}: <span className="font-bold">{y}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} />
                  {SCATTER_STATUSES.filter((st) => scatterData[st].length > 0).map((st) => (
                    <Scatter key={st} name={st.replace(/_/g, ' ')} data={scatterData[st]} fill={STATUS_COLORS[st]} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Runs per Blueprint bar chart — full width */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <GitBranch className="w-4 h-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-200">Runs per Blueprint</h2>
          </div>
          {barData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500 text-sm">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #334155', background: '#1e293b', fontSize: 12, color: '#f1f5f9' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="completed"   stackId="a" fill="#22c55e" name="Completed" />
                <Bar dataKey="in_progress" stackId="a" fill="#3b82f6" name="In Progress" />
                <Bar dataKey="failed"      stackId="a" fill="#ef4444" name="Failed" />
                <Bar dataKey="paused"      stackId="a" fill="#f97316" name="Paused" />
                <Bar dataKey="cancelled"   stackId="a" fill="#64748b" name="Cancelled" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>
    </AppShell>
  );
}
