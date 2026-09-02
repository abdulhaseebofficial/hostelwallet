import { cn } from '../../utils/format';

const TONES = {
  brand: 'bg-brand-600',
  safe: 'bg-safe',
  warning: 'bg-caution',
  over: 'bg-danger',
  none: 'bg-slate-300 dark:bg-slate-700',
};

/** Animated progress bar used by goals and budget lines. */
export default function ProgressBar({ value = 0, tone = 'brand', size = 'md', label, className = '' }) {
  const percent = Math.max(0, Math.min(100, Number(value) || 0));
  const height = size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2';

  return (
    <div className={className}>
      <div
        className={cn('w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800', height)}
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'progress'}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-700 ease-out', TONES[tone] || TONES.brand)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
