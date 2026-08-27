import { forwardRef } from 'react';
import { cn } from '../../utils/format';

/**
 * Text/number/date input with a label, an optional prefix (currency symbol),
 * an optional suffix (a show-password toggle, a unit) and an error slot.
 * forwardRef so react-hook-form can register it.
 *
 * The suffix sits inside the same relative wrapper as the input, so it stays
 * centred on the field whatever the label, hint or error underneath is doing.
 */
const Input = forwardRef(function Input(
  { label, error, hint, prefix, suffix, className = '', id, ...props },
  ref
) {
  const inputId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="hw-label">
          {label}
        </label>
      )}

      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500 dark:text-slate-400">
            {prefix}
          </span>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            'hw-input',
            prefix && 'pl-9',
            suffix && 'pr-10',
            error && 'border-danger focus:border-danger focus:ring-danger'
          )}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {suffix && <span className="absolute right-2.5 top-1/2 -translate-y-1/2">{suffix}</span>}
      </div>

      {hint && !error && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && (
        <p id={`${inputId}-error`} className="hw-error">
          {error}
        </p>
      )}
    </div>
  );
});

export default Input;
