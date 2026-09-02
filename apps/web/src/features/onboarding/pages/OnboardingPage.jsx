import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, PartyPopper, Target, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import Input from '../../../shared/components/ui/Input';
import Select from '../../../shared/components/ui/Select';
import Button from '../../../shared/components/ui/Button';
import { useAuth } from '../../auth';
import profileService from '../../../shared/api/profileApi';
import { getErrorMessage } from '../../../shared/api/client';
import { CURRENCIES, GOAL_ICONS } from '../../../shared/utils/constants';
import { cn, currencySymbol } from '../../../shared/utils/format';

const STEPS = [
  { key: 'income', title: 'Your monthly money', icon: Wallet },
  { key: 'place', title: 'Where you study', icon: Check },
  { key: 'goal', title: 'Your first goal', icon: Target },
];

const SUGGESTED_GOALS = [
  { title: 'Emergency fund', targetAmount: 10000, icon: '\uD83D\uDEE1' },
  { title: 'New phone', targetAmount: 45000, icon: '\uD83D\uDCF1' },
  { title: 'Trip with friends', targetAmount: 25000, icon: '\uD83C\uDFD6' },
  { title: 'Laptop for projects', targetAmount: 120000, icon: '\uD83D\uDCBB' },
];

/** First-run wizard. Everything except the income figure is skippable. */
export default function Onboarding() {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    monthlyIncome: '',
    currency: user && user.currency ? user.currency : 'INR',
    university: '',
    hostelName: '',
    goalTitle: '',
    goalTarget: '',
    goalIcon: GOAL_ICONS[0],
  });

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));

  const finish = async (skipGoal = false) => {
    if (!form.monthlyIncome || Number(form.monthlyIncome) < 0) {
      setStep(0);
      return toast.error('Enter your monthly pocket money first');
    }

    setSaving(true);
    try {
      const payload = {
        monthlyIncome: Number(form.monthlyIncome),
        currency: form.currency,
        university: form.university,
        hostelName: form.hostelName,
      };

      if (!skipGoal && form.goalTitle && Number(form.goalTarget) > 0) {
        payload.goal = {
          title: form.goalTitle,
          targetAmount: Number(form.goalTarget),
          icon: form.goalIcon,
        };
      }

      const data = await profileService.completeOnboarding(payload);
      updateUser(data.user);
      toast.success('All set. Welcome to HostelWallet!');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-400">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
            {(() => {
              const StepIcon = STEPS[step].icon;
              return <StepIcon className="h-5 w-5" aria-hidden="true" />;
            })()}
          </span>
          {STEPS[step].title}
        </h1>

        <div className="mt-4 flex gap-1.5">
          {STEPS.map((item, index) => (
            <div
              key={item.key}
              className={cn(
                'h-1.5 flex-1 rounded-full transition',
                index <= step ? 'bg-brand-600' : 'bg-slate-200 dark:bg-slate-800'
              )}
            />
          ))}
        </div>
      </div>

      <div className="hw-card space-y-5 p-6">
        {step === 0 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              How much do you have to work with each month? Pocket money, allowance, part-time pay - the total you
              expect to receive.
            </p>

            <Input
              label="Monthly pocket money"
              type="number"
              inputMode="decimal"
              placeholder="25000"
              autoFocus
              prefix={currencySymbol(form.currency)}
              value={form.monthlyIncome}
              onChange={(event) => set({ monthlyIncome: event.target.value })}
              hint="You can change this any time in Settings"
            />

            <Select
              label="Currency"
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol}  ${c.label}` }))}
              value={form.currency}
              onChange={(event) => set({ currency: event.target.value })}
            />

            <div className="flex flex-wrap gap-1.5">
              {[15000, 20000, 25000, 35000].map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => set({ monthlyIncome: String(amount) })}
                  className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  {currencySymbol(form.currency)}
                  {amount.toLocaleString('en-PK')}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Optional, but it makes the AI advice sound less like a robot and more like a senior from your hostel.
            </p>

            <Input
              label="University or college"
              placeholder="e.g. University of the Punjab"
              value={form.university}
              onChange={(event) => set({ university: event.target.value })}
            />

            <Input
              label="Hostel name"
              placeholder="e.g. Hostel Block C"
              value={form.hostelName}
              onChange={(event) => set({ hostelName: event.target.value })}
            />
          </>
        )}

        {step === 2 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Saving works much better with a target. Pick one of these or write your own.
            </p>

            <div className="grid grid-cols-2 gap-2">
              {SUGGESTED_GOALS.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  onClick={() =>
                    set({
                      goalTitle: suggestion.title,
                      goalTarget: String(suggestion.targetAmount),
                      goalIcon: suggestion.icon,
                    })
                  }
                  className={cn(
                    'rounded-xl border p-3 text-left transition',
                    form.goalTitle === suggestion.title
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-slate-200 hover:border-brand-300 dark:border-slate-800'
                  )}
                >
                  <span className="text-xl" aria-hidden="true">
                    {suggestion.icon}
                  </span>
                  <p className="mt-1 text-xs font-semibold text-slate-800 dark:text-slate-200">{suggestion.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {currencySymbol(form.currency)}
                    {suggestion.targetAmount.toLocaleString('en-PK')}
                  </p>
                </button>
              ))}
            </div>

            <Input
              label="Goal name"
              placeholder="What are you saving for?"
              value={form.goalTitle}
              onChange={(event) => set({ goalTitle: event.target.value })}
            />

            <Input
              label="Target amount"
              type="number"
              inputMode="decimal"
              placeholder="20000"
              prefix={currencySymbol(form.currency)}
              value={form.goalTarget}
              onChange={(event) => set({ goalTarget: event.target.value })}
            />
          </>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2">
        {step > 0 && (
          <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep((current) => current - 1)}>
            Back
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          {step === STEPS.length - 1 ? (
            <>
              <Button variant="ghost" onClick={() => finish(true)} disabled={saving}>
                Skip for now
              </Button>
              <Button icon={PartyPopper} loading={saving} onClick={() => finish(false)}>
                Finish setup
              </Button>
            </>
          ) : (
            <Button
              icon={ArrowRight}
              onClick={() => {
                if (step === 0 && !form.monthlyIncome) {
                  return toast.error('Enter your monthly pocket money to continue');
                }
                setStep((current) => current + 1);
                return undefined;
              }}
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
