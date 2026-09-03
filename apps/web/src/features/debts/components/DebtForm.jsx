import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Textarea from '../../../shared/components/ui/Textarea';
import Button from '../../../shared/components/ui/Button';
import Modal from '../../../shared/components/ui/Modal';
import useCategories from '../../../shared/hooks/useCategories';
import { cn, currencySymbol } from '../../../shared/utils/format';

const schema = z.object({
  kind: z.enum(['BORROWED', 'LENT']),
  personName: z.string().min(1, 'Whose money is it?').max(80),
  originalAmount: z.coerce
    .number({ invalid_type_error: 'Enter an amount' })
    .positive('Amount must be more than zero'),
  transactionDate: z.string().min(1, 'When was this?'),
  dueDate: z.string().optional(),
  personContact: z.string().max(120).optional(),
  category: z.string().optional(),
  note: z.string().max(500).optional(),
});

/** yyyy-mm-dd, which is what a date input wants. */
const asDateInput = (value) => (value ? new Date(value).toISOString().slice(0, 10) : '');

/**
 * Add or correct a record.
 *
 * The direction is a pair of buttons rather than a dropdown, because it is the
 * first decision and the one most likely to be got wrong: "I borrowed" and "I
 * lent" read as sentences, where a select labelled "type" does not.
 *
 * The amount is not editable below what has already been paid - the server
 * refuses it - so the hint says so before the student tries.
 */
export default function DebtForm({ open, onClose, onSubmit, debt = null, currency = 'PKR' }) {
  const { categories } = useCategories();
  const editing = Boolean(debt);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: debt?.kind || 'BORROWED',
      personName: debt?.personName || '',
      originalAmount: debt?.originalAmount ?? '',
      transactionDate: asDateInput(debt?.transactionDate) || asDateInput(new Date()),
      dueDate: asDateInput(debt?.dueDate),
      personContact: debt?.personContact || '',
      category: debt?.category || '',
      note: debt?.note || '',
    },
  });

  const kind = watch('kind');

  const submit = (values) =>
    onSubmit({
      ...values,
      dueDate: values.dueDate || null,
      category: values.category || null,
    });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit this record' : 'Add to your udhaar'}
      size="md"
    >
      <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
        <fieldset>
          <legend className="hw-label mb-2">Which way round?</legend>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'BORROWED', label: 'I borrowed money', hint: 'I have to pay it back' },
              { value: 'LENT', label: 'I lent money', hint: 'I have to get it back' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setValue('kind', option.value, { shouldValidate: true })}
                aria-pressed={kind === option.value}
                className={cn(
                  'rounded-xl border p-3 text-left transition',
                  kind === option.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                    : 'border-slate-200 hover:border-brand-300 dark:border-slate-800'
                )}
              >
                <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {option.label}
                </span>
                <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                  {option.hint}
                </span>
              </button>
            ))}
          </div>
          <input type="hidden" {...register('kind')} />
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={kind === 'BORROWED' ? 'Who lent it to you?' : 'Who did you lend it to?'}
            placeholder="e.g. Ali from Block C"
            error={errors.personName && errors.personName.message}
            {...register('personName')}
          />
          <Input
            label="Amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            prefix={currencySymbol(currency)}
            hint={editing ? 'Cannot go below what is already paid' : undefined}
            error={errors.originalAmount && errors.originalAmount.message}
            {...register('originalAmount')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="When"
            type="date"
            error={errors.transactionDate && errors.transactionDate.message}
            {...register('transactionDate')}
          />
          <Input
            label="Pay back by"
            type="date"
            hint="Optional - we will flag it if it passes"
            {...register('dueDate')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone or contact"
            placeholder="Optional"
            {...register('personContact')}
          />
          <Select
            label="Category"
            options={[
              { value: '', label: 'No category' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
            {...register('category')}
          />
        </div>

        <Textarea
          label="Note"
          rows={2}
          placeholder="Optional - what was it for?"
          {...register('note')}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {editing ? 'Save changes' : 'Add record'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
