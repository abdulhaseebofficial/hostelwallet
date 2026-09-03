import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import PasswordInput from '../../../shared/components/ui/PasswordInput';

/** Changing the password signs every other device out. */
export default function ChangePasswordModal({ open, onClose, form, onSubmit }) {
  const { errors, isSubmitting } = form.formState;

  return (
    <Modal open={open} onClose={onClose} title="Change your password" size="sm">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          error={errors.currentPassword && errors.currentPassword.message}
          {...form.register('currentPassword')}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number"
          error={errors.newPassword && errors.newPassword.message}
          {...form.register('newPassword')}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword && errors.confirmPassword.message}
          {...form.register('confirmPassword')}
        />

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Update password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
