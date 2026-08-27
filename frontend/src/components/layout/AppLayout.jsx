import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar, { MOBILE_NAV_ITEMS } from './Sidebar';
import Footer from './Footer';
import { cn } from '../../utils/format';

/**
 * Shell for every signed-in screen: top bar, a sidebar on desktop, a bottom
 * tab bar on phones (which is where a student actually logs an expense).
 */
export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex min-h-full flex-col bg-canvas-light dark:bg-canvas-dark">
      <Navbar onOpenMenu={() => setMenuOpen(true)} />

      <div className="flex flex-1">
        <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

        <main className="min-w-0 flex-1">
          {/* pb-24 leaves room for the mobile tab bar */}
          <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-10">
            <Outlet />
          </div>
          <div className="hidden lg:block">
            <Footer />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-canvas-card/95 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-canvas-darkCard/95">
        <ul className="mx-auto flex max-w-md">
          {MOBILE_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition',
                    isActive
                      ? 'text-brand-600 dark:text-brand-400'
                      : 'text-slate-500 dark:text-slate-400'
                  )
                }
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
