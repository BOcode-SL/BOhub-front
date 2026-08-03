# BOhub-front

SPA React + Vite + TypeScript de BOhub.

- Dev: `http://localhost:5173`
- Prod: `https://hub.bocode.es` (deploy Hostinger — no en este paso)
- API: `VITE_API_URL` → `http://localhost:8000`

Tokens BOcode (dark + lime). shadcn sidebar shell. UI UX Pro Max solo layout/UX.

## Arranque

```bash
# back
cd ../BOhub-back && php artisan serve

# front
pnpm i && pnpm dev
```

## Auth

Token: `localStorage` → `bohub_token`

| Ruta | Acceso |
| --- | --- |
| `/login` | público |
| `/dashboard` | Inicio (Home) |
| `/dashboard/clients` | Clientes (CRUD) |
| `/dashboard/projects` | Proyectos |
| `/dashboard/billing` | Facturación |
| `/dashboard/timer` | Timer |
| `/dashboard/emails` | Emails |
| `/dashboard/maintenance` | Mantenimientos |

Redirect legacy: `/app` y `/app/*` → `/dashboard/*`.

Logout desde el menú de usuario del sidebar.
