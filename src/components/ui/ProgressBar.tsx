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
  const pct = Math.min(100, Math.max(0, value));

  return (
    <div className={clsx('flex items-center gap-2', className)}>
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
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
