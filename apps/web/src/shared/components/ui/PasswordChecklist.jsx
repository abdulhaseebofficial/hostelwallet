import { Check, Circle } from 'lucide-react';
import { passwordRequirements } from '../../validation/rules';
import { cn } from '../../utils/format';

/**
 * What the password still needs, updated as the student types.
 *
 * A single "password is too weak" message tells someone they failed without
 * telling them what to change, so they guess. This lists every requirement up
 * front and ticks them off, which turns a rejection into a checklist.
 *
 * The requirements come from @hisabkikitab/contracts, the same list the API
 * enforces, so this can never promise something the server will refuse.
 *
 * Met and unmet are never distinguished by colour alone: each row carries an
 * icon that differs in shape, and text that a screen reader announces. The
 * whole list is a live region, so a student using one hears requirements being
 * satisfied instead of only finding out on submit.
 */
export default function PasswordChecklist({ value = '', className = '' }) {
  const requirements = passwordRequirements(value);
  const metCount = requirements.filter((requirement) => requirement.met).length;

  return (
    <div className={cn('rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50', className)}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Your password needs
        <span className="sr-only">
          {' '}
          - {metCount} of {requirements.length} requirements met
        </span>
      </p>

      <ul className="space-y-1" aria-live="polite">
        {requirements.map(({ key, label, met }) => (
          <li
            key={key}
            className={cn(
              'flex items-center gap-2 text-xs transition-colors',
              met ? 'text-safe' : 'text-slate-500 dark:text-slate-400'
            )}
          >
            {met ? (
              <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Circle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>{label}</span>
            {/* The state in words, for anyone who cannot see the icon or the colour. */}
            <span className="sr-only">{met ? '(met)' : '(not met yet)'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
