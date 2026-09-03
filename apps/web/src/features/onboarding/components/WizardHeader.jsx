import { cn } from '../../../shared/utils/format';

/** Which step this is, what it is called, and how far along the bar sits. */
export default function WizardHeader({ steps, step }) {
  const StepIcon = steps[step].icon;

  return (
    <div className="mb-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
        Step {step + 1} of {steps.length}
      </p>
      <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
          <StepIcon className="h-5 w-5" aria-hidden="true" />
        </span>
        {steps[step].title}
      </h1>

      <div className="mt-4 flex gap-1.5">
        {steps.map((item, index) => (
          <div
            key={item.key}
            className={cn(
              'h-1.5 flex-1 rounded-full transition',
              index <= step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'
            )}
          />
        ))}
      </div>
    </div>
  );
}
