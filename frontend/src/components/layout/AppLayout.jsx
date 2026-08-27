import { useCallback, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import Navbar from './Navbar';
import Sidebar, { MOBILE_NAV_ITEMS } from './Sidebar';
import Footer from './Footer';
import Modal from '../ui/Modal';
import ExpenseForm from '../expenses/ExpenseForm';
import useCategories from '../../hooks/useCategories';
import { notifyDataChanged } from '../../hooks/useAsync';
import { useAuth } from '../../context/AuthContext';
import expenseService from '../../services/expenseService';
import { getErrorMessage } from '../../services/api';
import { cn } from '../../utils/format';

/**
 * The quick-add form is its own component so `useCategories` only fires its
 * request when the dialog is actually opened, not on every page load.
 */
function QuickAddForm({ onDone, onCancel }) {
  const { currency } = useAuth();
  const { categories } = useCategories();
  const [saving, setSaving] = useState(false);

  const submit = async (values) => {
    setSaving(true);
    try {
      await expenseService.create(values);
      toast.success('Expense added');
      notifyDataChanged();
      onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ExpenseForm
      categories={categories}
      currency={currency}
      onSubmit={submit}
      onCancel={onCancel}
      submitting={saving}
    />
  );
}

/**
 * Shell for every signed-in screen: top bar, a sidebar on desktop, a bottom
 * tab bar on phones (which is where a student actually logs an expense).
 */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  const closeQuickAdd = useCallback(() => setQuickAddOpen(false), []);

  // "N" for a new expense, from anywhere - but never while the student is
  // typing into a field, or the letter would vanish into a dialog.
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key !== 'n' && event.key !== 'N') return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const el = document.activeElement;
      const tag = el ? el.tagName : '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;

      event.preventDefault();
      setQuickAddOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex min-h-full flex-col bg-canvas-light dark:bg-canvas-dark">
      <a href="#main-content" className="hw-skip-link">
        Skip to main content
      </a>

      <Navbar onOpenMenu={() => setMenuOpen(true)} />

      <div className="flex flex-1">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">
          {/* pb-28 leaves room for the mobile tab bar and its raised button */}
          <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
            <Outlet />
          </div>
          <div className="hidden lg:block">
            <Footer />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation. Two tabs, the add button, two more tabs. */}
      <nav
        aria-label="Main"
        className="hw-safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-canvas-card/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-canvas-darkCard/95"
      >
        <ul className="mx-auto flex max-w-md items-end">
          {MOBILE_NAV_ITEMS.slice(0, 2).map((item) => (
            <MobileTab key={item.to} item={item} />
          ))}

          <li className="flex flex-1 justify-center">
            {/* -mt-6 lifts it out of the bar so it reads as the primary action. */}
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              aria-label="Add an expense"
              className="hw-fab -mt-6 mb-1.5"
            >
              <Plus className="h-6 w-6" aria-hidden="true" />
            </button>
          </li>

          {MOBILE_NAV_ITEMS.slice(2).map((item) => (
            <MobileTab key={item.to} item={item} />
          ))}
        </ul>
      </nav>

      <Modal
        open={quickAddOpen}
        onClose={closeQuickAdd}
        title="Add an expense"
        subtitle="Logged against today unless you change the date"
        size="md"
      >
        <QuickAddForm onDone={closeQuickAdd} onCancel={closeQuickAdd} />
      </Modal>
    </div>
  );
}

function MobileTab({ item: { to, label, icon: Icon } }) {
  return (
    <li className="flex-1">
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            // min-h-[52px] keeps every tap target above the 44px guideline.
            'flex min-h-[52px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition',
            isActive ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500 dark:text-slate-400'
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
            {isActive && <span className="sr-only">(current page)</span>}
          </>
        )}
      </NavLink>
    </li>
  );
}
