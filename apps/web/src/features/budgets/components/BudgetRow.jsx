import { AlertTriangle, CheckCircle2, Pencil, TriangleAlert } from 'lucide-react';
import ProgressBar from '../../../shared/components/ui/ProgressBar';
import { STATUS_STYLES, categoryEmoji } from '../../../shared/utils/constants';
import { cn, formatMoney } from '../../../shared/utils/format';

// Status is carried by an icon AND a text label, never by colour alone.
const STATUS_ICON = {
  safe: CheckCircle2,
  warning: TriangleAlert,
  over: AlertTriangle,
  none: null,
};

/** One category budget: limit, spend, and a traffic-light bar. */
export default function BudgetRow({ row, currency = 'INR', onEdit }) {
  const style = STATUS_STYLES[row.status] || STATUS_STYLES.none;
  const Icon = STATUS_ICON[row.status];

  return (
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="mb-2 flex items-center gap-2.5">
        <span className="text-base" aria-hidden="true">
          {categoryEmoji(row.category)}
        </span>

        <span className="min-w-0 flex-1 text-sm font-medium leading-snug text-slate-800 dark:text-slate-200">
          {row.category}
        </span>

        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold', style.bg, style.text)}>
          {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
          {style.label}
        </span>

        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(row)}
            aria-label={`Edit the ${row.category} budget`}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ProgressBar value={row.usedPercent} tone={row.status} label={`${row.category} budget used`} />

      <p className="mt-1.5 flex justify-between text-xs tabular-nums text-slate-500 dark:text-slate-400">
        <span>
          {formatMoney(row.spent, currency)} of {formatMoney(row.limit, currency)} ({row.usedPercent}%)
        </span>
        <span className={row.remaining < 0 ? 'font-semibold text-danger' : ''}>
          {row.remaining < 0
            ? `${formatMoney(Math.abs(row.remaining), currency)} over`
            : `${formatMoney(row.remaining, currency)} left`}
        </span>
      </p>
    </li>
  );
}
