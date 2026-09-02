import { forwardRef } from 'react';
import { cn } from '../../utils/format';

const Textarea = forwardRef(function Textarea({ label, error, hint, className = '', id, rows = 3, ...props }, ref) {
  const textareaId = id || props.name;

  return (
    <div className={className}>
      {label && (
        <label htmlFor={textareaId} className="hw-label">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        ref={ref}
        rows={rows}
        className={cn('hw-input resize-none', error && 'border-danger focus:border-danger focus:ring-danger')}
        aria-invalid={Boolean(error)}
        {...props}
      />
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="hw-error">{error}</p>}
    </div>
  );
});

export default Textarea;
