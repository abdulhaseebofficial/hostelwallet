import { cn } from '../../utils/format';

/** Standard surface. `as` lets a card become a <section> or a <li>. */
export default function Card({ children, className = '', as: Tag = 'div', padded = true, ...props }) {
  return (
    <Tag className={cn('hw-card', padded && 'p-5', className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, subtitle, icon: Icon, action, className = '' }) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {Icon && <Icon className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />}
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
