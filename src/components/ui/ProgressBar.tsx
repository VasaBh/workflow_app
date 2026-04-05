import clsx from 'clsx';

interface ProgressBarProps {
  value: number; // 0-100
  className?: string;
  showLabel?: boolean;
  color?: 'indigo' | 'green' | 'yellow' | 'red' | 'blue';
}

const colorMap = {
  indigo: 'bg-indigo-600',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
};

export default function ProgressBar({
  value,
  className,
  showLabel = false,
  color = 'indigo',
}: ProgressBarProps) {
  const safe = Number.isFinite(value) ? value : 0;
  // Normalize: if value is a fraction (0–1), scale to 0–100
  const normalized = safe > 0 && safe <= 1 ? safe * 100 : safe;
  const pct = Math.min(100, Math.max(0, normalized));

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={clsx('h-full rounded-full transition-all duration-300', colorMap[color])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-500 w-8 text-right">{pct}%</span>
      )}
    </div>
  );
}
