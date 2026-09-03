import { Monitor, Moon, Sun } from 'lucide-react';
import Card, { CardHeader } from '../../../shared/components/ui/Card';
import { cn } from '../../../shared/utils/format';

const THEME_OPTIONS = [
  { key: 'light', label: 'Light', icon: Sun },
  { key: 'dark', label: 'Dark', icon: Moon },
  { key: 'system', label: 'System', icon: Monitor },
];

/** Light, dark, or follow the device. */
export default function AppearanceCard({ theme, onChange }) {
  return (
    <Card>
      <CardHeader title="Appearance" subtitle="Dark mode is easier on the eyes in a hostel room at 2am" />
      <div className="grid grid-cols-3 gap-2">
        {THEME_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => onChange(option.key)}
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
  );
}
