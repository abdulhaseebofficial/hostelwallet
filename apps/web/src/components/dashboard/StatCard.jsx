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
 *
 * `hero` marks the one figure the student opened the app to see. Without it a
 * row of four identical tiles gives "money left this month" exactly as much
 * weight as "safe to spend per day", and leaves the reader to do the ranking.
 *
 * `decimals` exists because student money is round money: a daily allowance
 * reads as Rs 2,033, not Rs 2,032.67. Pass 2 where the paisa genuinely matter.
 */
export default function StatCard({
  label,
  value,
  currency = 'PKR',
  raw = false,
  decimals,
  icon: Icon,
  tone = 'brand',
  hero = false,
  progress,
  progressTone,
  footnote,
  className = '',
}) {
  return (
    <div className={cn(hero ? 'hw-card-hero p-5' : 'hw-card p-5', className)}>
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            'font-medium leading-snug',
            hero
              ? 'text-sm text-slate-600 dark:text-slate-300'
              : 'text-xs text-slate-500 dark:text-slate-400'
          )}
        >
          {label}
        </p>
        {Icon && (
          <span
            className={cn(
              'flex shrink-0 items-center justify-center rounded-lg',
              hero ? 'h-9 w-9' : 'h-8 w-8',
              TONES[tone]
            )}
          >
            <Icon className={hero ? 'h-[18px] w-[18px]' : 'h-4 w-4'} aria-hidden="true" />
          </span>
        )}
      </div>

      <p
        className={cn(
          'mt-2 break-words font-extrabold tabular-nums text-slate-900 dark:text-slate-100',
          hero ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-2xl'
        )}
      >
        {raw ? value : formatMoney(value, currency, { decimals })}
      </p>

      {progress !== undefined && (
        <ProgressBar value={progress} tone={progressTone || tone} size="sm" className="mt-3" label={label} />
      )}

      {footnote && (
        <p
          className={cn(
            'mt-2 text-xs',
            hero ? 'text-slate-600 dark:text-slate-300' : 'text-slate-500 dark:text-slate-400'
          )}
        >
          {footnote}
        </p>
      )}
    </div>
  );
}
