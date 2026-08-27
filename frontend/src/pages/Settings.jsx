import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, KeyRound, Monitor, Moon, Plus, Sun, Tag, Trash2, User, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Card, { CardHeader } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import Modal from '../components/ui/Modal';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useCategories from '../hooks/useCategories';
import profileService from '../services/profileService';
import authService from '../services/authService';
import { getErrorMessage } from '../services/api';
import { CATEGORY_NAMES, CURRENCIES } from '../utils/constants';
import { cn } from '../utils/format';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(60),
  monthlyIncome: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Cannot be negative'),
  currency: z.string().min(1),
  university: z.string().max(100).optional(),
  hostelName: z.string().max(100).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[a-zA-Z]/, 'Include at least one letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { categories, custom, add, remove } = useCategories();

  const [newCategory, setNewCategory] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);

  const profileForm = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user ? user.name : '',
      monthlyIncome: user ? user.monthlyIncome : 0,
      currency: user ? user.currency : 'INR',
      university: user ? user.university : '',
      hostelName: user ? user.hostelName : '',
    },
  });

  const passwordForm = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const saveProfile = async (values) => {
    try {
      const updated = await profileService.update(values);
      updateUser(updated);
      toast.success('Profile updated');
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const changePassword = async (values) => {
    try {
      await authService.changePassword(values.currentPassword, values.newPassword);
      toast.success('Password changed. Other devices were logged out.');
      setPasswordOpen(false);
      passwordForm.reset();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    try {
      await add(name);
      setNewCategory('');
      toast.success(`Added "${name}"`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await profileService.deleteAccount(deletePassword);
      toast.success('Account deleted');
      await logout();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-slate-100">
          Settings
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Your profile, your categories, your data.
        </p>
      </header>

      {/* Profile */}
      <Card>
        <CardHeader title="Profile" subtitle={user ? user.email : ''} icon={User} />
        <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Full name"
              error={profileForm.formState.errors.name && profileForm.formState.errors.name.message}
              {...profileForm.register('name')}
            />
            <Input
              label="Monthly pocket money"
              type="number"
              inputMode="decimal"
              error={
                profileForm.formState.errors.monthlyIncome && profileForm.formState.errors.monthlyIncome.message
              }
              {...profileForm.register('monthlyIncome')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Currency"
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.symbol}  ${c.label}` }))}
              {...profileForm.register('currency')}
            />
            <Input label="University" placeholder="Optional" {...profileForm.register('university')} />
          </div>

          <Input label="Hostel name" placeholder="Optional" {...profileForm.register('hostelName')} />

          <div className="flex justify-end">
            <Button type="submit" loading={profileForm.formState.isSubmitting}>
              Save changes
            </Button>
          </div>
        </form>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader title="Appearance" subtitle="Dark mode is easier on the eyes in a hostel room at 2am" />
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setTheme(option.key)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-xs font-semibold transition',
                theme === option.key
                  ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-800 dark:text-slate-400'
              )}
            >
              <option.icon className="h-5 w-5" aria-hidden="true" />
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader title="Categories" subtitle="Add your own on top of the built-in ones" icon={Tag} />

        <div className="mb-4 flex flex-wrap gap-1.5">
          {CATEGORY_NAMES.map((name) => (
            <span
              key={name}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {name}
            </span>
          ))}

          {custom.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
            >
              {name}
              <button
                type="button"
                onClick={async () => {
                  try {
                    await remove(name);
                    toast.success(`Removed "${name}"`);
                  } catch (error) {
                    toast.error(getErrorMessage(error));
                  }
                }}
                aria-label={`Remove ${name}`}
                className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                addCategory();
              }
            }}
            placeholder="e.g. Gym membership"
            aria-label="New category name"
            className="hw-input flex-1"
          />
          <Button icon={Plus} onClick={addCategory} disabled={!newCategory.trim()}>
            Add
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {categories.length} categories available. A custom category can only be removed once no expense uses it.
        </p>
      </Card>

      {/* Security & data */}
      <Card>
        <CardHeader title="Security and data" icon={KeyRound} />
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Password</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Changing it signs you out everywhere else.
              </p>
            </div>
            <Button variant="outline" icon={KeyRound} onClick={() => setPasswordOpen(true)}>
              Change password
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Export your data</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every expense, goal, budget and chat message as JSON.
              </p>
            </div>
            <Button
              variant="outline"
              icon={Download}
              onClick={async () => {
                try {
                  await profileService.exportData();
                  toast.success('Export downloaded');
                } catch (error) {
                  toast.error(getErrorMessage(error));
                }
              }}
            >
              Download
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/25 bg-danger/[0.06] p-4 dark:border-danger/30 dark:bg-danger/10">
            <div>
              <p className="text-sm font-medium text-danger">Delete account</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Permanently removes your account and every record attached to it.
              </p>
            </div>
            <Button variant="danger" icon={Trash2} onClick={() => setDeleteOpen(true)}>
              Delete
            </Button>
          </div>
        </div>
      </Card>

      {/* Change password */}
      <Modal open={passwordOpen} onClose={() => setPasswordOpen(false)} title="Change your password" size="sm">
        <form onSubmit={passwordForm.handleSubmit(changePassword)} className="space-y-4">
          <Input
            label="Current password"
            type="password"
            autoComplete="current-password"
            error={
              passwordForm.formState.errors.currentPassword &&
              passwordForm.formState.errors.currentPassword.message
            }
            {...passwordForm.register('currentPassword')}
          />
          <Input
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number"
            error={
              passwordForm.formState.errors.newPassword && passwordForm.formState.errors.newPassword.message
            }
            {...passwordForm.register('newPassword')}
          />
          <Input
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            error={
              passwordForm.formState.errors.confirmPassword &&
              passwordForm.formState.errors.confirmPassword.message
            }
            {...passwordForm.register('confirmPassword')}
          />

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setPasswordOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={passwordForm.formState.isSubmitting}>
              Update password
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete account */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={busy}>
              Keep my account
            </Button>
            <Button variant="danger" loading={busy} disabled={!deletePassword} onClick={deleteAccount}>
              Delete forever
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            This removes your profile, every expense, all goals, budgets and your AI conversation. It cannot be
            undone. Consider exporting your data first.
          </p>
          <Input
            label="Type your password to confirm"
            type="password"
            autoComplete="current-password"
            value={deletePassword}
            onChange={(event) => setDeletePassword(event.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
}
