import { Link } from 'react-router-dom';
import { ArrowRight, Receipt } from 'lucide-react';
import Card, { CardHeader } from '../ui/Card';
import EmptyState from '../ui/EmptyState';
import { useTheme } from '../../context/ThemeContext';
import { categoryColor, categoryEmoji } from '../../utils/constants';
import { formatDate, formatMoney } from '../../utils/format';

export default function RecentTransactions({ expenses = [], currency = 'INR', onAdd }) {
  const { isDark } = useTheme();

  return (
    <Card>
      <CardHeader
        title="Recent transactions"
        icon={Receipt}
        action={
          expenses.length > 0 && (
            <Link
              to="/expenses"
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              See all
              <ArrowRight className="h-3 w-3" />
            </Link>
          )
        }
      />

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No expenses yet"
          message="Add your first one and the dashboard comes alive."
          actionLabel="Add expense"
          onAction={onAdd}
        />
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {expenses.map((expense) => (
            <li key={expense._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base"
                style={{ backgroundColor: `${categoryColor(expense.category, isDark)}1f` }}
                aria-hidden="true"
              >
                {categoryEmoji(expense.category)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-900 dark:text-slate-100">
                  {expense.description || expense.category}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {expense.category} &middot; {formatDate(expense.date)}
                </p>
              </div>

              <span className="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                {formatMoney(expense.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
