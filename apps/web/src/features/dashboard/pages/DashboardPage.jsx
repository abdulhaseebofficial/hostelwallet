import { useCallback } from 'react';
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
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import PageHeader from '../../../shared/components/ui/PageHeader';
import useQuickAdd from '../../../shared/hooks/useQuickAdd';
import { SkeletonStats, SkeletonCard } from '../../../shared/components/ui/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import RecentTransactions from '../components/RecentTransactions';
import GoalsPreview from '../components/GoalsPreview';
import { DebtWidget } from '../../debts';
import { BudgetRow } from '../../budgets';
import CategoryPieChart from '../../../shared/components/charts/CategoryPieChart';
import TrendChart from '../../../shared/components/charts/TrendChart';
import { TipCard } from '../../advisor';
import EmptyState from '../../../shared/components/ui/EmptyState';
import useAsync from '../../../shared/hooks/useAsync';
import { useAuth } from '../../auth';
import dashboardService from '../api/dashboardApi';
import { formatChange, formatMoney } from '../../../shared/utils/format';

export default function Dashboard() {
  const { user, currency } = useAuth();
  const navigate = useNavigate();

  // Adding an expense is the shell's dialog, reached through the same opener
  // the N shortcut uses - so this page no longer carries a second copy of it.
  const { open: openQuickAdd, canCreate } = useQuickAdd();

  const load = useCallback(() => dashboardService.summary(), []);
  const { data, loading, error } = useAsync(load, []);

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

  const { totals, categoryBreakdown, trend, comparison, budgets, goals, recentExpenses, monthLabel, debts } = data;
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
        {canCreate && (
          <Button icon={Plus} shortcut="N" onClick={openQuickAdd} className="hidden sm:inline-flex">
            Add expense
          </Button>
        )}
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
        <RecentTransactions expenses={recentExpenses} currency={currency} onAdd={openQuickAdd} />

        <div className="space-y-5">
          <GoalsPreview goals={goals} currency={currency} onCreate={() => navigate('/goals')} />

          <DebtWidget debts={debts} currency={currency} />

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

    </div>
  );
}
