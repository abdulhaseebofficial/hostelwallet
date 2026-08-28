import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  PieChart as PieIcon,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import { SkeletonStats, SkeletonCard } from '../components/ui/Skeleton';
import StatCard from '../components/dashboard/StatCard';
import RecentTransactions from '../components/dashboard/RecentTransactions';
import GoalsPreview from '../components/dashboard/GoalsPreview';
import BudgetRow from '../components/budget/BudgetRow';
import CategoryPieChart from '../components/charts/CategoryPieChart';
import TrendChart from '../components/charts/TrendChart';
import TipCard from '../components/ai/TipCard';
import ExpenseForm from '../components/expenses/ExpenseForm';
import EmptyState from '../components/ui/EmptyState';
import useAsync from '../hooks/useAsync';
import useCategories from '../hooks/useCategories';
import useMutation from '../hooks/useMutation';
import { useAuth } from '../context/AuthContext';
import dashboardService from '../services/dashboardService';
import expenseService from '../services/expenseService';
import { formatChange, formatMoney } from '../utils/format';

export default function Dashboard() {
  const { user, currency } = useAuth();
  const navigate = useNavigate();
  const { categories } = useCategories();

  const [addOpen, setAddOpen] = useState(false);
  const { saving, run } = useMutation();

  const load = useCallback(() => dashboardService.summary(), []);
  const { data, loading, error, reload } = useAsync(load, []);

  const addExpense = (values) =>
    run(() => expenseService.create(values), {
      success: 'Expense added',
      onDone: () => {
        setAddOpen(false);
        reload();
      },
    });

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <SkeletonStats />
        <div className="grid gap-5 lg:grid-cols-2">
          <SkeletonCard lines={6} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <EmptyState
        icon={Wallet}
        title="Could not load your dashboard"
        message={error}
        actionLabel="Try again"
        onAction={reload}
      />
    );
  }

  const { totals, categoryBreakdown, trend, comparison, budgets, goals, recentExpenses, monthLabel } = data;
  const overspending = totals.income > 0 && totals.remaining < 0;
  const firstName = user ? user.name.split(' ')[0] : 'there';

  return (
    <div className="space-y-5">
      <PageHeader
        title={`Hey ${firstName}`}
        subtitle={`${monthLabel} · ${totals.daysLeftInMonth} day${
          totals.daysLeftInMonth === 1 ? '' : 's'
        } left in the month`}
      >
        {/* Hidden on phones: the raised button in the tab bar does this job,
            and two buttons for one action just costs a screenful of space. */}
        <Button icon={Plus} onClick={() => setAddOpen(true)} className="hidden sm:inline-flex">
          Add expense
        </Button>
      </PageHeader>

      {/* Headline numbers. Two across on a phone: full-width tiles turned four
          figures into four screenfuls of scrolling to reach the charts. */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* The reason the app was opened, so it does not look like the other three. */}
        <StatCard
          hero
          label="Money left this month"
          value={totals.remaining}
          currency={currency}
          decimals={0}
          icon={Wallet}
          tone={overspending ? 'danger' : totals.spentPercent > 80 ? 'caution' : 'safe'}
          progress={Math.min(100, totals.spentPercent)}
          progressTone={overspending ? 'over' : totals.spentPercent > 80 ? 'warning' : 'safe'}
          footnote={
            overspending
              ? 'You are over your income for this month'
              : `${totals.spentPercent}% of your income used`
          }
          className="col-span-2 lg:col-span-1"
        />

        <StatCard
          label="Total spent"
          value={totals.spent}
          currency={currency}
          icon={ArrowDownRight}
          tone="danger"
          footnote={
            comparison.previousMonthSpent > 0
              ? `${formatChange(comparison.changePercent)} vs last month`
              : 'First month of tracking'
          }
        />

        <StatCard
          label="Income"
          value={totals.income}
          currency={currency}
          icon={ArrowUpRight}
          tone="safe"
          footnote={
            totals.incomeLogged > 0 ? 'From your logged income' : 'Your planned pocket money'
          }
        />

        <StatCard
          label="Safe to spend per day"
          value={totals.safeDailySpend}
          currency={currency}
          decimals={0}
          icon={CalendarDays}
          tone="brand"
          footnote={`You average ${formatMoney(totals.dailyAverage, currency, { decimals: 0 })} a day`}
          // Third of three secondary tiles, so it takes the orphan row alone.
          className="max-lg:col-span-2"
        />
      </section>

      <TipCard />

      {/* Charts */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where your money went" subtitle={monthLabel} icon={PieIcon} />
          <CategoryPieChart data={categoryBreakdown} currency={currency} total={totals.spent} />
        </Card>

        <Card>
          <CardHeader
            title="Daily spending"
            subtitle={`${totals.expenseCount} transaction${totals.expenseCount === 1 ? '' : 's'} this month`}
            icon={TrendingUp}
          />
          {/* Taller than the default: it sits beside the donut, whose legend
              runs one row per category, and a short chart left dead space. */}
          <TrendChart data={trend} currency={currency} average={totals.dailyAverage} height={340} />
        </Card>
      </section>

      {/* Lists */}
      <section className="grid gap-5 lg:grid-cols-2">
        <RecentTransactions expenses={recentExpenses} currency={currency} onAdd={() => setAddOpen(true)} />

        <div className="space-y-5">
          <GoalsPreview goals={goals} currency={currency} onCreate={() => navigate('/goals')} />

          <Card>
            <CardHeader
              title="Budget health"
              subtitle={budgets.length ? 'Categories closest to their limit' : undefined}
              icon={PieIcon}
            />
            {budgets.length === 0 ? (
              <EmptyState
                icon={PieIcon}
                title="No budgets set"
                message="Set a limit per category and HostelWallet will warn you before you blow it."
                actionLabel="Set budgets"
                onAction={() => navigate('/budget')}
              />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {budgets.slice(0, 4).map((row) => (
                  <BudgetRow key={row._id} row={row} currency={currency} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add an expense" size="md">
        <ExpenseForm
          categories={categories}
          currency={currency}
          onSubmit={addExpense}
          onCancel={() => setAddOpen(false)}
          submitting={saving}
        />
      </Modal>
    </div>
  );
}
