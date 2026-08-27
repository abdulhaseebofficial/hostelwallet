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
 *
 * Anything currently narrowing the list is also summarised as a removable chip
 * ABOVE that toggle. Filters that only exist inside a collapsed panel are
 * filters a student cannot see and cannot undo - they just conclude their
 * expenses have gone missing.
 */
export default function ExpenseFilters({ filters, onChange, onReset, categories = [], resultCount }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const set = (patch) => onChange({ ...filters, ...patch, page: 1 });

  // One entry per narrowing filter, each able to clear just itself.
  const activeChips = [
    filters.search && { key: 'search', label: `Search: ${filters.search}`, clear: { search: '' } },
    filters.category && { key: 'category', label: filters.category, clear: { category: '' } },
    filters.paymentMethod && {
      key: 'paymentMethod',
      label: `Paid with ${filters.paymentMethod}`,
      clear: { paymentMethod: '' },
    },
    filters.minAmount && { key: 'minAmount', label: `Min ${filters.minAmount}`, clear: { minAmount: '' } },
    filters.maxAmount && { key: 'maxAmount', label: `Max ${filters.maxAmount}`, clear: { maxAmount: '' } },
    filters.preset === 'custom' &&
      (filters.from || filters.to) && {
        key: 'range',
        label: `${filters.from || 'start'} to ${filters.to || 'today'}`,
        clear: { preset: 'month', ...presetRange('month') },
      },
  ].filter(Boolean);

  // The date preset is always set to something, so it does not count as a chip
  // unless it has been moved off the default.
  const hasFilters = activeChips.length > 0 || filters.preset !== 'month';

  // Everything the collapsed panel is hiding, so the toggle can carry a count.
  const advancedCount = activeChips.filter((chip) => chip.key !== 'search').length;

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
            className={cn('hw-input pl-10', filters.search && 'pr-10')}
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set({ search: '' })}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant={advancedOpen ? 'secondary' : 'outline'}
          icon={SlidersHorizontal}
          onClick={() => setAdvancedOpen((open) => !open)}
          aria-expanded={advancedOpen}
          className="shrink-0"
        >
          Filters
          {advancedCount > 0 && (
            <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">
              {advancedCount}
            </span>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            aria-pressed={filters.preset === preset.key}
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
          <span
            aria-live="polite"
            className="ml-auto self-center text-xs text-slate-500 dark:text-slate-400"
          >
            {resultCount} result{resultCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-200 pt-3 dark:border-slate-800">
          <span className="text-xs text-slate-500 dark:text-slate-400">Filtered by</span>
          {activeChips.map((chip) => (
            <span key={chip.key} className="hw-chip">
              <span className="max-w-40 truncate">{chip.label}</span>
              <button
                type="button"
                onClick={() => set(chip.clear)}
                aria-label={`Remove filter ${chip.label}`}
                className="hw-chip-remove"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={onReset}
            className="ml-1 text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-400"
          >
            Clear all
          </button>
        </div>
      )}

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
