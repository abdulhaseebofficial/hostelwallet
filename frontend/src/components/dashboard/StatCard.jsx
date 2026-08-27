import ProgressBar from '../ui/ProgressBar';
import { cn, formatMoney } from '../../utils/format';

const TONES = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400',
  safe: 'bg-safe/10 text-safe dark:bg-safe/15 dark:text-safe',
  caution: 'bg-caution/10 text-caution dark:bg-caution/15 dark:text-caution',
  danger: 'bg-danger/10 text-danger dark:bg-danger/15 dark:text-danger',
  neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

/**
 * Headline number tile. A number this important is not a chart - it is a big
 * figure with a label, optionally with a progress bar and a footnote.
 */
export default function StatCard({
  label,
  value,
  currency = 'INR',
  raw = false,
  icon: Icon,
  tone = 'brand',
  progress,
  progressTone,
  footnote,
  className = '',
}) {
  return (
    <div className={cn('hw-card p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-snug text-slate-500 dark:text-slate-400">{label}</p>
        {Icon && (
          <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', TONES[tone])}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>

      <p className="mt-2 break-words text-lg font-extrabold tabular-nums text-slate-900 sm:text-2xl dark:text-slate-100">
        {raw ? value : formatMoney(value, currency)}
      </p>

      {progress !== undefined && (
        <ProgressBar value={progress} tone={progressTone || tone} size="sm" className="mt-3" label={label} />
      )}

      {footnote && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{footnote}</p>}
    </div>
  );
}
