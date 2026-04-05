'use client';

import { useQuery } from '@tanstack/react-query';
import { runsApi, blueprintsApi } from '@/lib/api';
import AppShell from '@/components/layout/AppShell';
import StatusBadge from '@/components/ui/StatusBadge';
import ProgressBar from '@/components/ui/ProgressBar';
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
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  completed:   '#22c55e',
  in_progress: '#3b82f6',
  failed:      '#ef4444',
  paused:      '#eab308',
  cancelled:   '#94a3b8',
  not_started: '#475569',
};

export default function DashboardPage() {
  const { data: runsData, isLoading: runsLoading } = useQuery<PaginatedResponse<Run>>({
    queryKey: ['runs', 'dashboard'],
    queryFn: async () => {
      const res = await runsApi.list({ limit: 10, page: 1, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  const { data: blueprintsData, isLoading: blueprintsLoading } = useQuery<PaginatedResponse<Blueprint>>({
    queryKey: ['blueprints', 'dashboard'],
    queryFn: async () => {
      const res = await blueprintsApi.list({ limit: 100, page: 1, sort: 'created_at', order: 'desc' });
      return res.data;
    },
  });

  const runs = runsData?.items ?? [];
  const blueprints = blueprintsData?.items ?? [];

  const blueprintNames: Record<string, string> = {};
  blueprints.forEach((b) => { blueprintNames[b.id] = b.name; });

  const totalBlueprints = blueprints.length;
  const publishedBlueprints = blueprints.filter((b) => b.status === 'published').length;
  const totalRuns = runsData?.total ?? 0;
  const completedRuns = runs.filter((r) => r.status === 'completed').length;
  const failedRuns = runs.filter((r) => r.status === 'failed').length;
  const activeRuns = runs.filter((r) => r.status === 'in_progress').length;

  const statusCounts: Record<string, number> = {};
  for (const r of runs) {
    statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
  }
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  const bpRunCounts: Record<string, { name: string; runs: number }> = {};
  for (const r of runs) {
    const k = r.blueprint_id;
    if (!bpRunCounts[k]) bpRunCounts[k] = { name: r.blueprint_name ?? k.slice(0, 8), runs: 0 };
    bpRunCounts[k].runs++;
  }
  const barData = Object.values(bpRunCounts).slice(0, 6);

  const statCards = [
    { label: 'Total Blueprints', value: totalBlueprints, sub: `${publishedBlueprints} published`, icon: GitBranch, color: 'text-indigo-400', bg: 'bg-indigo-900/30' },
    { label: 'Total Runs',       value: totalRuns,        sub: `${activeRuns} active`,             icon: Play,        color: 'text-blue-400',   bg: 'bg-blue-900/30' },
    { label: 'Completed',        value: completedRuns,    sub: 'Last 10 runs',                     icon: CheckCircle2,color: 'text-green-400',  bg: 'bg-green-900/30' },
    { label: 'Failed',           value: failedRuns,       sub: 'Last 10 runs',                     icon: AlertCircle, color: 'text-red-400',    bg: 'bg-red-900/30' },
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
                    formatter={(v: number, name: string) => [v, name.replace('_', ' ')]}
                    contentStyle={{ borderRadius: 8, border: '1px solid #334155', background: '#1e293b', fontSize: 12, color: '#f1f5f9' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

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
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #334155', background: '#1e293b', fontSize: 12, color: '#f1f5f9' }} />
                  <Bar dataKey="runs" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent runs table */}
        <div className="bg-slate-900 rounded-xl border border-slate-700">
          <div className="px-5 py-4 border-b border-slate-700 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Recent Runs</h2>
            <Link href="/runs" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
              View all
            </Link>
          </div>
          {runsLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">Loading...</div>
          ) : runs.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No runs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Blueprint</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Progress</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Triggered by</th>
                    <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {runs.map((run) => (
                    <tr key={run.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
                        <Link href={`/runs/${run.id}`} className="font-medium text-indigo-400 hover:text-indigo-300">
                          {blueprintNames[run.blueprint_id] ?? run.blueprint_name ?? run.blueprint_id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <StatusBadge status={run.status as RunStatus} />
                      </td>
                      <td className="px-5 py-3 w-32">
                        <ProgressBar value={run.progress} showLabel />
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Blueprint summary */}
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {blueprints.slice(0, 5).map((bp) => (
                    <tr key={bp.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="px-5 py-3">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
