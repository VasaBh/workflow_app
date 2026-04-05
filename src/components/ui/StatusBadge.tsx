import clsx from 'clsx';
import { RunStatus, StepStatus, BlueprintStatus } from '@/types';

type AnyStatus = RunStatus | StepStatus | BlueprintStatus | 'active' | 'paused' | 'success' | 'failed';

const statusConfig: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  draft:            { bg: 'bg-slate-700',         text: 'text-slate-300',   ring: 'ring-slate-600/40',   label: 'Draft' },
  published:        { bg: 'bg-indigo-900/50',      text: 'text-indigo-300',  ring: 'ring-indigo-500/40',  label: 'Published' },
  archived:         { bg: 'bg-slate-700',          text: 'text-slate-400',   ring: 'ring-slate-600/40',   label: 'Archived' },
  not_started:      { bg: 'bg-slate-700',          text: 'text-slate-300',   ring: 'ring-slate-600/40',   label: 'Not Started' },
  in_progress:      { bg: 'bg-blue-900/50',        text: 'text-blue-300',    ring: 'ring-blue-500/40',    label: 'In Progress' },
  paused:           { bg: 'bg-yellow-900/40',      text: 'text-yellow-300',  ring: 'ring-yellow-500/40',  label: 'Paused' },
  completed:        { bg: 'bg-green-900/40',       text: 'text-green-300',   ring: 'ring-green-500/40',   label: 'Completed' },
  failed:           { bg: 'bg-red-900/40',         text: 'text-red-300',     ring: 'ring-red-500/40',     label: 'Failed' },
  cancelled:        { bg: 'bg-slate-700',          text: 'text-slate-400',   ring: 'ring-slate-600/40',   label: 'Cancelled' },
  pending_approval: { bg: 'bg-orange-900/40',      text: 'text-orange-300',  ring: 'ring-orange-500/40',  label: 'Pending Approval' },
  skipped:          { bg: 'bg-slate-700',          text: 'text-slate-400',   ring: 'ring-slate-600/40',   label: 'Skipped' },
  active:           { bg: 'bg-green-900/40',       text: 'text-green-300',   ring: 'ring-green-500/40',   label: 'Active' },
  success:          { bg: 'bg-green-900/40',       text: 'text-green-300',   ring: 'ring-green-500/40',   label: 'Success' },
};

interface StatusBadgeProps {
  status: AnyStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    bg: 'bg-slate-700',
    text: 'text-slate-300',
    ring: 'ring-slate-600/40',
    label: status,
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        config.bg,
        config.text,
        config.ring,
        className
      )}
    >
      {config.label}
    </span>
  );
}
