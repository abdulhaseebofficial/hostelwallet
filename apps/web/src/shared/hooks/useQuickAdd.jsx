import { createContext, useContext, useMemo } from 'react';

/**
 * One way to start logging an expense, shared by everything that offers it.
 *
 * The shell owns the quick-add dialog, and three separate things used to open
 * their own copy of it: the keyboard shortcut, the raised button on the phone
 * tab bar, and the "Add expense" button on each page. That meant the shortcut
 * and the button on screen next to it opened *different* dialogs that happened
 * to look alike - so a fix to one silently missed the other, and the badge on
 * the button could not honestly claim the key did the same thing.
 *
 * Now the shell puts one opener here and everything calls it. The button and
 * the key are the same action because they are the same function.
 *
 * `canCreate` exists because a shortcut must not fire where the action is not
 * available. There is no role system in this app - every signed-in student can
 * log their own expense - so it reflects exactly that: true inside the signed-in
 * shell, false anywhere else (a page rendered on its own in a test, or an auth
 * screen). A shortcut that reaches for a dialog nothing is providing would
 * otherwise throw.
 */
const QuickAddContext = createContext(null);

export function QuickAddProvider({ open, children }) {
  // Stable identity, so a consumer using it in an effect's dependency list
  // does not re-subscribe on every render of the shell.
  const value = useMemo(() => ({ open, canCreate: typeof open === 'function' }), [open]);
  return <QuickAddContext.Provider value={value}>{children}</QuickAddContext.Provider>;
}

/** `{ open, canCreate }`. Safe to call outside the shell: open() does nothing. */
export default function useQuickAdd() {
  const context = useContext(QuickAddContext);
  return context || NOT_AVAILABLE;
}

const NOT_AVAILABLE = { open: () => {}, canCreate: false };
