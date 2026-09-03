import Input from '../../../shared/components/ui/Input';
import { cn, currencySymbol } from '../../../shared/utils/format';

/**
 * Amounts a hostel student in Pakistan actually saves for. Picking one fills
 * the form in, which is faster than typing and shows what a realistic target
 * looks like to someone who has never set one.
 */
const SUGGESTED_GOALS = [
  { title: 'Emergency fund', targetAmount: 10000, icon: '🛡' },
  { title: 'New phone', targetAmount: 45000, icon: '📱' },
  { title: 'Trip with friends', targetAmount: 25000, icon: '🏖' },
  { title: 'Laptop for projects', targetAmount: 120000, icon: '💻' },
];

/** Skippable: a student with no goal in mind should still reach the dashboard. */
export default function GoalStep({ form, onChange }) {
  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Saving works much better with a target. Pick one of these or write your own.
      </p>

      <div className="grid grid-cols-2 gap-2">
        {SUGGESTED_GOALS.map((suggestion) => (
          <button
            key={suggestion.title}
            type="button"
            onClick={() =>
              onChange({
                goalTitle: suggestion.title,
                goalTarget: String(suggestion.targetAmount),
                goalIcon: suggestion.icon,
              })
            }
            className={cn(
              'rounded-xl border p-3 text-left transition',
              form.goalTitle === suggestion.title
                ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                : 'border-slate-200 hover:border-brand-300 dark:border-slate-800'
            )}
          >
            <span className="text-xl" aria-hidden="true">
              {suggestion.icon}
            </span>
            <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{suggestion.title}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {currencySymbol(form.currency)}
              {suggestion.targetAmount.toLocaleString('en-PK')}
            </p>
          </button>
        ))}
      </div>

      <Input
        label="Goal name"
        placeholder="What are you saving for?"
        value={form.goalTitle}
        onChange={(event) => onChange({ goalTitle: event.target.value })}
      />

      <Input
        label="Target amount"
        type="number"
        inputMode="decimal"
        placeholder="20000"
        prefix={currencySymbol(form.currency)}
        value={form.goalTarget}
        onChange={(event) => onChange({ goalTarget: event.target.value })}
      />
    </>
  );
}
