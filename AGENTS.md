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
    clients|projects|billing|timer|emails|contracts|sign|maintenance|users/
  index.css               # design tokens
```

## Routes (all under `/dashboard`)

| Path                          | Page                                        | Roles           |
| ----------------------------- | ------------------------------------------- | --------------- |
| `/login`                      | Login                                       | public          |
| `/sign/:token`                | Firma SES (sin login, sin CSRF)             | public          |
| `/dashboard`                  | Home (widgets + charts)                     | admin, employee |
| `/dashboard/clients`          | Clients CRUD                                | admin, employee |
| `/dashboard/projects`         | Projects list                               | admin, employee |
| `/dashboard/projects/:id`     | Project detail (Resumen/Config; Horas+Pagos = admin) | admin, employee |
| `/dashboard/billing`          | Billing summary (quarter default) + KPIs + chart | admin, billing  |
| `/dashboard/billing/income`   | Payments (admin+billing mutate). Installments. | admin, billing  |
| `/dashboard/billing/expenses` | Expenses (admin+billing mutate). Installments. | admin, billing  |
| `/dashboard/billing/payrolls` | Payrolls (admin+billing mutate)            | admin, billing  |
| `/dashboard/billing/settings` | Emisor/IBAN + numeración factura (`numberPrefix`/`nextSequence`) | admin, billing  |
| `/dashboard/timer`            | Live timer + Mis horas / Equipo / Analytics | admin, employee |
| `/dashboard/emails`           | Templates                                   | admin           |
| `/dashboard/emails/messages`  | Sent + scheduled (tabs)                     | admin           |
| `/dashboard/contracts`        | Contratos SES lista                         | admin           |
| `/dashboard/contracts/settings` | Plantilla email solicitud de firma        | admin           |
| `/dashboard/contracts/:id`    | Wizard / detalle sobre (PDFs, firmantes, campos) | admin      |
| `/dashboard/users`            | Users CRUD                                  | admin           |
| `/dashboard/maintenance`      | Maintenance periods                         | admin, employee |

Legacy: `/app` → `/dashboard`. Post-login: `billing` → `/dashboard/billing`; resto → `/dashboard`.

Roles: `admin` | `employee` | `billing`.

Auth: Sanctum **SPA session cookie** (httpOnly) via `credentials: 'include'` + CSRF (`/sanctum/csrf-cookie`, `X-XSRF-TOKEN`) in `lib/api.ts`. No `bohub_token` / Bearer. After API cutover, users must re-login.

## UI conventions (agents must follow)

1. **List pages** → `ListPageShell` (icon + title + description + toolbar + table). Mirror Clients.
2. **Home** is the visual reference for cards/stats — don’t “fix” it into ListPageShell.
3. **Buttons**: PH-aligned CVA — default **h-9**, `rounded-md`, `hover:bg-primary/90`, solid destructive.
4. Table wrap: `rounded-md border`.
5. Tabs (billing/emails/timer): same chip style as EmailTabs.
6. Empty / loading states on every list. **User feedback (API errors + mutation success)** → shadcn Base Toast via `lib/toast.ts` (`toastError` / `toastSuccess`). Do **not** use inline `role="alert"` banners for API feedback.
7. Debounce search (~300ms) + **AbortSignal** on fetches.
8. **Selects**: never native `<select>`. Short enums/filters → `AppSelect` / `ToolbarSelect`. Cliente/proyecto (searchable) → `EntitySelect` (Combobox).
9. No Emails “Configuración” UI — SMTP is backend `.env` only.
10. **Forms**: use `FormField` + `aria-invalid` on the control. Forms: **`noValidate`** (no browser bubble). On 422, `flattenFieldErrors(ApiError.fieldErrors)`; clear key on change. Toast via `toastError`. No Zod/RHF.

## `lib/` API map

| File             | Domain                               |
| ---------------- | ------------------------------------ |
| `api.ts`         | `request()`, CSRF, auth helpers, `ApiError.fieldErrors` |
| `toast.ts`       | `toastSuccess` / `toastError` (shadcn Base Toast) |
| `users.ts`       | users CRUD + role labels             |
| `clients.ts`     | clients CRUD                         |
| `projects.ts`    | projects, summary/sync, options cache |
| `jira.ts`        | Jira spaces/search/changelog (no token) |
| `billing.ts`     | payments, expenses, payrolls, summary, installments |
| `dashboard.ts`   | home aggregates                      |
| `timer.ts`       | hours, team hours, timers, analytics |
| `time.ts`        | month bounds, formatHours, colors    |
| `maintenance.ts` | maintenance periods                  |
| `emails.ts`      | templates, send, messages            |
| `contracts.ts`   | SES envelopes: CRUD, docs, signers, fields, send, email template |
| `contractSign.ts`| Público `/api/sign/*` (`credentials: 'omit'`) |

Prefer extending these over new ad-hoc `fetch` calls.

## Feature notes

- **Projects**: detail — employee: Resumen + Config; admin: + Horas + Pagos. Create requires Jira space + create|link. Sync on open + background batch on Home/list (60s throttle). Status/priority read-only when linked. `VITE_JIRA_BASE_URL` optional link fallback (no token).
- **Billing**: Summary shows expanded KPIs + monthly chart. Payments/Expenses support installments (method Select, paidOn, notes). Payments: multi-línea `lines` (qty + P.U. + % dto → base derived); IVA/IRPF a nivel factura. Emit → PDF R2; **Enviar al cliente** (`previewInvoiceSend` / `sendInvoice`, doble confirmación) aparte del emit. Lista ingresos: filtro **Factura** (`invoice_filter` = draft|issued|no_number), no status ledger. Sin UI `reference`. Clientes: campo **provincia** (emit/PDF). Configuración: emisor/IBAN/numeración + plantilla email factura (`getInvoiceEmailTemplate` / `updateInvoiceEmailTemplate`). Payrolls tab.
- **Timer**: BOtimer-like live UX; Analytics = client-side month aggregation (lazy-loaded chunk).
- **Maintenance**: `monthly|annual`; contact = client fields, not free-text.
- **Emails**: `[VAR]` templates; messages single page with sent/scheduled tabs; attachments meta on sent, disk only while scheduled. Plantilla de factura también editable desde Billing (billing role) sin abrir `/emails`.
- **Contracts (SES)**: admin only. Lista + detalle wizard (datos → PDFs → firmantes → editor pdfjs drag % top-left → enviar). Al crear, firmante BOcode (`BOCODE DEVELOPERS SL` / `hola@bocode.es`) va siempre. Plantilla email `/dashboard/contracts/settings`. Público `/sign/:token` (ruta fuera de `ProtectedRoute`; fetch sin cookie). Employee/billing no ven nav.

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
