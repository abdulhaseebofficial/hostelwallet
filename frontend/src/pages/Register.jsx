import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthShell from '../components/layout/AuthShell';
import Input from '../components/ui/Input';
import PasswordInput from '../components/ui/PasswordInput';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage, getFieldErrors } from '../services/api';

// Mirrors the backend rules exactly, so nothing surprises the student on submit.
const schema = z
  .object({
    name: z.string().min(1, 'What should we call you?').max(60, 'That name is too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email'),
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-zA-Z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export default function Register() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

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
          placeholder="you@university.edu"
          error={errors.email && errors.email.message}
          {...register('email')}
        />

        <PasswordInput
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint="Must contain a letter and a number"
          error={errors.password && errors.password.message}
          {...register('password')}
        />

        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Type it again"
          error={errors.confirmPassword && errors.confirmPassword.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" icon={UserPlus} loading={isSubmitting} size="lg" className="w-full">
          Create account
        </Button>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          We only ask for what the app needs. No bank login, ever.
        </p>
      </form>
    </AuthShell>
  );
}
