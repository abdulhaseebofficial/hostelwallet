import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Input from './Input';

/**
 * A password field that can show what was typed.
 *
 * Every auth screen was hand-rolling this: an extra relative wrapper around
 * Input and a button pinned at `top-[34px]` - a magic number measured off the
 * label, which silently mis-aligned on any field without one. Here the toggle
 * goes through Input's suffix slot, so it centres itself on the field.
 *
 * Each field owns its own visibility, so revealing one password on the sign-up
 * form no longer reveals the confirmation field at the same time.
 */
const PasswordInput = forwardRef(function PasswordInput({ label = 'Password', ...props }, ref) {
  const [shown, setShown] = useState(false);

  return (
    <Input
      ref={ref}
      label={label}
      type={shown ? 'text' : 'password'}
      suffix={
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
      {...props}
    />
  );
});

export default PasswordInput;
