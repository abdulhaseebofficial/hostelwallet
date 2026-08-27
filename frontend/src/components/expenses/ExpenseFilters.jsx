import { useState } from 'react';
import { Search, X, SlidersHorizontal } from 'lucide-react';
import Button from '../ui/Button';
import Select from '../ui/Select';
import Input from '../ui/Input';
import { PAYMENT_METHODS } from '../../utils/constants';
import { cn } from '../../utils/format';

const PRESETS = [
  { key: 'all', label: 'All time' },
  { key: 'week', label: 'Last 7 days' },
  { key: 'month', label: 'This month' },
  { key: 'prev', label: 'Last month' },
];

/** Turns a preset key into a from/to pair. */
export const presetRange = (key) => {
  const now = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);

  if (key === 'week') {
    const from = new Date();
    from.setDate(from.getDate() - 6);
    return { from: iso(from), to: iso(now) };
  }
  if (key === 'month') {
    return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
  }
  if (key === 'prev') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: iso(start), to: iso(end) };
  }
  return { from: '', to: '' };
};

/**
 * Search plus the date presets in one row, with the finer controls behind a
 * toggle so the common case stays a single tap.
 */
export default function ExpenseFilters({ filters, onChange, onReset, categories = [], resultCount }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const set = (patch) => onChange({ ...filters, ...patch, page: 1 });
  const hasFilters =
    filters.search ||
    filters.category ||
    filters.paymentMethod ||
    filters.minAmount ||
    filters.maxAmount ||
    filters.preset !== 'month';

  return (
    <div className="hw-card space-y-3 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={filters.search}
            onChange={(event) => set({ search: event.target.value })}
            placeholder="Search description or category"
            aria-label="Search expenses"
            className="hw-input pl-10"
          />
        </div>

        <Button
          variant={advancedOpen ? 'secondary' : 'outline'}
          icon={SlidersHorizontal}
          onClick={() => setAdvancedOpen((open) => !open)}
          className="shrink-0"
        >
          Filters
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            onClick={() => set({ preset: preset.key, ...presetRange(preset.key) })}
            className={cn(
              'rounded-full px-3 py-1.5 text-xs font-semibold transition',
              filters.preset === preset.key
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            )}
          >
            {preset.label}
          </button>
        ))}

        {resultCount !== undefined && (
          <span className="ml-auto self-center text-xs text-slate-500 dark:text-slate-400">
            {resultCount} result{resultCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {advancedOpen && (
        <div className="grid gap-3 border-t border-slate-200 pt-3 sm:grid-cols-2 lg:grid-cols-4 dark:border-slate-800">
          <Select
            label="Category"
            options={categories}
            placeholder="Any category"
            value={filters.category}
            onChange={(event) => set({ category: event.target.value })}
          />
          <Select
            label="Payment method"
            options={PAYMENT_METHODS}
            placeholder="Any method"
            value={filters.paymentMethod}
            onChange={(event) => set({ paymentMethod: event.target.value })}
          />
          <Input
            label="Min amount"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={filters.minAmount}
            onChange={(event) => set({ minAmount: event.target.value })}
          />
          <Input
            label="Max amount"
            type="number"
            inputMode="decimal"
            placeholder="Any"
            value={filters.maxAmount}
            onChange={(event) => set({ maxAmount: event.target.value })}
          />

          <div className="grid grid-cols-2 gap-3 sm:col-span-2">
            <Input
              label="From"
              type="date"
              value={filters.from}
              onChange={(event) => set({ from: event.target.value, preset: 'custom' })}
            />
            <Input
              label="To"
              type="date"
              value={filters.to}
              onChange={(event) => set({ to: event.target.value, preset: 'custom' })}
            />
          </div>

          {hasFilters && (
            <div className="flex items-end lg:col-span-2">
              <Button variant="ghost" icon={X} onClick={onReset}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
