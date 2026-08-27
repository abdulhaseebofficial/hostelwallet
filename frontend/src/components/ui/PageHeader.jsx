import { cn } from '../../utils/format';

/**
 * The title block every screen opens with: name on the left, whatever the
 * screen's primary action is on the right.
 *
 * Eight pages were each repeating the same header markup and the same long
 * class string, so a change to the page title style meant eight edits and the
 * copies had already started to drift.
 */
export default function PageHeader({ title, subtitle, badge, children, className = '' }) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
          {title}
          {badge}
        </h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>

      {/* The action slot. Left empty on screens that have no primary action. */}
      {children}
    </header>
  );
}
