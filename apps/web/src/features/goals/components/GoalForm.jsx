import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '../../../shared/components/ui/Input';
import Textarea from '../../../shared/components/ui/Textarea';
import Button from '../../../shared/components/ui/Button';
import { GOAL_ICONS } from '../../../shared/utils/constants';
import { currencySymbol, toInputDate, cn } from '../../../shared/utils/format';

const schema = z.object({
  title: z.string().min(1, 'Give your goal a name').max(80, 'Keep the name shorter'),
  targetAmount: z.coerce.number({ invalid_type_error: 'Enter a target' }).positive('Target must be more than 0'),
  deadline: z.string().optional(),
  icon: z.string().min(1),
  note: z.string().max(200).optional(),
});

export default function GoalForm({ goal, currency = 'INR', onSubmit, onCancel, submitting }) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      targetAmount: '',
      deadline: '',
      icon: GOAL_ICONS[0],
      note: '',
    },
  });

  useEffect(() => {
    if (goal) {
      reset({
        title: goal.title,
        targetAmount: goal.targetAmount,
        deadline: goal.deadline ? toInputDate(goal.deadline) : '',
        icon: goal.icon || GOAL_ICONS[0],
        note: goal.note || '',
      });
    }
  }, [goal, reset]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Input
        label="What are you saving for?"
        placeholder="e.g. New laptop for final year project"
        autoFocus
        error={errors.title && errors.title.message}
        {...register('title')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Target amount"
          type="number"
          step="1"
          inputMode="decimal"
          placeholder="25000"
          prefix={currencySymbol(currency)}
          error={errors.targetAmount && errors.targetAmount.message}
          {...register('targetAmount')}
        />

        <Input
          label="Deadline (optional)"
          type="date"
          min={toInputDate(new Date())}
          hint="We will work out how much to save per day"
          error={errors.deadline && errors.deadline.message}
          {...register('deadline')}
        />
      </div>

      <div>
        <span className="hw-label">Pick an icon</span>
        <Controller
          name="icon"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-1.5">
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => field.onChange(icon)}
                  aria-label={`Use icon ${icon}`}
                  aria-pressed={field.value === icon}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl text-xl transition',
                    field.value === icon
                      ? 'bg-brand-100 ring-2 ring-brand-500 dark:bg-brand-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700'
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          )}
        />
      </div>

      <Textarea
        label="Note (optional)"
        placeholder="Anything worth remembering about this goal"
        error={errors.note && errors.note.message}
        {...register('note')}
      />

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" loading={submitting}>
          {goal ? 'Save changes' : 'Create goal'}
        </Button>
      </div>
    </form>
  );
}
