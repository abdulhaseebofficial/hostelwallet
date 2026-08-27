import { useCallback, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Receipt, X } from 'lucide-react';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import ExpenseForm from '../components/expenses/ExpenseForm';
import ExpenseItem from '../components/expenses/ExpenseItem';
import ExpenseFilters, { presetRange } from '../components/expenses/ExpenseFilters';
import useAsync from '../hooks/useAsync';
import useDebounce from '../hooks/useDebounce';
import useCategories from '../hooks/useCategories';
import useMutation from '../hooks/useMutation';
import { useAuth } from '../context/AuthContext';
import expenseService from '../services/expenseService';
import { formatMoney } from '../utils/format';

const INITIAL_FILTERS = {
  search: '',
  category: '',
  paymentMethod: '',
  minAmount: '',
  maxAmount: '',
  preset: 'month',
  ...presetRange('month'),
  page: 1,
  limit: 20,
};

export default function Expenses() {
  const { currency } = useAuth();
  const { categories } = useCategories();

  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { saving, run } = useMutation();

  // The search box types fast; the API should not.
  const debouncedSearch = useDebounce(filters.search, 400);

  const query = useMemo(
    () => ({
      search: debouncedSearch || undefined,
      category: filters.category || undefined,
      paymentMethod: filters.paymentMethod || undefined,
      minAmount: filters.minAmount || undefined,
      maxAmount: filters.maxAmount || undefined,
      from: filters.from || undefined,
      to: filters.to || undefined,
      page: filters.page,
      limit: filters.limit,
    }),
    [debouncedSearch, filters]
  );

  const load = useCallback(() => expenseService.list(query), [query]);
  const { data, loading, error, reload } = useAsync(load, [query]);

  const submit = (values) =>
    run(() => (editing ? expenseService.update(editing._id, values) : expenseService.create(values)), {
      success: editing ? 'Expense updated' : 'Expense added',
      onDone: () => {
        setFormOpen(false);
        setEditing(null);
        reload();
      },
    });

  const confirmDelete = () =>
    run(() => expenseService.remove(deleting._id), {
      success: 'Expense deleted',
      onDone: () => {
        setDeleting(null);
        reload();
      },
    });

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (expense) => {
    setEditing(expense);
    setFormOpen(true);
  };

  const items = data ? data.items : [];
  const pagination = data ? data.pagination : null;

  // True when the list is narrowed by anything the student chose, so an empty
  // result can be explained rather than looking like lost data.
  const filtered = Boolean(
    filters.search ||
      filters.category ||
      filters.paymentMethod ||
      filters.minAmount ||
      filters.maxAmount ||
      filters.preset !== 'month'
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Expenses"
        subtitle={
          data
            ? `${formatMoney(data.filteredTotal, currency)} across ${pagination.total} transaction${
                pagination.total === 1 ? '' : 's'
              }`
            : undefined
        }
      >
        <Button icon={Plus} onClick={openNew}>
          Add expense
        </Button>
      </PageHeader>

      <ExpenseFilters
        filters={filters}
        categories={categories}
        resultCount={pagination ? pagination.total : undefined}
        onChange={setFilters}
        onReset={() => setFilters(INITIAL_FILTERS)}
      />

      {loading && !data ? (
        <SkeletonRows count={6} />
      ) : error ? (
        <EmptyState icon={Receipt} title="Could not load expenses" message={error} actionLabel="Retry" onAction={reload} />
      ) : items.length === 0 ? (
        // When a filter is what emptied the list, the useful button is the one
        // that puts the expenses back, not one that adds another.
        filtered ? (
          <EmptyState
            icon={Receipt}
            title="Nothing matches those filters"
            message="Your expenses are still here. Widen the date range or clear the filters to see them."
            actionLabel="Clear filters"
            actionIcon={X}
            onAction={() => setFilters(INITIAL_FILTERS)}
          />
        ) : (
          <EmptyState
            icon={Receipt}
            title="No expenses yet"
            message="Add your first expense and this page fills up fast."
            actionLabel="Add expense"
            actionIcon={Plus}
            onAction={openNew}
          />
        )
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((expense) => (
              <ExpenseItem
                key={expense._id}
                expense={expense}
                currency={currency}
                onEdit={openEdit}
                onDelete={setDeleting}
              />
            ))}
          </ul>

          {pagination.pages > 1 && (
            <nav className="flex items-center justify-between gap-3 pt-1" aria-label="Pagination">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={!pagination.hasPrev}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              >
                Previous
              </Button>

              <span className="text-xs text-slate-500 dark:text-slate-400">
                Page {pagination.page} of {pagination.pages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNext}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </nav>
          )}
        </>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit expense' : 'Add an expense'}
        size="md"
      >
        <ExpenseForm
          expense={editing}
          categories={categories}
          currency={currency}
          onSubmit={submit}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          submitting={saving}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={saving}
        title="Delete this expense?"
        message={
          deleting
            ? `"${deleting.description || deleting.category}" for ${formatMoney(deleting.amount, currency)} will be removed. This cannot be undone.`
            : ''
        }
      />
    </div>
  );
}
