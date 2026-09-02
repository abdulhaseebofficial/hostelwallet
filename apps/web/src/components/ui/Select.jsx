import { forwardRef } from 'react';
import { cn } from '../../utils/format';

/** `options` accepts plain strings or { value, label } objects. */
const Select = forwardRef(function Select(
  { label, error, hint, options = [], placeholder, className = '', id, ...props },
  ref
) {
  const selectId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={selectId} className="hw-label">
          {label}
        </label>
      )}

      <select
        id={selectId}
        ref={ref}
        className={cn('hw-input appearance-none pr-8', error && 'border-danger focus:border-danger focus:ring-danger')}
        aria-invalid={Boolean(error)}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const text = typeof option === 'string' ? option : option.label;
          return (
            <option key={value} value={value}>
              {text}
            </option>
          );
        })}
      </select>

      {hint && !error && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="hw-error">{error}</p>}
    </div>
  );
});

export default Select;
