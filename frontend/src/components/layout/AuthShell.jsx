import { PiggyBank, Sparkles, TrendingDown } from 'lucide-react';
import BrandMark from './BrandMark';

const HIGHLIGHTS = [
  { icon: PiggyBank, title: 'Know where it goes', text: 'Mess, chai, rickshaw, mobile load - every rupee in one place.' },
  { icon: Sparkles, title: 'AI money coach', text: 'Advice written for hostel life, from your own numbers.' },
  { icon: TrendingDown, title: 'Stop the leaks', text: 'Budgets warn you before the month runs out, not after.' },
];

/**
 * Split screen for the signed-out pages: the pitch on the left (desktop only),
 * the form on the right.
 */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-full">
      {/*
        The pitch is one block with the logo, not a third thing spread to the
        far corner: `justify-between` on three children left ~225px of dead
        panel above and below the pitch on a laptop screen. The logo now sits
        directly above the headline it belongs to, the small print keeps the
        bottom, and the slack collects in one place instead of two.
      */}
      {/* pb reserves the strip the absolutely-placed small print sits in, so the
          centred pitch cannot grow into it on a short laptop screen. */}
      <aside className="relative hidden w-1/2 flex-col justify-center bg-brand-600 p-10 pb-24 text-white lg:flex xl:p-14 xl:pb-28">
        <div className="max-w-lg">
          <BrandMark to="/" inverted className="mb-12" />

          <h1 className="text-3xl font-extrabold leading-[1.15] xl:text-4xl">
            Make your pocket money last the whole month.
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-brand-100">
            Built for hostel students in Pakistan, where the budget is small, the mess bill is fixed and the dhaba is
            always open.
          </p>

          <ul className="mt-10 space-y-5">
            {HIGHLIGHTS.map(({ icon: Icon, title: heading, text }) => (
              <li key={heading} className="flex gap-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{heading}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-brand-100">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="absolute inset-x-10 bottom-10 text-xs text-brand-100/90 xl:inset-x-14 xl:bottom-14">
          Your data stays yours. Export or delete everything from Settings, any time.
        </p>
      </aside>

      <main className="flex w-full flex-col justify-center px-5 py-12 sm:px-10 lg:w-1/2">
        <div className="mx-auto w-full max-w-[24rem]">
          <BrandMark to="/" className="mb-10 lg:hidden" />

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{subtitle}</p>}

          <div className="mt-8">{children}</div>

          {footer && (
            <div className="mt-7 text-center text-sm text-slate-600 dark:text-slate-400">{footer}</div>
          )}
        </div>
      </main>
    </div>
  );
}
