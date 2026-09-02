import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { categoryColor, categoryEmoji, inCategoryOrder, CHART_INK } from '../../utils/constants';
import { formatMoney } from '../../utils/format';
import ChartTooltip from './ChartTooltip';
import EmptyState from '../ui/EmptyState';
import { PieChart as PieIcon } from 'lucide-react';

/**
 * Donut of spending by category.
 *
 * Slices are drawn in the fixed category order, not sorted by size, so the
 * pairs that end up touching on screen are exactly the pairs the palette was
 * validated against. A 2px surface-coloured gap separates the fills, and the
 * legend direct-labels every slice with its amount and share, which is also
 * the required relief for the three lighter slots in light mode.
 */
export default function CategoryPieChart({ data = [], currency = 'PKR', total, height = 220 }) {
  const { isDark } = useTheme();
  const ink = isDark ? CHART_INK.dark : CHART_INK.light;

  const slices = inCategoryOrder(data).filter((row) => row.amount > 0);
  const sum = total !== undefined ? total : slices.reduce((acc, row) => acc + row.amount, 0);

  if (!slices.length) {
    return (
      <EmptyState
        icon={PieIcon}
        title="Nothing to chart yet"
        message="Add a few expenses and your spending split will appear here."
      />
    );
  }

  // The legend is ordered by size because that is what a reader scans for,
  // while the slices keep the palette order. Colour still follows the entity.
  const legend = [...slices].sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative" style={{ width: height, height, maxWidth: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              nameKey="category"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke={ink.surface}
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            >
              {slices.map((row) => (
                <Cell key={row.category} fill={categoryColor(row.category, isDark)} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip currency={currency} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Hero number sits in the hole rather than repeating on every slice. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Total
          </span>
          <span className="text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(sum, currency, { compact: true })}
          </span>
        </div>
      </div>

      <ul className="w-full space-y-1.5">
        {legend.map((row) => (
          <li key={row.category} className="flex items-center gap-2.5 text-sm">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: categoryColor(row.category, isDark) }}
              aria-hidden="true"
            />
            <span
              className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-300"
              title={row.category}
            >
              <span aria-hidden="true" className="mr-1">
                {categoryEmoji(row.category)}
              </span>
              {row.category}
            </span>
            <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-slate-900 dark:text-slate-100">
              {formatMoney(row.amount, currency)}
            </span>
            <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
              {Math.round(row.percent)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
