import { useCallback, useState } from 'react';
import { Plus, Target, Trophy } from 'lucide-react';
import toast from 'react-hot-toast';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import StatCard from '../components/dashboard/StatCard';
import GoalCard from '../components/goals/GoalCard';
import GoalForm from '../components/goals/GoalForm';
import ContributeModal from '../components/goals/ContributeModal';
import useAsync from '../hooks/useAsync';
import useMutation from '../hooks/useMutation';
import { useAuth } from '../context/AuthContext';
import goalService from '../services/goalService';
import { cn, formatMoney } from '../utils/format';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
];

export default function Goals() {
  const { currency } = useAuth();
  const [tab, setTab] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [contributing, setContributing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const { saving, run } = useMutation();

  const load = useCallback(() => goalService.list(tab), [tab]);
  const { data, loading, error, reload } = useAsync(load, [tab]);

  const submit = (values) => {
    const payload = { ...values, deadline: values.deadline || null };
    return run(() => (editing ? goalService.update(editing._id, payload) : goalService.create(payload)), {
      success: editing ? 'Goal updated' : 'Goal created. Now go fund it!',
      onDone: () => {
        setFormOpen(false);
        setEditing(null);
        reload();
      },
    });
  };

  // Funding a goal is the one write with a result worth celebrating, so it
  // raises its own toast instead of the standard one.
  const contribute = (amount) =>
    run(() => goalService.contribute(contributing._id, amount), {
      onDone: (result) => {
        if (result.justCompleted) {
          toast.success(`Goal complete! You saved the full amount for "${result.goal.title}"`, {
            icon: '\uD83C\uDF89',
            duration: 5000,
          });
        } else {
          toast.success(amount > 0 ? 'Money added to your goal' : 'Money withdrawn');
        }
        setContributing(null);
        reload();
      },
    });

  const confirmDelete = () =>
    run(() => goalService.remove(deleting._id), {
      success: 'Goal deleted',
      onDone: () => {
        setDeleting(null);
        reload();
      },
    });

  const goals = data ? data.items : [];
  const summary = data ? data.summary : null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Savings goals"
        subtitle="Money with a name attached is much harder to spend by accident."
      >
        <Button
          icon={Plus}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          New goal
        </Button>
      </PageHeader>

      {summary && summary.count > 0 && (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total saved" value={summary.totalSaved} currency={currency} icon={Target} tone="safe" />
          <StatCard
            label="Total target"
            value={summary.totalTargeted}
            currency={currency}
            icon={Target}
            tone="brand"
            progress={summary.totalTargeted ? (summary.totalSaved / summary.totalTargeted) * 100 : 0}
          />
          <StatCard
            label="Goals completed"
            value={`${summary.completed} of ${summary.count}`}
            raw
            icon={Trophy}
            tone="caution"
            className="sm:col-span-2 lg:col-span-1"
          />
        </section>
      )}

      <div className="flex gap-1.5">
        {TABS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setTab(option.key)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-semibold transition',
              tab === option.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
          <SkeletonCard lines={4} />
        </div>
      ) : error ? (
        <EmptyState icon={Target} title="Could not load goals" message={error} actionLabel="Retry" onAction={reload} />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={tab === 'completed' ? 'No completed goals yet' : 'No goals yet'}
          message={
            tab === 'completed'
              ? 'Finish one and it will be celebrated right here.'
              : 'Start with something small - even a 2000 emergency fund changes how the month feels.'
          }
          actionLabel="Create your first goal"
          actionIcon={Plus}
          onAction={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard
              key={goal._id}
              goal={goal}
              currency={currency}
              onContribute={setContributing}
              onEdit={(item) => {
                setEditing(item);
                setFormOpen(true);
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit goal' : 'Create a savings goal'}
        size="md"
      >
        <GoalForm
          goal={editing}
          currency={currency}
          onSubmit={submit}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          submitting={saving}
        />
      </Modal>

      <ContributeModal
        open={Boolean(contributing)}
        goal={contributing}
        currency={currency}
        onClose={() => setContributing(null)}
        onSubmit={contribute}
        submitting={saving}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        loading={saving}
        title="Delete this goal?"
        message={
          deleting
            ? `"${deleting.title}" and its ${formatMoney(deleting.savedAmount, currency)} of progress will be removed. The money itself is not affected.`
            : ''
        }
      />
    </div>
  );
}
