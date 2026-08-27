import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '../ui/Input';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { PAYMENT_METHODS, RECURRING_FREQUENCIES } from '../../utils/constants';
import { currencySymbol, toInputDate } from '../../utils/format';

// Mirrors the backend validators so the student is told about a bad value
// before a request is even sent.
const schema = z.object({
  amount: z.coerce.number({ invalid_type_error: 'Enter an amount' }).positive('Amount must be more than 0'),
  category: z.string().min(1, 'Pick a category'),
  description: z.string().max(200, 'Keep it under 200 characters').optional(),
  paymentMethod: z.enum(PAYMENT_METHODS),
  date: z.string().min(1, 'Pick a date'),
  isRecurring: z.boolean().optional(),
  recurringFrequency: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export default function ExpenseForm({ expense, categories = [], currency = 'INR', onSubmit, onCancel, submitting }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      category: categories[0] || '',
      description: '',
      paymentMethod: 'Cash',
      date: toInputDate(new Date()),
      isRecurring: false,
      recurringFrequency: 'monthly',
    },
  });

  // Re-seed the form whenever a different expense is opened for editing.
  useEffect(() => {
    if (expense) {
      reset({
        amount: expense.amount,
        category: expense.category,
        description: expense.description || '',
        paymentMethod: expense.paymentMethod,
        date: toInputDate(expense.date),
        isRecurring: Boolean(expense.isRecurring),
        recurringFrequency: expense.recurringFrequency || 'monthly',
      });
    }
  }, [expense, reset]);

  const isRecurring = watch('isRecurring');

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Amount"
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="0"
          prefix={currencySymbol(currency)}
          autoFocus
          error={errors.amount && errors.amount.message}
          {...register('amount')}
        />

        <Select
          label="Category"
          options={categories}
          placeholder={categories.length ? undefined : 'Loading...'}
          error={errors.category && errors.category.message}
          {...register('category')}
        />
      </div>

      <Input
        label="What was it for?"
        placeholder="e.g. Dhaba lunch with roommates"
        error={errors.description && errors.description.message}
        {...register('description')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Paid with"
          options={PAYMENT_METHODS}
          error={errors.paymentMethod && errors.paymentMethod.message}
          {...register('paymentMethod')}
        />

        <Input
          label="Date"
          type="date"
          max={toInputDate(new Date())}
          error={errors.date && errors.date.message}
          {...register('date')}
        />
      </div>

      <div className="rounded-xl bg-slate-100/70 p-4 dark:bg-slate-950/50">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            {...register('isRecurring')}
          />
          <span>
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              This repeats every month
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              Perfect for the mess bill or hostel fee. HostelWallet will add it for you automatically.
            </span>
          </span>
        </label>

        {isRecurring && (
          <Select
            className="mt-3"
            label="How often"
            options={RECURRING_FREQUENCIES}
            {...register('recurringFrequency')}
          />
        )}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {expense ? 'Save changes' : 'Add expense'}
        </Button>
      </div>
    </form>
  );
}
