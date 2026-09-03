import { Search } from 'lucide-react';
import Select from '../../../shared/components/ui/Select';
import { cn } from '../../../shared/utils/format';

/** The direction tabs: everything, what is owed, what is owing. */
const KINDS = [
  { value: '', label: 'All' },
  { value: 'BORROWED', label: 'You owe' },
  { value: 'LENT', label: 'Owed to you' },
];

const STATUSES = [
  { value: 'OUTSTANDING', label: 'Still open' },
  { value: '', label: 'Any status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'PARTIALLY_PAID', label: 'Part paid' },
  { value: 'OVERDUE', label: 'Overdue' },
  { value: 'SETTLED', label: 'Settled' },
];

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'remaining', label: 'Most outstanding' },
  { value: 'amount', label: 'Largest amount' },
  { value: 'due', label: 'Due soonest' },
];

export default function DebtFilters({ filters, onChange }) {
  const set = (patch) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="space-y-3">
      <div
        role="group"
        aria-label="Filter by direction"
        className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
      >
        {KINDS.map((option) => (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => set({ kind: option.value })}
            aria-pressed={(filters.kind || '') === option.value}
            className={cn(
              'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition',
              (filters.kind || '') === option.value
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-900 dark:text-slate-100'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={filters.search || ''}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Search a name or note"
            aria-label="Search by person or note"
            className="hw-input pl-9"
          />
        </div>

        <Select
          label=""
          aria-label="Filter by status"
          options={STATUSES}
          value={filters.status || 'OUTSTANDING'}
          onChange={(event) => set({ status: event.target.value })}
        />

        <Select
          label=""
          aria-label="Sort records"
          options={SORTS}
          value={filters.sort || 'newest'}
          onChange={(event) => set({ sort: event.target.value })}
        />
      </div>
    </div>
  );
}
