import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../components/AuthShell';
import Input from '../../../shared/components/ui/Input';
import PasswordInput from '../../../shared/components/ui/PasswordInput';
import PasswordChecklist from '../../../shared/components/ui/PasswordChecklist';
import Button from '../../../shared/components/ui/Button';
import { useAuth } from '../AuthContext';
import { getErrorMessage, getFieldErrors } from '../../../shared/api/client';
import {
  nameSchema,
  emailSchema,
  passwordSchema,
  PASSWORD_MISMATCH,
  TERMS_MESSAGE,
} from '../../../shared/validation/rules';

/**
 * The same rules the API enforces, imported rather than restated.
 *
 * This form used to carry its own copy - "at least 8 characters, a letter and a
 * number" - which was already looser than what the server accepted. Now both
 * sides call the same functions from @hostelwallet/contracts, so the checklist
 * a student reads cannot promise something the server will refuse.
 */
const schema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    acceptTerms: z.boolean(),
  })
  /*
   * Both checks are refinements on the object, and acceptTerms is a plain
   * boolean rather than z.literal(true), deliberately. A field that fails its
   * own schema stops zod before any object-level refinement runs - so with
   * z.literal(true), an unticked box hid the "passwords do not match" message
   * until the box was ticked. Keeping the shape always-valid lets every
   * cross-field rule report independently, which is what a student needs:
   * one message per thing that is actually wrong.
   */
  .refine((values) => values.password === values.confirmPassword, {
    message: PASSWORD_MISMATCH,
    path: ['confirmPassword'],
  })
  .refine((values) => values.acceptTerms === true, {
    message: TERMS_MESSAGE,
    path: ['acceptTerms'],
  });

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting, isValid },
  } = useForm({
    resolver: zodResolver(schema),
    // Validate as they type: the checklist is only useful if it keeps up, and
    // the submit button can only be honestly disabled if validity is current.
    mode: 'onChange',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '', acceptTerms: false },
  });

  const password = watch('password');

  const onSubmit = async (values) => {
    try {
      await signUp(values);
      navigate('/onboarding', { replace: true });
    } catch (error) {
      // Map any server-side field errors back onto the form inputs.
      const fields = getFieldErrors(error);
      if (fields.length) {
        fields.forEach((field) => setError(field.field, { message: field.message }));
      }
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Two minutes now, a whole month of clarity after."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline dark:text-brand-400">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Your full name"
          error={errors.name && errors.name.message}
          {...register('name')}
        />

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@university.edu"
          error={errors.email && errors.email.message}
          {...register('email')}
        />

        <div className="space-y-2">
          <PasswordInput
            autoComplete="new-password"
            placeholder="Pick something only you would type"
            error={errors.password && errors.password.message}
            {...register('password')}
          />
          <PasswordChecklist value={password} />
        </div>

        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type it again"
          error={errors.confirmPassword && errors.confirmPassword.message}
          {...register('confirmPassword')}
        />

        <div className="rounded-xl bg-slate-100/70 p-4 dark:bg-slate-950/50">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              aria-describedby={errors.acceptTerms ? 'terms-error' : undefined}
              {...register('acceptTerms')}
            />
            {/* Written as plain text on purpose: there are no terms or privacy
                pages yet, and a link to a 404 is worse than no link. When those
                pages exist, this is the one place to link them from. */}
            <span className="text-sm text-slate-700 dark:text-slate-300">
              <span className="block font-medium text-slate-800 dark:text-slate-200">
                I agree to the terms of use and privacy policy
              </span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Your data stays in your account. We never ask for a bank login, and we do not sell anything.
              </span>
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="terms-error" className="mt-2 text-xs font-medium text-danger">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        <Button
          type="submit"
          icon={UserPlus}
          loading={isSubmitting}
          disabled={!isValid}
          size="lg"
          className="w-full"
        >
          Create account
        </Button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          We only ask for what the app needs. No bank login, ever.
        </p>
      </form>
    </AuthShell>
  );
}
