import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, Wallet } from 'lucide-react';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SkeletonRows } from '../components/ui/Skeleton';
import StatCard from '../components/dashboard/StatCard';
import useAsync from '../hooks/useAsync';
import useMutation from '../hooks/useMutation';
import { useAuth } from '../context/AuthContext';
import incomeService from '../services/incomeService';
import { INCOME_SOURCES } from '../utils/constants';
import { currencySymbol, formatDate, formatMoney, toInputDate } from '../utils/format';

const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Amount must be more than 0'),
  source: z.enum(INCOME_SOURCES),
  note: z.string().max(200).optional(),
  date: z.string().min(1, 'Pick a date'),
});

export default function Income() {
  const { user, currency } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const { saving, run } = useMutation();

  const load = useCallback(() => incomeService.list(), []);
  const { data, loading, error, reload } = useAsync(load, []);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', source: 'Pocket Money', note: '', date: toInputDate(new Date()) },
  });

  const submit = (values) =>
    run(() => incomeService.create(values), {
      success: 'Income added',
      onDone: () => {
        setFormOpen(false);
        reset({ amount: '', source: 'Pocket Money', note: '', date: toInputDate(new Date()) });
        reload();
      },
    });

  const confirmDelete = () =>
    run(() => incomeService.remove(deleting._id), {
      success: 'Income removed',
      onDone: () => {
        setDeleting(null);
        reload();
      },
    });

  const items = data ? data.items : [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Income"
        subtitle="Every rupee that comes in - pocket money, tuition work, scholarship."
      >
        <Button icon={Plus} onClick={() => setFormOpen(true)}>
          Add income
        </Button>
      </PageHeader>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard
          label="Planned monthly income"
          value={user ? user.monthlyIncome : 0}
          currency={currency}
          icon={Wallet}
          tone="brand"
          footnote="Change it in Settings"
        />
        <StatCard
          label="Total logged income"
          value={data ? data.total : 0}
          currency={currency}
          icon={Wallet}
          tone="safe"
          footnote={`${items.length} entr${items.length === 1 ? 'y' : 'ies'} recorded`}
        />
      </section>

      <Card>
        <CardHeader title="Income history" icon={Wallet} />

        {loading && !data ? (
          <SkeletonRows count={4} />
        ) : error ? (
          <EmptyState icon={Wallet} title="Could not load income" message={error} actionLabel="Retry" onAction={reload} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No income logged yet"
            message="Log the money you receive so the app can tell you what is genuinely left."
            actionLabel="Add income"
            actionIcon={Plus}
            onAction={() => setFormOpen(true)}
          />
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map((entry) => (
              <li key={entry._id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-safe/10 text-safe dark:bg-safe/15">
                  <Wallet className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{entry.source}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {formatDate(entry.date)}
                    {entry.note ? ` \u00B7 ${entry.note}` : ''}
                  </p>
                </div>

                <span className="shrink-0 text-sm font-bold tabular-nums text-safe">
                  +{formatMoney(entry.amount, currency)}
                </span>

                <button
                  type="button"
                  onClick={() => setDeleting(entry)}
                  aria-label={`Delete ${entry.source} income`}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-danger/10 hover:text-danger dark:hover:bg-danger/15"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Add income" size="sm">
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            placeholder="0"
            autoFocus
            prefix={currencySymbol(currency)}
            error={errors.amount && errors.amount.message}
            {...register('amount')}
          />

          <Select label="Source" options={INCOME_SOURCES} error={errors.source && errors.source.message} {...register('source')} />

          <Input label="Note (optional)" placeholder="e.g. Sent by dad" {...register('note')} />

          <Input
            label="Date"
            type="date"
            max={toInputDate(new Date())}
            error={errors.date && errors.date.message}
            {...register('date')}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              Add income
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={saving}
        title="Delete this income entry?"
        message={deleting ? `${formatMoney(deleting.amount, currency)} from ${deleting.source} will be removed.` : ''}
      />
    </div>
  );
}
