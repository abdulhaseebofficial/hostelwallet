import { NavLink } from 'react-router-dom';
import { FileBarChart, HandCoins, LayoutDashboard, PieChart, Receipt, Settings, Sparkles, Target, Wallet, X } from 'lucide-react';
import { cn } from '../../shared/utils/format';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/income', label: 'Income', icon: Wallet },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/debts', label: 'Udhaar', icon: HandCoins },
  { to: '/budget', label: 'Budget', icon: PieChart },
  { to: '/advisor', label: 'AI Advisor', icon: Sparkles },
  { to: '/reports', label: 'Reports', icon: FileBarChart },
  { to: '/settings', label: 'Settings', icon: Settings },
];

/**
 * The mobile tab bar shows FOUR screens, not five: the middle slot is the
 * raised "add expense" button. Logging a purchase is the thing a student does
 * many times a day, and it should never cost a scroll to the top of a page.
 * The two shown on each side are the most visited; everything else is one tap
 * away in the drawer.
 */
export const MOBILE_NAV_ITEMS = NAV_ITEMS.filter((item) =>
  ['/dashboard', '/expenses', '/goals', '/advisor'].includes(item.to)
);

function NavItems({ onNavigate }) {
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) => cn('hw-nav-item', isActive && 'hw-nav-item-active')}
        >
          {({ isActive }) => (
            <>
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {label}
              {/* Announced by screen readers; "active" styling alone says nothing. */}
              {isActive && <span className="sr-only">(current page)</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

/**
 * Desktop rail plus the mobile drawer. Both render the same list so a new
 * screen only has to be added to NAV_ITEMS once.
 */
export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-canvas-card px-3 py-4 lg:block dark:border-slate-800 dark:bg-canvas-darkCard">
        <div className="sticky top-4">
          <NavItems />

          {/* Shortcuts are worthless if nobody knows they exist. */}
          <p className="mt-6 px-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Press{' '}
            <kbd className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              N
            </kbd>{' '}
            anywhere to log an expense.
          </p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <aside className="relative z-10 h-full w-64 animate-slide-up overflow-y-auto border-r border-slate-200 bg-canvas-card px-3 py-4 dark:border-slate-800 dark:bg-canvas-darkCard">
            <div className="mb-4 flex items-center justify-between px-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">Menu</span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
