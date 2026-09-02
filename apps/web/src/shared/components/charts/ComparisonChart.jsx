import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '../../../app/providers/ThemeProvider';
import { CATEGORIES, CHART_INK, inCategoryOrder } from '../../utils/constants';
import { formatMoney } from '../../utils/format';
import ChartTooltip from './ChartTooltip';
import EmptyState from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';

/**
 * This month against last month, category by category.
 *
 * Two series, so a legend is mandatory. Both use the first two validated
 * categorical slots (blue, orange) and the bars carry a 2px surface gap.
 * Everything shares one y-axis - two scales on one chart is never the answer.
 */
export default function ComparisonChart({
  rows = [],
  currency = 'INR',
  currentLabel = 'This month',
  previousLabel = 'Last month',
  height = 280,
}) {
  const { isDark } = useTheme();
  const ink = isDark ? CHART_INK.dark : CHART_INK.light;

  const currentColor = isDark ? CATEGORIES[0].dark : CATEGORIES[0].light;
  const previousColor = isDark ? CATEGORIES[1].dark : CATEGORIES[1].light;

  const data = inCategoryOrder(rows).filter((row) => row.current > 0 || row.previous > 0);

  if (!data.length) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Not enough history yet"
        message="Once you have two months of expenses, the comparison shows up here."
      />
    );
  }

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }} barGap={2}>
          <CartesianGrid stroke={ink.grid} strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="category"
            tick={{ fill: ink.muted, fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: ink.axis }}
            interval={0}
            angle={-25}
            textAnchor="end"
            height={82}
            tickFormatter={(value) => (value.length > 20 ? `${value.slice(0, 19)}\u2026` : value)}
          />
          <YAxis
            tick={{ fill: ink.muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={52}
            tickFormatter={(value) => formatMoney(value, currency, { compact: true })}
          />

          <Tooltip cursor={{ fill: isDark ? '#ffffff10' : '#0b0b0b08' }} content={<ChartTooltip currency={currency} />} />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 4 }}
            iconType="square"
            iconSize={10}
            formatter={(value) => <span style={{ color: ink.muted }}>{value}</span>}
          />

          <Bar dataKey="previous" name={previousLabel} fill={previousColor} radius={[4, 4, 0, 0]} maxBarSize={22} />
          <Bar dataKey="current" name={currentLabel} fill={currentColor} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
