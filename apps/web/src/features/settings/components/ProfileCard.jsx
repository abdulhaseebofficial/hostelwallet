import { User } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import { CURRENCIES } from '../../../shared/utils/constants';

/**
 * Name, pocket money, currency and where the student lives.
 *
 * The form itself is owned by the page, so the page stays the one place that
 * knows what saving means; this only lays it out.
 */
export default function ProfileCard({ user, form, onSave }) {
  const { errors, isSubmitting } = form.formState;

  return (
    <Card>
      <CardHeader title="Profile" subtitle={user ? user.email : ''} icon={User} />
      <form onSubmit={form.handleSubmit(onSave)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Full name"
            error={errors.name && errors.name.message}
            {...form.register('name')}
          />
          <Input
            label="Monthly pocket money"
            type="number"
            inputMode="decimal"
            error={errors.monthlyIncome && errors.monthlyIncome.message}
            {...form.register('monthlyIncome')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Currency"
            options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol}  ${c.label}` }))}
            {...form.register('currency')}
          />
          <Input label="University" placeholder="Optional" {...form.register('university')} />
        </div>

        <Input label="Hostel name" placeholder="Optional" {...form.register('hostelName')} />

        <div className="flex justify-end">
          <Button type="submit" loading={isSubmitting}>
            Save changes
          </Button>
        </div>
      </form>
    </Card>
  );
}
