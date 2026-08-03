# AGENTS.md — BOhub-front

> React SPA for BOhub. **Start here** before changing frontend code.

## Quick start

```bash
# API must be up on :8000
pnpm i
cp .env.example .env   # VITE_API_URL=http://localhost:8000
pnpm dev               # http://localhost:5173
```

Prod: `https://hub.bocode.es` · API: `https://api.hub.bocode.es`

## Stack

- React 19 + Vite + TypeScript
- Tailwind + **shadcn/ui** (Base UI button primitive OK)
- React Router
- Recharts via shadcn `chart` (Home pie + Timer Analytics)
- Tokens BOcode: `--primary #ccff00`, `--background #1a1d1e`, `--primary-foreground #24292a`
- Font: Rubik

## Layout (where things live)

```text
src/
  App.tsx                 # routes — read first
  auth/                   # AuthContext, RouteGuards
  components/
    ui/                   # shadcn primitives (button, card, table, chart…)
    layout/               # sidebar, AppLayout
    list-page-shell.tsx   # standard list page Card+toolbar
  lib/                    # API clients (one file per domain)
  pages/
    home/                 # dashboard home (reference UI)
    clients|projects|billing|timer|emails|maintenance/
  index.css               # design tokens
```

## Routes (all under `/dashboard`)

| Path                          | Page                                        |
| ----------------------------- | ------------------------------------------- |
| `/login`                      | Login                                       |
| `/dashboard`                  | Home (widgets + charts)                     |
| `/dashboard/clients`          | Clients CRUD                                |
| `/dashboard/projects`         | Projects list                               |
| `/dashboard/projects/:id`     | Project detail                              |
| `/dashboard/billing`          | Billing summary (quarter default)           |
| `/dashboard/billing/income`   | Payments                                    |
| `/dashboard/billing/expenses` | Expenses                                    |
| `/dashboard/timer`            | Live timer + Mis horas / Equipo / Analytics |
| `/dashboard/emails`           | Templates                                   |
| `/dashboard/emails/messages`  | Sent + scheduled (tabs)                     |
| `/dashboard/maintenance`      | Maintenance periods                         |

Legacy: `/app` → `/dashboard`.

Auth: Sanctum **SPA session cookie** (httpOnly) via `credentials: 'include'` + CSRF (`/sanctum/csrf-cookie`, `X-XSRF-TOKEN`) in `lib/api.ts`. No `bohub_token` / Bearer. After API cutover, users must re-login.

## UI conventions (agents must follow)

1. **List pages** → `ListPageShell` (icon + title + description + toolbar + table). Mirror Clients.
2. **Home** is the visual reference for cards/stats — don’t “fix” it into ListPageShell.
3. **Buttons**: PH-aligned CVA — default **h-9**, `rounded-md`, `hover:bg-primary/90`, solid destructive.
4. Table wrap: `rounded-md border`.
5. Tabs (billing/emails/timer): same chip style as EmailTabs.
6. Empty / loading / error states on every list.
7. Debounce search (~300ms) + **AbortSignal** on fetches.
8. No Emails “Configuración” UI — SMTP is backend `.env` only.
9. No campaigns UI.

## `lib/` API map

| File             | Domain                               |
| ---------------- | ------------------------------------ |
| `api.ts`         | `request()`, token, errors           |
| `clients.ts`     | clients CRUD                         |
| `projects.ts`    | projects + options cache             |
| `billing.ts`     | payments, expenses, summary          |
| `dashboard.ts`   | home aggregates                      |
| `timer.ts`       | hours, team hours, timers, analytics |
| `time.ts`        | month bounds, formatHours, colors    |
| `maintenance.ts` | maintenance periods                  |
| `emails.ts`      | templates, send, messages            |

Prefer extending these over new ad-hoc `fetch` calls.

## Feature notes

- **Billing**: external invoice fields are generic (not Odoo-branded). Summary default = current quarter.
- **Timer**: BOtimer-like live UX; Analytics = client-side month aggregation (lazy-loaded chunk).
- **Maintenance**: `monthly|annual`; contact = client fields, not free-text.
- **Emails**: `[VAR]` templates; messages single page with sent/scheduled tabs; attachments meta on sent, disk only while scheduled.

## Conventions for agents

1. Smallest diff; reuse shell + lib helpers.
2. Don’t add dependencies without need.
3. Keep TypeScript types next to lib functions.
4. After UI changes: `pnpm run build` (`strict` TS).
5. Ponytail: delete dead code; no drive-by refactors outside task.

## Deeper docs

- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)
- [`docs/UI.md`](./docs/UI.md)
- [`README.md`](./README.md)
