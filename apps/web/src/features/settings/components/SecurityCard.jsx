import { Download, KeyRound, Trash2 } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import Button from '../../../shared/components/ui/Button';

/** Changing a password, taking the data out, and closing the account. */
export default function SecurityCard({ onChangePassword, onExport, onDelete }) {
  return (
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
          <Button variant="outline" icon={KeyRound} onClick={onChangePassword}>
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
          <Button variant="outline" icon={Download} onClick={onExport}>
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
          <Button variant="danger" icon={Trash2} onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}
