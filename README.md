# BOhub-front

SPA React + Vite + TypeScript de BOhub.

- Dev: `http://localhost:5173`
- Prod: `https://hub.bocode.es` (deploy Hostinger — no en este paso)
- API: `VITE_API_URL` → `http://localhost:8000`

Tailwind CSS v4 + **UI UX Pro Max** (login). **shadcn/ui shell en paso 04.**

## Arranque

Back (otro terminal):

```bash
cd ../BOhub-back
php artisan serve
# founders: php artisan bohub:seed-founders
```

Front:

```bash
pnpm i
cp .env.example .env   # si aún no existe
pnpm dev
```

Abre `http://localhost:5173` → redirige a `/login` (o `/app` si hay sesión).

## Auth

1. En `/login`, entra con un founder (`FOUNDER_*` del back).
2. Token Sanctum en `localStorage` key **`bohub_token`**.
3. Rutas protegidas llaman `GET /api/auth/me` al cargar.
4. **Logout** limpia token y vuelve a `/login`.

| Ruta | Acceso |
| --- | --- |
| `/login` | público |
| `/app` | autenticado (placeholder dashboard) |
| `/` | → `/app` |
