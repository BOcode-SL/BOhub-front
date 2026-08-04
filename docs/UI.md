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

## Emails

Only **Plantillas** + **Mensajes**. No settings tab (SMTP is server `.env`).
