import { cn } from '../../utils/format';

const TONES = {
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300',
  safe: 'bg-safe/10 text-safe dark:bg-safe/15 dark:text-safe',
  warning: 'bg-caution/10 text-caution dark:bg-caution/15 dark:text-caution',
  danger: 'bg-danger/10 text-danger dark:bg-danger/15 dark:text-danger',
};

export default function Badge({ children, tone = 'neutral', className = '', icon: Icon }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
      {children}
    </span>
  );
}
