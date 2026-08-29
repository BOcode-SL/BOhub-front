# UI guide — BOhub-front

## Design tokens (`index.css`)

| Token                  | Value     | Use                       |
| ---------------------- | --------- | ------------------------- |
| `--primary`            | `#ccff00` | CTAs, accents, active nav |
| `--primary-foreground` | `#24292a` | text on primary           |
| `--background`         | `#1a1d1e` | page bg                   |
| `--card`               | `#24292a` | cards / sidebar surfaces  |
| `--border`             | `#3a3f41` | borders                   |
| `--muted-foreground`   | `#8a9199` | secondary text            |

Do **not** introduce purple gradients / generic AI themes.

## List pages

Use `ListPageShell`:

```tsx
<ListPageShell
    title="Clientes"
    description="…"
    icon={Users}
    above={optionalTabs}
    toolbar={
        <>
            search + filters + <Button>CTA</Button>
        </>
    }
>
    <div className="rounded-md border">…table…</div>
    {/* pagination */}
</ListPageShell>
```

Reference implementations: `pages/clients/ClientsPage.tsx`, `pages/projects/ProjectsPage.tsx`.

## Responsive

Agents must follow the same patterns on **every** list page (clients, projects, leads, billing ledgers, timer, emails, contracts, maintenance, website-analysis, users). See `AGENTS.md` § Responsive.

| Element | Mobile (`<640px`) | `sm+` |
| --- | --- | --- |
| Header CTA | `w-full` | `w-auto` |
| Toolbar | column stack | row + wrap |
| ToolbarSelect | `w-full` | `w-auto` |
| Table columns | 2–3 + ⋮ | progressive reveal |
| Pagination | stacked | row |

**Search:** `Input` uses `text-sm` (same visual weight as filter selects).

**Website Analysis list:** click **domain** or row → detail route; no dedicated “Ver detalles” column on mobile.

**Projects filters:** Estado full width; Fecha fin + Por página side-by-side 50/50 on mobile.

## Mobile navigation

Bottom bar **`md:hidden`**: 4 rutas primarias + **Menú** (panel flotante `MobileFloatingMenu`, no sidebar). Config en `lib/nav-config.ts`. Ver `AGENTS.md` § Mobile navigation.

| Rol | Tabs |
| --- | --- |
| admin / employee | Inicio, Clientes, Proyectos, Timer |
| billing | Resumen, Ingresos, Gastos, Nóminas |

## Form panels (Drawer vs Sheet)

Formularios CRUD usan **`FormPanel`** (`components/responsive-form-panel.tsx`):

- **Móvil (`<768px`):** Drawer desde abajo (`max-h-[92dvh]`, handle, swipe dismiss).
- **Desktop:** Sheet lateral derecho; conservar `contentClassName` (`sm:max-w-md`, `sm:max-w-2xl`, `sm:max-w-[1200px]`…).

Sidebar móvil (Sheet lateral) solo vía desktop collapse; en `<768px` el acceso secundario va al **menú flotante** de la bottom bar.

## Forms (invalid state)

Use `FormField` + control `aria-invalid`. Forms should use **`noValidate`** so the browser bubble does not replace FieldError. Laravel 422 → `ApiError.fieldErrors` → `flattenFieldErrors`; clear that key on change. No Zod/RHF.

```tsx
<FormField id="client-name" label="Nombre *" error={fieldErrors.name}>
  <Input id="client-name" aria-invalid={!!fieldErrors.name} … />
</FormField>
```

## Buttons

Aligned with ProjectHub CVA: default **h-9**, `rounded-md`, `hover:bg-primary/90`, solid destructive.

## Home

Special layout (stats + pie + deadlines + top hours). Treat as **canonical dashboard look** — don’t force ListPageShell here.

## Timer

- Live hero: large mono duration + controls (BOtimer spirit).
- Lists / Analytics: Card / ListPageShell consistent with rest of app.

## Feedback (toast)

User-facing API errors and mutation success use **shadcn Base Toast** (`components/ui/toast` + `lib/toast.ts`):

```ts
import { toastSuccess, toastError } from '@/lib/toast'

toastSuccess('Cliente creado')
toastError(err) // AbortError → no-op
toastError('Selecciona un proyecto.')
```

Mount `<Toaster />` once in `App.tsx`. Prefer toasts in parent `handleSave` / `handleDelete`. Do **not** add inline `role="alert"` banners for API feedback.

## Selects

Never use native `<select>`.

| Component | When |
| --- | --- |
| `AppSelect` | Short enums: status, role, type, priority, period, year, quarter, per_page, verifactu… |
| `ToolbarSelect` | Same as AppSelect + muted `FieldLabel` above (list toolbars) |
| `EntitySelect` | Cliente / proyecto (and similar): Combobox with search, SelectTrigger look |

```tsx
import { AppSelect } from '@/components/app-select'
import { EntitySelect } from '@/components/entity-select'
import { ToolbarSelect } from '@/components/toolbar-field'

const items = [
  { label: 'Todos', value: null },
  { label: 'Activo', value: 'active' },
]

<AppSelect items={items} value={status} onValueChange={setStatus} />
<EntitySelect value={clientId} onValueChange={setClientId} items={clients} allowClear placeholder="Todos" />
```

## Emails

Only **Plantillas** + **Mensajes**. No settings tab (SMTP is server `.env`).
