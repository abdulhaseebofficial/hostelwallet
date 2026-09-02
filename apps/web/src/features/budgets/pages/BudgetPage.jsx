import { useCallback, useState } from 'react';
import { PieChart as PieIcon, Sparkles, Wallet, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import PageHeader from '../../../shared/components/ui/PageHeader';
import Modal from '../../../shared/components/ui/Modal';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import EmptyState from '../../../shared/components/ui/EmptyState';
import { SkeletonCard } from '../../../shared/components/ui/Skeleton';
import StatCard from '../../../shared/components/StatCard';
import BudgetRow from '../components/BudgetRow';
import useAsync from '../../../shared/hooks/useAsync';
import useMutation from '../../../shared/hooks/useMutation';
import useCategories from '../../../shared/hooks/useCategories';
import { useAuth } from '../../auth';
import budgetService from '../api/budgetsApi';
import { advisorApi as aiService } from '../../advisor';
import { currencySymbol, formatMoney, monthLabel } from '../../../shared/utils/format';

const now = new Date();

export default function Budget() {
  const { currency } = useAuth();
  const { categories } = useCategories();

  const [period] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [editing, setEditing] = useState(null);
  const [limitValue, setLimitValue] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [suggestion, setSuggestion] = useState(null);

  // Two independent in-flight flags: saving a limit must not grey out the
  // "suggest a budget" button, and vice versa.
  const { saving, run } = useMutation();
  const { saving: suggesting, run: runSuggest } = useMutation();

  const load = useCallback(() => budgetService.list(period.month, period.year), [period]);
  const { data, loading, error, reload } = useAsync(load, [period]);

  const saveLimit = () => {
    const limit = Number(limitValue);
    if (Number.isNaN(limit) || limit < 0) return toast.error('Enter a limit of 0 or more');

    const category = editing ? editing.category : newCategory;
    if (!category) return toast.error('Pick a category');

    return run(() => budgetService.set({ category, limit, month: period.month, year: period.year }), {
      success: `Budget set for ${category}`,
      onDone: () => {
        setEditing(null);
        setNewCategory('');
        setLimitValue('');
        reload();
      },
    });
  };

  /** Ask Claude for a whole plan; nothing is saved until "apply" is pressed. */
  const askAi = () =>
    runSuggest(() => aiService.suggestBudget(period.month, period.year), { onDone: setSuggestion });

  const applySuggestion = () =>
    run(
      () =>
        budgetService.bulkSet(
          suggestion.categories.map((row) => ({ category: row.category, limit: row.limit })),
          period.month,
          period.year
        ),
      {
        success: 'Budget plan applied',
        onDone: () => {
          setSuggestion(null);
          reload();
        },
      }
    );

  const items = data ? data.items : [];
  const totals = data ? data.totals : null;
  const unbudgeted = categories.filter((category) => !items.some((row) => row.category === category));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Budget"
        subtitle={`Limits for ${monthLabel(
          period.month,
          period.year
        )}. Green is fine, amber is a warning, red means stop.`}
      >
        <Button icon={Sparkles} variant="secondary" loading={suggesting} onClick={askAi}>
          Suggest a budget
        </Button>
      </PageHeader>

      {totals && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Income" value={totals.income} currency={currency} icon={Wallet} tone="safe" />
          <StatCard label="Total budgeted" value={totals.limit} currency={currency} icon={PieIcon} tone="brand" />
          <StatCard
            label="Spent so far"
            value={totals.spent}
            currency={currency}
            icon={PieIcon}
            tone={totals.spent > totals.limit ? 'danger' : 'caution'}
            progress={totals.limit ? Math.min(100, (totals.spent / totals.limit) * 100) : 0}
            progressTone={totals.spent > totals.limit ? 'over' : 'warning'}
          />
          <StatCard
            label="Not yet allocated"
            value={totals.unallocated}
            currency={currency}
            icon={Wallet}
            tone={totals.unallocated < 0 ? 'danger' : 'neutral'}
            footnote={
              totals.unallocated < 0
                ? 'Your limits add up to more than your income'
                : 'Room left to budget or save'
            }
          />
        </section>
      )}

      <Card>
        <CardHeader title="Category limits" icon={PieIcon} />

        {loading && !data ? (
          <SkeletonCard lines={6} className="border-0 p-0 shadow-none" />
        ) : error ? (
          <EmptyState icon={PieIcon} title="Could not load budgets" message={error} actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={PieIcon}
            title="No limits set yet"
            message="Set a limit per category, or let the AI draft a plan from what you already spend."
            actionLabel="Suggest a budget for me"
            actionIcon={Sparkles}
            onAction={askAi}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((row) => (
              <BudgetRow
                key={row._id}
                row={row}
                currency={currency}
                onEdit={(item) => {
                  setEditing(item);
                  setLimitValue(String(item.limit));
                }}
              />
            ))}
          </ul>
        )}
      </Card>

      {unbudgeted.length > 0 && (
        <Card>
          <CardHeader title="Add a limit" subtitle="Categories without a budget this month" />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              className="flex-1"
              label="Category"
              options={unbudgeted}
              placeholder="Pick a category"
              value={newCategory}
              onChange={(event) => setNewCategory(event.target.value)}
            />
            <Input
              className="flex-1"
              label="Monthly limit"
              type="number"
              inputMode="decimal"
              placeholder="0"
              prefix={currencySymbol(currency)}
              value={editing ? '' : limitValue}
              onChange={(event) => setLimitValue(event.target.value)}
            />
            <Button onClick={saveLimit} loading={saving} disabled={!newCategory} className="sm:mb-0.5">
              Set limit
            </Button>
          </div>
        </Card>
      )}

      {/* Edit an existing limit */}
      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing ? `Budget for ${editing.category}` : ''}
        subtitle={editing ? `Currently spent ${formatMoney(editing.spent, currency)} this month` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveLimit} loading={saving}>
              Save limit
            </Button>
          </>
        }
      >
        <Input
          label="Monthly limit"
          type="number"
          inputMode="decimal"
          autoFocus
          prefix={currencySymbol(currency)}
          value={limitValue}
          onChange={(event) => setLimitValue(event.target.value)}
          hint="Set it to 0 to stop tracking this category"
        />
      </Modal>

      {/* AI suggested plan */}
      <Modal
        open={Boolean(suggestion)}
        onClose={() => setSuggestion(null)}
        title="Your suggested budget"
        subtitle={suggestion && !suggestion.aiPowered ? 'Built by the offline advisor' : 'Drafted from your real spending'}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSuggestion(null)} disabled={saving}>
              Not now
            </Button>
            <Button icon={Check} onClick={applySuggestion} loading={saving}>
              Apply this plan
            </Button>
          </>
        }
      >
        {suggestion && (
          <div className="space-y-4">
            <p className="rounded-xl bg-brand-50 p-3.5 text-sm text-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
              {suggestion.summary}
            </p>

            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {suggestion.categories.map((row) => (
                <li key={row.category} className="flex items-start gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{row.category}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{row.reason}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                    {formatMoney(row.limit, currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between rounded-xl bg-safe/10 px-3.5 py-3 dark:bg-safe/15">
              <span className="text-sm font-semibold text-safe">Left over to save each month</span>
              <span className="text-sm font-bold tabular-nums text-safe">
                {formatMoney(suggestion.savingsTarget, currency)}
              </span>
            </div>

            {suggestion.exceedsIncome && (
              <p className="text-xs font-medium text-danger">
                Heads up: these limits add up to more than your income. Trim a category before applying.
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
