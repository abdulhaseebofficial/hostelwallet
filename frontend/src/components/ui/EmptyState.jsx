import { cn } from '../../utils/format';
import Button from './Button';

/**
 * Friendly placeholder for a screen with no data yet. Every list in the app
 * uses this instead of showing a blank area.
 */
export default function EmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
  actionIcon,
  className = '',
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 dark:bg-brand-500/10">
          <Icon className="h-7 w-7 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {message && <p className="mt-1.5 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} icon={actionIcon} className="mt-5">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
