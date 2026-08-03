# BOhub-front

SPA React + Vite + TypeScript de BOhub.

- Dev: `http://localhost:5173`
- Prod: `https://hub.bocode.es` (deploy Hostinger — no en este paso)
- API: `VITE_API_URL` → `http://localhost:8000`

Tailwind CSS v4 listo. **shadcn/ui en paso 04.**

## Arranque

```bash
pnpm i
cp .env.example .env   # si aún no existe
pnpm dev
```

Abre `http://localhost:5173`. El botón “Check API health” llama a `GET ${VITE_API_URL}/api/health`.
