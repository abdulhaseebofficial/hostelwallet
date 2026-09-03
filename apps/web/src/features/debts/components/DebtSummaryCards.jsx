import { ArrowDownLeft, ArrowUpRight, Scale, AlertTriangle } from 'lucide-react';
import StatCard from '../../../shared/components/StatCard';
import Skeleton from '../../../shared/components/ui/Skeleton';

/**
 * The four figures a student actually wants: what they owe, what they are
 * owed, where that leaves them, and what is late.
 *
 * Every number comes from the server. Nothing is added up here - the balances
 * are exact decimal sums in SQL, and re-deriving them in JavaScript is how the
 * two would eventually disagree.
 */
export default function DebtSummaryCards({ summary, currency = 'PKR', loading = false }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[104px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const payable = summary?.payable || 0;
  const receivable = summary?.receivable || 0;
  const net = summary?.netBalance || 0;
  const overdue = summary?.overdue || 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="You have to pay"
        value={payable}
        currency={currency}
        icon={ArrowUpRight}
        tone="danger"
        footnote={payable > 0 ? 'Money you borrowed and still owe' : 'You owe nobody'}
      />
      <StatCard
        label="You have to receive"
        value={receivable}
        currency={currency}
        icon={ArrowDownLeft}
        tone="brand"
        footnote={receivable > 0 ? 'Money you lent and have not got back' : 'Nobody owes you'}
      />
      <StatCard
        label="Net balance"
        value={net}
        currency={currency}
        icon={Scale}
        tone={net >= 0 ? 'safe' : 'danger'}
        // Said in words as well as by colour and sign: a negative net balance
        // is not self-explanatory at a glance.
        footnote={net >= 0 ? 'In your favour' : 'You owe more than you are owed'}
      />
      <StatCard
        label="Overdue"
        value={overdue}
        currency={currency}
        icon={AlertTriangle}
        tone={overdue > 0 ? 'danger' : 'neutral'}
        footnote={
          summary?.overdueCount ? `${summary.overdueCount} record(s) past due` : 'Nothing is late'
        }
      />
    </div>
  );
}
