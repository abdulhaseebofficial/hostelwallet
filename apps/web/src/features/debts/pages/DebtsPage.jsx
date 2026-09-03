import { useCallback, useState } from 'react';
import { Plus, HandCoins } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../../shared/components/ui/PageHeader';
import Button from '../../../shared/components/ui/Button';
import Skeleton from '../../../shared/components/ui/Skeleton';
import EmptyState from '../../../shared/components/ui/EmptyState';
import ConfirmDialog from '../../../shared/components/ui/ConfirmDialog';
import useAsync from '../../../shared/hooks/useAsync';
import useMutation from '../../../shared/hooks/useMutation';
import useDebounce from '../../../shared/hooks/useDebounce';
import { useAuth } from '../../auth';
import debtsApi from '../api/debtsApi';
import DebtSummaryCards from '../components/DebtSummaryCards';
import DebtFilters from '../components/DebtFilters';
import DebtRow from '../components/DebtRow';
import DebtForm from '../components/DebtForm';
import DebtDetail from '../components/DebtDetail';

/** Still-open records first: a settled debt is history, not a to-do. */
const DEFAULT_FILTERS = { kind: '', status: 'OUTSTANDING', sort: 'newest', search: '', page: 1 };

/**
 * Udhaar: who owes whom.
 *
 * The page holds the state and decides what an action means; the cards, the
 * filters, the rows and the two dialogs only render. Every figure on screen -
 * remaining, status, the four totals - is computed by the server, because a
 * balance worked out in two places is a balance that will eventually disagree
 * with itself.
 */
export default function DebtsPage() {
  const { currency } = useAuth();

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [confirm, setConfirm] = useState(null);

  // Typing in the search box should not fire a request per keystroke.
  const search = useDebounce(filters.search, 350);
  const query = { ...filters, search };

  const {
    data: list,
    loading: listLoading,
    error: listError,
    reload: refreshList,
  } = useAsync(() => debtsApi.list(query), [JSON.stringify(query)]);

  const {
    data: summary,
    loading: summaryLoading,
    reload: refreshSummary,
  } = useAsync(() => debtsApi.summary(), []);

  const {
    data: detail,
    loading: detailLoading,
    reload: refreshDetail,
  } = useAsync(() => (openId ? debtsApi.get(openId) : Promise.resolve(null)), [openId]);

  const { saving, run } = useMutation();

  /** Any write can move a balance, so both the list and the totals reload. */
  const refreshAll = useCallback(() => {
    refreshList();
    refreshSummary();
    if (openId) refreshDetail();
  }, [refreshList, refreshSummary, refreshDetail, openId]);

  const saveRecord = (values) =>
    run(() => (editing ? debtsApi.update(editing._id, values) : debtsApi.create(values)), {
      success: editing ? 'Record updated' : 'Added to your udhaar',
      onDone: () => {
        setFormOpen(false);
        setEditing(null);
        refreshAll();
      },
    });

  const addPayment = (payload) =>
    run(() => debtsApi.addPayment(openId, payload), {
      success: 'Payment recorded',
      onDone: (result) => {
        if (result.justSettled) toast.success(`Settled with ${result.debt.personName}`);
        refreshAll();
      },
    });

  const settleFull = () =>
    run(() => debtsApi.settle(openId), { success: 'Settled in full', onDone: refreshAll });

  const undoPayment = (payment) =>
    setConfirm({
      title: 'Undo this payment?',
      message: 'The amount goes back onto the outstanding balance. The record may reopen.',
      confirmLabel: 'Undo payment',
      onConfirm: () =>
        run(() => debtsApi.removePayment(openId, payment._id), {
          success: 'Payment removed',
          onDone: refreshAll,
        }),
    });

  const deleteRecord = () =>
    setConfirm({
      title: 'Delete this record?',
      message: 'The record and its whole payment history are removed. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () =>
        run(() => debtsApi.remove(openId), {
          success: 'Record deleted',
          onDone: () => {
            setOpenId(null);
            refreshAll();
          },
        }),
    });

  const items = list?.items || [];
  const pagination = list?.pagination;

  return (
    <div className="space-y-5">
      <PageHeader title="Udhaar" subtitle="Money you borrowed, and money you are still owed.">
        <Button icon={Plus} onClick={() => { setEditing(null); setFormOpen(true); }}>
          Add record
        </Button>
      </PageHeader>

      <DebtSummaryCards summary={summary} currency={currency} loading={summaryLoading} />

      <DebtFilters filters={filters} onChange={setFilters} />

      {listError ? (
        <EmptyState
          icon={HandCoins}
          title="Could not load your udhaar"
          message={listError}
          actionLabel="Try again"
          onAction={refreshList}
        />
      ) : listLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title={filters.search ? 'Nothing matches that' : 'No udhaar recorded'}
          message={
            filters.search
              ? 'Try a different name, or clear the filters.'
              : 'Lent someone money for the mess bill? Borrowed for a bus ticket home? Add it here so nobody has to remember.'
          }
          actionLabel={filters.search ? undefined : 'Add the first one'}
          actionIcon={Plus}
          onAction={filters.search ? undefined : () => { setEditing(null); setFormOpen(true); }}
        />
      ) : (
        <div className="space-y-2">
          {items.map((debt) => (
            <DebtRow key={debt._id} debt={debt} currency={currency} onOpen={() => setOpenId(debt._id)} />
          ))}
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Page {pagination.page} of {pagination.pages} - {pagination.total} record(s)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!pagination.hasPrev}
              onClick={() => setFilters((f) => ({ ...f, page: f.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={!pagination.hasNext}
              onClick={() => setFilters((f) => ({ ...f, page: f.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <DebtForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        onSubmit={saveRecord}
        debt={editing}
        currency={currency}
      />

      <DebtDetail
        open={Boolean(openId) && !detailLoading}
        onClose={() => setOpenId(null)}
        debt={detail?.debt}
        payments={detail?.payments || []}
        currency={currency}
        busy={saving}
        onAddPayment={addPayment}
        onSettle={settleFull}
        onEdit={() => { setEditing(detail.debt); setOpenId(null); setFormOpen(true); }}
        onDelete={deleteRecord}
        onRemovePayment={undoPayment}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.danger ? 'danger' : 'primary'}
        loading={saving}
        onClose={() => setConfirm(null)}
        onConfirm={async () => {
          await confirm.onConfirm();
          setConfirm(null);
        }}
      />
    </div>
  );
}
