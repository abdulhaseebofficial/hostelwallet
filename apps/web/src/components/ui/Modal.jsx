import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/format';

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Tabbable elements currently visible inside the panel, in DOM order. */
const focusableIn = (panel) =>
  panel ? Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.offsetParent !== null) : [];

/**
 * Accessible dialog: closes on Escape and on backdrop click, locks background
 * scrolling, and renders through a portal so it is never clipped by a parent
 * with `overflow: hidden`.
 *
 * Focus is TRAPPED inside while it is open and handed back to whatever opened
 * it on close. Without that, Tab walks straight out of the dialog into the
 * page behind it, which leaves a keyboard or screen-reader user editing a form
 * they can no longer see.
 */
export default function Modal({ open, onClose, title, subtitle, children, footer, size = 'md' }) {
  const panelRef = useRef(null);
  const openerRef = useRef(null);
  const titleId = useId();

  // Callers pass `onClose` as an inline arrow, so its identity changes on every
  // parent render. Reading it through a ref keeps both effects keyed on `open`
  // alone - otherwise a re-render would tear down the focus effect mid-edit and
  // its cleanup would yank focus back to the button that opened the dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Focus in on open, back out on close.
  useEffect(() => {
    if (!open) return undefined;

    openerRef.current = document.activeElement;
    const panel = panelRef.current;

    // A field with autoFocus has already claimed focus by now; leave it there.
    // Otherwise take the first control that is not the close button, so a form
    // dialog opens on its first input and a confirm dialog opens on Cancel.
    if (panel && !panel.contains(document.activeElement)) {
      const target = focusableIn(panel).find((el) => !el.hasAttribute('data-modal-close'));
      (target || panel).focus();
    }

    return () => {
      const opener = openerRef.current;
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus();
      }
    };
  }, [open]);

  // Escape to close, Tab wrapped inside, background scroll locked.
  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusableIn(panelRef.current);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];

      // Wrap at both ends instead of escaping to the page behind.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 animate-fade-in bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full animate-slide-up overflow-hidden rounded-t-2xl bg-canvas-card shadow-lift sm:rounded-2xl',
          'dark:bg-slate-900 dark:ring-1 dark:ring-slate-800',
          SIZES[size]
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-modal-close=""
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-100/60 px-5 py-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
