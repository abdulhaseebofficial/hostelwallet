import { formatMoney } from '../../utils/format';

/**
 * Shared tooltip surface. Values wear ink tokens; the coloured dot beside a
 * row carries the series identity, so the text never depends on colour.
 */
export default function ChartTooltip({ active, payload, label, currency = 'INR', labelFormatter }) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-canvas-card/95 px-3 py-2 shadow-lift backdrop-blur dark:border-slate-700 dark:bg-canvas-darkCard/95">
      {label !== undefined && (
        <p className="mb-1 text-xs font-semibold text-slate-900 dark:text-slate-100">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <ul className="space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color || entry.payload.fill }}
              aria-hidden="true"
            />
            <span className="text-slate-600 dark:text-slate-300">{entry.name}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatMoney(entry.value, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
