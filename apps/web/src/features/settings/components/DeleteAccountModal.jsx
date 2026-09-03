import Modal from '../../../shared/components/ui/Modal';
import Button from '../../../shared/components/ui/Button';
import PasswordInput from '../../../shared/components/ui/PasswordInput';

/**
 * The password is required so a stolen access token on its own cannot wipe an
 * account. The export is suggested here because after this there is nothing
 * left to export.
 */
export default function DeleteAccountModal({ open, onClose, password, onPasswordChange, onConfirm, busy }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete your account?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Keep my account
          </Button>
          <Button variant="danger" loading={busy} disabled={!password} onClick={onConfirm}>
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
        <PasswordInput
          label="Type your password to confirm"
          autoComplete="current-password"
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
        />
      </div>
    </Modal>
  );
}
