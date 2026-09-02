import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import Input from '../../../shared/components/ui/Input';
import ProgressBar from '../../../shared/components/ui/ProgressBar';
import { currencySymbol, formatMoney, cn } from '../../../shared/utils/format';

const QUICK_AMOUNTS = [500, 1000, 2500, 5000];

/**
 * Add money to a goal, or take it back out.
 * The preview bar shows where the goal will land before anything is saved.
 */
export default function ContributeModal({ open, goal, currency = 'INR', onClose, onSubmit, submitting }) {
  const [mode, setMode] = useState('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  if (!goal) return null;

  const value = Number(amount) || 0;
  const signed = mode === 'add' ? value : -value;
  const projected = Math.max(0, goal.savedAmount + signed);
  const projectedPercent = goal.targetAmount ? Math.min(100, Math.round((projected / goal.targetAmount) * 100)) : 0;

  const close = () => {
    setAmount('');
    setError('');
    setMode('add');
    onClose();
  };

  const submit = async () => {
    if (value <= 0) return setError('Enter an amount above 0');
    if (mode === 'withdraw' && value > goal.savedAmount) {
      return setError(`You only have ${formatMoney(goal.savedAmount, currency)} in this goal`);
    }

    setError('');
    await onSubmit(signed);
    setAmount('');
    setMode('add');
    return undefined;
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={goal.title}
      subtitle={`${formatMoney(goal.savedAmount, currency)} of ${formatMoney(goal.targetAmount, currency)} saved`}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} loading={submitting} variant={mode === 'add' ? 'primary' : 'danger'}>
            {mode === 'add' ? 'Add money' : 'Withdraw'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {[
            { key: 'add', label: 'Add money', icon: Plus },
            { key: 'withdraw', label: 'Withdraw', icon: Minus },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => {
                setMode(option.key);
                setError('');
              }}
              className={cn(
                'flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition',
                mode === option.key
                  ? 'bg-canvas-card text-slate-900 shadow-card dark:bg-slate-800 dark:text-slate-100'
                  : 'text-slate-500 dark:text-slate-400'
              )}
            >
              <option.icon className="h-4 w-4" />
              {option.label}
            </button>
          ))}
        </div>

        <Input
          label="Amount"
          type="number"
          inputMode="decimal"
          placeholder="0"
          autoFocus
          prefix={currencySymbol(currency)}
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setError('');
          }}
          error={error}
        />

        <div className="flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              onClick={() => setAmount(String(quick))}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              +{formatMoney(quick, currency)}
            </button>
          ))}
        </div>

        {value > 0 && (
          <div className="rounded-xl bg-slate-50 p-3.5 dark:bg-slate-950/60">
            <p className="mb-2 text-xs text-slate-600 dark:text-slate-400">
              After this: <strong className="text-slate-900 dark:text-slate-100">{formatMoney(projected, currency)}</strong>{' '}
              of {formatMoney(goal.targetAmount, currency)} ({projectedPercent}%)
            </p>
            <ProgressBar value={projectedPercent} tone={projectedPercent >= 100 ? 'safe' : 'brand'} />
            {projectedPercent >= 100 && (
              <p className="mt-2 text-xs font-semibold text-safe">That completes this goal. Nice work!</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
