import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, HandCoins } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import { StatusBadge } from './DebtBadges';
import { cn, formatMoney, formatDate } from '../../../shared/utils/format';

/**
 * The dashboard's view of udhaar: the position, and anything about to bite.
 *
 * Kept small on purpose. The dashboard is about this month's money; debt is a
 * separate question, and the widget's job is to say whether it needs attention,
 * not to reproduce the Udhaar page.
 *
 * Every figure comes from the same server summary the page uses, so the two can
 * never disagree.
 */
export default function DebtWidget({ debts, currency = 'PKR' }) {
  if (!debts) return null;

  const { payable = 0, receivable = 0, netBalance = 0, dueSoon = [], overdueCount = 0 } = debts;

  // Nothing owed in either direction, and nothing to chase: say so once and
  // take up no more room than that.
  if (payable === 0 && receivable === 0) {
    return (
      <Card>
        <CardHeader title="Udhaar" icon={HandCoins} />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Nothing borrowed, nothing lent.{' '}
          <Link to="/debts" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Add a record
          </Link>{' '}
          when that changes.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Udhaar"
        subtitle={
          overdueCount > 0
            ? `${overdueCount} record(s) past due`
            : 'Money borrowed and lent'
        }
        icon={HandCoins}
      />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">You have to pay</p>
          <p className="text-base font-bold tabular-nums text-danger">
            {formatMoney(payable, currency)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">You have to receive</p>
          <p className="text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatMoney(receivable, currency)}
          </p>
        </div>
      </div>

      <p
        className={cn(
          'mt-3 rounded-xl px-3 py-2 text-xs font-semibold',
          netBalance >= 0
            ? 'bg-safe/10 text-safe dark:bg-safe/15'
            : 'bg-danger/10 text-danger dark:bg-danger/15'
        )}
      >
        {netBalance >= 0
          ? `${formatMoney(netBalance, currency)} in your favour`
          : `${formatMoney(Math.abs(netBalance), currency)} more owed than owing`}
      </p>

      {dueSoon.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {dueSoon.slice(0, 3).map((debt) => (
            <li key={debt._id} className="flex items-center justify-between gap-2 text-xs">
              <span className="flex min-w-0 items-center gap-1.5">
                <CalendarClock
                  className={cn('h-3.5 w-3.5 shrink-0', debt.isOverdue ? 'text-danger' : 'text-slate-400')}
                  aria-hidden="true"
                />
                <span className="truncate text-slate-700 dark:text-slate-300">{debt.personName}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular-nums text-slate-500 dark:text-slate-400">
                  {formatDate(debt.dueDate)}
                </span>
                <StatusBadge debt={debt} />
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/debts"
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
      >
        Open Udhaar
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </Card>
  );
}
