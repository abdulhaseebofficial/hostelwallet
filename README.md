# HostelWallet

**Smart financial manager for university hostel students.**

Track every rupee, set savings goals you actually hit, and get money advice written
for hostel life in Pakistan — mess bills, canteen chai, shared rickshaws and mobile load — not
for someone with a salary and a mortgage.

Built as a full-stack MERN application with an AI advisor powered by the Claude API.

---

## Why this exists

A hostel student in Pakistan gets a small, fixed amount of pocket money each month. It
disappears into dozens of tiny transactions that nobody writes down, and by the 20th
the money is gone with no idea where it went. Generic budgeting apps assume a salary,
rent, and investments. HostelWallet assumes Rs 25,000 a month, a mess bill, and a
dhaba outside the gate that never closes.

---

## Features

### Money in, money out
- **Expenses** — amount, category, description, payment method (Cash / JazzCash /
  Easypaisa / Bank Transfer / Card / Raast), date
- **Recurring expenses** — the mess bill or hostel fee is entered once and added
  automatically every month
- **Custom categories** on top of the nine built-in ones
- **Search and filter** by text, date range, category, payment method and amount,
  with pagination and a live total for whatever is filtered
- **Income tracking** — pocket money, part-time work, scholarships

### Goals and budgets
- **Savings goals** with a progress bar, an optional deadline, and an automatic
  "save ₹X per day / ₹Y per week to make it" calculation
- Add money to a goal or take it back out; every movement is kept as a ledger entry
- A **completion celebration** state when a goal is funded
- **Per-category monthly budgets** with green / amber / red status
- **Overspending alerts** the moment a category crosses its limit

### Dashboard and reports
- Money left this month, income, total spent, and a safe-daily-spend figure
- Donut chart of spending by category, area chart of daily spending with the
  monthly average marked
- This month vs last month, category by category, with a table view
- Monthly report, exportable as **PDF or CSV**

### The AI advisor (the flagship)
Powered by the Claude API through a backend-only service — the API key never
reaches the browser.

- **Chat** — ask "How can I save more this month?" and get an answer grounded in
  your real numbers, with conversation history that survives a refresh
- **Monthly advice** — 3–5 specific, costed tips returned as structured JSON, so
  they render as a proper checklist instead of a wall of text
- **Tip of the day** on the dashboard, cached per student per day
- **Suggested budget** — a per-category plan built from what you actually spend,
  applied to your real budgets with one click
- **Weekly wrap-up** — what you spent most on, what went well, and a small
  challenge for next week
- **Graceful degradation** — with no `ANTHROPIC_API_KEY`, a built-in rule-based
  advisor answers instead and the response is flagged `aiPowered: false`. Nothing
  in the app breaks.

### Feedback
- **Send feedback** from the profile menu or the footer: an optional 1-5 rating,
  a category (bug / feature request / design / praise) and a message
- The note is stored first and e-mailed to the developer second, so nothing is
  lost when SMTP is not configured
- The page the student was on is attached automatically, so a bug report
  arrives with context
- Direct **LinkedIn** and **e-mail** links for anything too long for a form

### Everything else
- JWT auth with access + refresh tokens, silent refresh, bcrypt password hashing
- Forgot-password flow (emails the link, or logs it when SMTP is not configured)
- First-run onboarding wizard
- In-app notification tray: overspending, bills due, goal deadlines, log reminders
- Light / dark / system theme
- Full data export (JSON) and account deletion
- Mobile-first responsive layout with a bottom tab bar on phones

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 (Vite), Tailwind CSS, React Router, Recharts, Axios, React Hook Form + Zod, React Hot Toast, lucide-react |
| Backend | Node.js, Express, JWT (access + refresh), bcryptjs, express-validator, Helmet, CORS, morgan, express-rate-limit |
| Database | Postgres (Neon), queried with `pg` and parameterised SQL |
| AI | Claude API via `@anthropic-ai/sdk`, server-side only, with an automatic model fallback chain |
| Jobs | node-cron for recurring expenses and daily alert checks |
| Export | pdfkit (PDF) and a hand-rolled CSV writer |

> `bcryptjs` is used instead of `bcrypt` — it is a drop-in pure-JS replacement that
> needs no native build toolchain, which matters on Windows and on free-tier hosts.

---

## Getting started

### Prerequisites
- Node.js 18 or newer
- A Postgres database. The quickest route is [Neon](https://neon.tech) via the
  Vercel Marketplace (`vercel integration add neon`), which provisions one and
  sets `DATABASE_URL` for you; any Postgres 14+ will do
- Optional: an [Anthropic API key](https://console.anthropic.com/settings/keys)
  for the AI advisor

### 1. Install

```bash
git clone <your-repo-url> hostelwallet
cd hostelwallet
npm run install:all      # installs both backend and frontend
```

### 2. Configure the backend

```bash
cp apps/api/.env.example apps/api/.env
```

Then edit `backend/.env`:

```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# Generate real secrets: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...

# Optional. Without it the app falls back to the built-in advisor.
ANTHROPIC_API_KEY=sk-ant-...

# Preferred model. If your key cannot reach it, the backend automatically tries
# claude-sonnet-5, then claude-haiku-4-5, then the built-in advisor.
AI_MODEL=claude-opus-5
```

### 3. Configure the frontend

```bash
cp apps/web/.env.example apps/web/.env
```

The default `VITE_API_URL=/api` is correct for local development — Vite proxies
`/api` to `http://localhost:5000`, so the browser sees a single origin and the
httpOnly refresh cookie works with no CORS setup at all.

### 4. Run

```bash
npm run dev              # starts the API on :5000 and the web app on :5173
```

Or separately:

```bash
npm run dev:api
npm run dev:web
```

Open <http://localhost:5173>.

### 5. Optional — load demo data

```bash
npm run seed
```

This creates a demo student with two months of realistic hostel spending, three
goals and a full set of budgets:

```
email:    demo@hostelwallet.app
password: demo1234
```

The login screen has a **Try the demo account** button that fills these in.

---

## Testing

```bash
npm run dev      # the API must be running and DATABASE_URL set
npm run qa       # 102 checks against the live stack
```

Two dependency-free suites — Node 18's built-in `fetch` is all they need, so
they run on a fresh clone.

| Suite | Covers |
|---|---|
| `tests/api.test.js` | 58 checks: every resource end to end, the auth edges, and the authorisation boundary between two students |
| `tests/settings.test.js` | 44 checks: every Settings control, including the destructive ones |

They exercise the failure paths as well as the happy ones — a negative amount,
a tampered token, a malformed e-mail, a category still in use — and assert the
arithmetic, not just the status code (`income − spent = remaining`).

The authorisation block is the one worth keeping: it registers a second student
and proves the first one's expenses, edits and goals are all invisible to them.

Anything destructive (changing a password, deleting an account) runs against a
throwaway account created for the run, so the seeded demo data survives. The
suites exit non-zero on failure, so CI can gate on them.

> If the auth rate limiter ever trips, the suite says so and stops rather than
> reporting fifty cascading failures. Limits are relaxed outside production, so
> repeated local runs are fine.

---

## Data models

**User** — `name, email, password, monthlyIncome, currency, university, hostelName,
customCategories[], theme, onboardingCompleted, tokenVersion, createdAt`

**Expense** — `userId, amount, category, description, paymentMethod, date,
isRecurring, recurringFrequency, nextRunAt, generatedFrom, createdAt`

**Income** — `userId, amount, source, note, date`

**Goal** — `userId, title, targetAmount, savedAmount, deadline, icon, note,
isCompleted, completedAt, contributions[], createdAt`

**Budget** — `userId, category, limit, month, year` *(unique per user + category + month)*

**Notification** — `userId, type, title, message, isRead, meta, dedupeKey`

**ChatMessage** — `userId, role, content` *(the AI advisor conversation)*

**Feedback** — `userId, type, rating, message, page, emailed, createdAt`

### One deliberate design decision

`user.monthlyIncome` is the **planned** pocket money; the `Income` collection is
what **actually arrived**. If anything is logged for a month the logged figure is
used for "money left"; otherwise it falls back to the plan. Both values are always
returned so the UI can show either — this avoids double-counting the same money.

---

## API reference

All routes are prefixed with `/api`. Everything except auth and the two public
utility routes requires `Authorization: Bearer <accessToken>`.

### Auth
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an account, returns tokens |
| POST | `/auth/login` | Log in |
| POST | `/auth/refresh` | New access token from the httpOnly cookie |
| POST | `/auth/logout` | Clear the refresh cookie |
| GET | `/auth/me` | The signed-in student |
| POST | `/auth/forgot-password` | Send a reset link |
| POST | `/auth/reset-password/:token` | Set a new password |
| PUT | `/auth/change-password` | Change it while signed in |

### Profile
| Method | Endpoint | Purpose |
|---|---|---|
| PUT | `/profile` | Update name, income, currency, university, hostel |
| POST | `/profile/onboarding` | Finish the first-run wizard |
| GET / POST | `/profile/categories` | List / add a custom category |
| DELETE | `/profile/categories/:name` | Remove a custom category |
| GET | `/profile/export` | Download everything as JSON |
| DELETE | `/profile` | Delete the account and all data |

### Expenses, income, goals, budget
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/expenses` | Filter + paginate (`from`, `to`, `category`, `paymentMethod`, `minAmount`, `maxAmount`, `search`, `page`, `limit`, `sortBy`, `order`) |
| POST / PUT / DELETE | `/expenses[/:id]` | Create, update, delete |
| GET / POST | `/income` | List / add income |
| GET | `/income/summary` | This month by source |
| PUT / DELETE | `/income/:id` | Update, delete |
| GET / POST | `/goals` | List / create |
| PUT / DELETE | `/goals/:id` | Update, delete |
| PATCH | `/goals/:id/add` | Add money (negative amount withdraws) |
| GET / POST | `/budget` | List with real spend / set one limit |
| POST | `/budget/bulk` | Save a whole plan at once |
| PUT / DELETE | `/budget/:id` | Update, remove |

### Dashboard, reports, notifications
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard/summary` | Everything the home screen renders, in one call |
| GET | `/reports/monthly` | Full month report with month-on-month comparison |
| GET | `/reports/export` | `?format=csv\|pdf` |
| GET | `/notifications` | Tray contents + unread count |
| POST | `/notifications/check` | Re-run the alert rules |
| PATCH | `/notifications/:id/read`, `/notifications/read-all` | Mark read |
| DELETE | `/notifications/:id`, `/notifications` | Remove one / clear all |

### Feedback
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/feedback/meta` | Feedback types and how to reach the developer |
| GET | `/feedback/mine` | What this student has already sent |
| POST | `/feedback` | Send feedback *(10 per hour per user)* |

### AI
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/ai/status` | Is a Claude key configured? |
| POST | `/ai/advice` | Structured tips for the month |
| POST | `/ai/chat` | Conversational Q&A with spending context |
| GET | `/ai/chat/history` · DELETE `/ai/chat` | Read / clear the conversation |
| GET | `/ai/tip` | One short tip, cached per day |
| POST | `/ai/suggest-budget` | A per-category plan as JSON |
| GET | `/ai/weekly-summary` | Last 7 days wrap-up |

### Utility
`GET /api/health` · `GET /api/meta` (categories, payment methods, currencies)

**Response shape.** Success: `{ success: true, message?, data }`.
Failure: `{ success: false, message, errors? }` where `errors` is a
`[{ field, message }]` list the frontend maps back onto form inputs.

---

## How the AI integration works

Everything lives in `backend/services/aiService.js` — it is the only file in the
project that talks to Anthropic.

1. `analyticsService.buildSnapshot()` produces one canonical object describing the
   student's month: income, spend, per-category breakdown, budgets with their
   status, active goals, days left, daily average. The dashboard, the reports page
   and the AI all read from this same snapshot, so **a number on screen is always
   the number the AI reasoned about**.
2. `snapshotToText()` renders it as a compact, deterministic block of plain text.
3. A stable system prompt establishes the persona — a warm, specific, never
   judgemental money coach who understands the hostel mess bill, mess rebates and
   splitting a rickshaw three ways. Keeping this text byte-stable across requests is
   what makes the prompt prefix cacheable.
4. Structured endpoints (`/advice`, `/suggest-budget`) request
   `output_config.format` with a JSON schema, so the frontend receives predictable
   objects instead of prose it would have to parse.
5. Every call walks a **model chain** before giving up. The configured `AI_MODEL`
   is tried first; if this key cannot reach it (wrong tier, retired model, typo)
   the backend moves on to `claude-sonnet-5`, then `claude-haiku-4-5`. The first
   model that answers is pinned for the life of the process, so a dead first
   choice is not re-tried on every request. Requests are also reshaped per model:
   `output_config.effort` is stripped for models that reject it, and a model that
   refuses structured output is retried with a plain "reply with raw JSON"
   instruction. **The result: the advisor works on any Anthropic key, not just a
   top-tier one.**
6. Only model-availability failures advance the chain. A rate limit or a network
   error is *not* a model problem, so it drops straight through rather than
   burning a request against every model.
7. If nothing answers, `withFallback()` hands over to a deterministic rule-based
   advisor and tags the payload `aiPowered: false`. The UI shows an honest
   "offline mode" badge. **The app never shows an error because of the AI.**

`GET /api/ai/status` reports which model is actually answering plus the whole
chain, so the Advisor page can name the model in its subtitle.

Cost control: `/ai/*` is rate limited to 30 requests per hour per user, and the tip
of the day is cached in memory per user per day.

The system prompt, abbreviated:

> You are HostelWallet, a warm and practical money coach for a university student
> living in a hostel. […] Be specific and numeric — refer to their real categories
> and real amounts, never generic filler like "make a budget". Every tip must be
> something they could do this week without a job, a credit card, or investing
> knowledge. Saving 200 or 500 a month is a genuine win for this student, so treat
> it as one. Never shame them for spending. Never invent transactions that were not
> in the data you were given. Keep it short — students skim.

---

## Charts and colour

The nine category colours are a **validated categorical palette**, not a set of
picks that looked nice:

- every adjacent pair clears colour-vision-deficiency and normal-vision separation
  thresholds in **both** light and dark mode, measured against this app's actual
  surfaces (warm paper and warm charcoal);
- the ninth slot (Personal Care) was added later and the whole set re-validated;
  it introduces no new worst pair in either mode;
- light and dark are two *selected* steppings of the same eight hues, not an
  automatic flip;
- a colour belongs to a **category**, never to a rank, so filtering or re-sorting
  never repaints the survivors;
- the donut draws slices in fixed category order — so the pairs that touch on
  screen are exactly the pairs that were validated — with a 2px surface gap between
  fills;
- every chart ships a legend with real values, so identity is never carried by
  colour alone, and the comparison chart has a table view;
- budget traffic lights are a separate *status* palette and always appear with an
  icon and a text label.

---

## Deployment

### Both halves on Vercel (recommended)

`vercel.json` in the repo root declares the two services and routes between
them, which is what Vercel means by *"vercel.json required to deploy projects
with multiple services"*:

```
/api/*  ->  backend service   (Express)
/*      ->  frontend service  (Vite SPA)
```

Because both are served from **one origin**, no `VITE_API_URL` is needed — the
client already defaults to `/api` — and the httpOnly refresh cookie works with
no cross-site cookie configuration at all.

Set these in **Vercel → Settings → Environment Variables**, scoped to the
`backend` service:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Postgres connection string. **Skip this** if you add Neon from the Vercel Marketplace - it provisions a free database and sets `DATABASE_URL` itself |
| `JWT_ACCESS_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | Same command again — it must **differ** from the access secret |
| `NODE_ENV` | `production` |
| `CLIENT_URL` | Your deployment URL, e.g. `https://hostelwallet.vercel.app` |
| `ANTHROPIC_API_KEY` | Optional; without it the built-in advisor answers |

The API refuses to boot on a missing or weak signing key, so a deploy that
fails at start-up with *"Refusing to start, the configuration is unsafe"* is
telling you one of the three required variables above is not set.

> **The cron jobs are the one caveat.** Recurring expenses and the daily alert
> sweep are scheduled in-process with `node-cron`, which needs a process that
> is always awake. On a service that sleeps when idle they will not fire
> reliably. The data is never wrong as a result — a recurring expense is
> created when the job next runs — but if you need them punctual, drive
> `POST /api/notifications/check` from an external scheduler instead.

### Split across two hosts

**Frontend → Vercel or Netlify**
- Build command `npm run build`, output directory `dist`, root `frontend`
- Set `VITE_API_URL` to the deployed API URL, e.g.
  `https://hostelwallet-api.onrender.com/api`
- Add a SPA rewrite so deep links work: `/* → /index.html`

**Backend → Render or Railway**
- Root `backend`, build `npm install`, start `npm start`
- Set every variable from `backend/.env.example`
- Set `CLIENT_URL` to the deployed frontend origin (comma-separate several)
- `NODE_ENV=production` — this switches the refresh cookie to
  `secure: true; sameSite: none` so it survives the cross-site hop

**Database → Neon (or any Postgres)**
- On Vercel, `vercel integration add neon` provisions one and sets
  `DATABASE_URL` for you. Elsewhere, create a database and paste its connection
  string into `DATABASE_URL` - the schema is applied automatically on first
  connect, or run `npm run migrate --prefix backend` yourself

---

## Screenshots

> Captured from the running app against the seeded demo account.

### Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Logging an expense on a phone
The raised button in the middle of the tab bar opens the same dialog from any
screen. Amounts are chips that add up on repeat taps, and categories are one
tap rather than a dropdown.

| Mobile dashboard | Quick add |
|---|---|
| ![Mobile dashboard](docs/screenshots/mobile-dashboard.png) | ![Quick add](docs/screenshots/mobile-quick-add.png) |

### Expenses, with filters
![Expenses](docs/screenshots/expenses.png)

### Savings goals
![Savings goals](docs/screenshots/goals.png)

### Budget
![Budget](docs/screenshots/budget.png)

### AI advisor
![AI advisor](docs/screenshots/advisor.png)

### Monthly report
![Monthly report](docs/screenshots/reports.png)

### Dark mode
![Dark mode](docs/screenshots/dark-mode.png)

---

## Future scope

- **Bill split with roommates** — one expense, several payers, running balances
- **Voice input** — say "two hundred on chai" and have it logged
- **JazzCash / Easypaisa / bank auto-sync** so expenses do not have to be typed at all
- **Gamified savings streaks** — badges for a week without an outing
- **Multi-language** — Urdu, Punjabi, Pashto, Sindhi
- **React Native app** with a home-screen widget for one-tap logging
- **Group challenges** between hostel friends
- **Push notifications** instead of an in-app tray only

---

## Security notes

- Passwords hashed with bcrypt (12 salt rounds) and never returned by any query
- Access tokens are short-lived; the refresh token lives in an httpOnly cookie
  that JavaScript cannot read, and is rotated on every use
- `tokenVersion` is bumped on password change and reset, invalidating every
  existing session
- Login answers identically for an unknown email and a wrong password, so the
  endpoint cannot be used to discover which emails are registered
- Rate limits on auth (20 per 15 min per IP) and AI (30 per hour per user)
- Every query is scoped by `userId` — one student can never read another's data
- Helmet security headers, an explicit CORS allowlist, and validation on both
  the client and the server
- The Anthropic API key exists only on the server and is never sent to the browser

---

## License

[MIT](LICENSE) — use it, learn from it, submit it, ship it.
