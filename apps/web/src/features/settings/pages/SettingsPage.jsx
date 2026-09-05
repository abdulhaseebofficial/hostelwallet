import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import PageHeader from '../../../shared/components/ui/PageHeader';
import { useAuth } from '../../auth';
import { useTheme } from '../../../app/providers/ThemeProvider';
import useCategories from '../../../shared/hooks/useCategories';
import useMutation from '../../../shared/hooks/useMutation';
import settingsApi from '../api/settingsApi';
import ProfileCard from '../components/ProfileCard';
import AppearanceCard from '../components/AppearanceCard';
import CategoriesCard from '../components/CategoriesCard';
import SecurityCard from '../components/SecurityCard';
import ChangePasswordModal from '../components/ChangePasswordModal';
import {
  nameSchema,
  passwordSchema as sharedPasswordSchema,
  PASSWORD_MISMATCH,
} from '../../../shared/validation/rules';
import DeleteAccountModal from '../components/DeleteAccountModal';

const profileSchema = z.object({
  // The same rule the API applies, so editing a profile cannot save a name
  // that signing up would have refused.
  name: nameSchema,
  monthlyIncome: z.coerce.number({ invalid_type_error: 'Enter a number' }).min(0, 'Cannot be negative'),
  currency: z.string().min(1),
  university: z.string().max(100).optional(),
  hostelName: z.string().max(100).optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: sharedPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm the new password'),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: PASSWORD_MISMATCH,
    path: ['confirmPassword'],
  });

/**
 * The Settings screen.
 *
 * Four cards and two modals, each in its own file. What stays here is the part
 * that has to be in one place: the state, the forms, and what saving actually
 * does - so a card can be read without wondering where its data goes, and this
 * can be read without wading through markup.
 */
export default function Settings() {
  const navigate = useNavigate();
  const { user, updateUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { categories, custom, add, remove } = useCategories();

  const [newCategory, setNewCategory] = useState('');
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  // Deleting the account is the only write here whose in-flight state is shown,
  // so it gets its own flag; the rest just need the shared toast handling.
  const { saving: busy, run: runDelete } = useMutation();
  const { run } = useMutation();

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
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const saveProfile = (values) =>
    run(() => settingsApi.updateProfile(values), {
      success: 'Profile updated',
      onDone: updateUser,
    });

  const changePassword = (values) =>
    run(() => settingsApi.changePassword(values.currentPassword, values.newPassword), {
      success: 'Password changed. Other devices were logged out.',
      onDone: () => {
        setPasswordOpen(false);
        passwordForm.reset();
      },
    });

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return undefined;
    return run(() => add(name), {
      success: `Added "${name}"`,
      onDone: () => setNewCategory(''),
    });
  };

  const removeCategory = (name) => run(() => remove(name), { success: `Removed "${name}"` });

  const exportData = () =>
    run(() => settingsApi.exportData(), { success: 'Export downloaded' });

  const deleteAccount = () =>
    runDelete(() => settingsApi.deleteAccount(deletePassword), {
      success: 'Account deleted',
      onDone: logout,
    });

  return (
    <div className="max-w-3xl space-y-5">
      <PageHeader title="Settings" subtitle="Your profile, your categories, your data." />

      <ProfileCard user={user} form={profileForm} onSave={saveProfile} />

      <AppearanceCard theme={theme} onChange={setTheme} />

      <CategoriesCard
        categories={categories}
        custom={custom}
        newCategory={newCategory}
        onNewCategoryChange={setNewCategory}
        onAdd={addCategory}
        onRemove={removeCategory}
      />

      <SecurityCard
        user={user}
        onChangePassword={() => setPasswordOpen(true)}
        // A Google-only account has no current password to type, so it goes
        // through the ordinary reset flow to add one.
        onSetPassword={() => navigate('/forgot-password')}
        onExport={exportData}
        onDelete={() => setDeleteOpen(true)}
      />

      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        form={passwordForm}
        onSubmit={changePassword}
      />

      <DeleteAccountModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        password={deletePassword}
        onPasswordChange={setDeletePassword}
        onConfirm={deleteAccount}
        busy={busy}
      />
    </div>
  );
}
