import { useEffect, useRef, useState } from 'react';

const GSI_SRC = 'https://accounts.google.com/gsi/client';

/**
 * Loads Google's sign-in script once, however many components ask for it.
 *
 * Both the login and the sign-up screen render this button, and a student who
 * moves between them would otherwise add a second copy of the script. The
 * promise is cached at module scope so the second caller waits on the first
 * rather than starting again.
 */
let loading = null;
const loadGoogleScript = () => {
  if (window.google && window.google.accounts) return Promise.resolve();

  // The "only once" guarantee is the tag in the document, not the variable:
  // after a hot reload the module is new but the script is still there, and
  // adding a second copy would re-register Google's callbacks.
  if (document.querySelector(`script[src="${GSI_SRC}"]`)) return loading || Promise.resolve();

  loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => {
      // Reset, so a later attempt on a better connection can try again.
      loading = null;
      reject(new Error('Google sign-in could not be loaded'));
    };
    document.head.appendChild(script);
  });

  return loading;
};

/**
 * "Continue with Google", rendered by Google itself.
 *
 * Google's own button is used rather than a hand-drawn one: it carries the
 * branding Google requires, it translates itself, and it is the piece that
 * actually holds the credential flow. What this component owns is everything
 * around it - deciding whether to appear at all, loading the script once, and
 * handing the resulting token to `onCredential`.
 *
 * The button only appears when the API says Google sign-in is configured. That
 * answer comes from the server rather than a build-time variable, so there is
 * one place to switch this on and no way for the two halves to disagree about
 * which client id is in use.
 *
 * Nothing here decides who anybody is. The ID token Google returns is opaque to
 * this component; it is verified against Google's public keys on the server,
 * which is the only place that verdict can safely be reached.
 */
export default function GoogleSignInButton({ config, onCredential, disabled = false }) {
  const holder = useRef(null);
  const [failed, setFailed] = useState(false);

  // Google calls back with the credential; keep the latest handler without
  // re-rendering the button, which would make it flicker on every keystroke
  // in the form beside it.
  const handler = useRef(onCredential);
  handler.current = onCredential;

  useEffect(() => {
    if (!config || !config.enabled || !holder.current) return undefined;

    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;

        window.google.accounts.id.initialize({
          client_id: config.clientId,
          callback: (response) => handler.current(response.credential),
          // The student picked this button deliberately; One Tap on top of it
          // would be a second prompt for the same decision.
          cancel_on_tap_outside: true,
        });

        window.google.accounts.id.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'pill',
          logo_alignment: 'left',
          width: holder.current.offsetWidth || 320,
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [config]);

  // Not configured on this deployment: render nothing at all rather than a
  // button that cannot work.
  if (!config || !config.enabled) return null;

  if (failed) {
    return (
      <p className="text-center text-xs text-slate-500 dark:text-slate-400">
        Google sign-in could not load. Use your email and password below.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={holder}
        className={disabled ? 'pointer-events-none opacity-60' : undefined}
        // Google renders its own accessible button inside; this is only the slot.
        aria-busy={disabled}
      />

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
          or
        </span>
        <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
    </div>
  );
}
