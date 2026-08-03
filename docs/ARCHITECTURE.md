# Architecture — BOhub-front

## App shell

```text
BrowserRouter
  PublicOnlyRoute → /login
  ProtectedRoute → /dashboard (AppLayout)
    Sidebar + Outlet → pages/*
```

`AuthProvider` loads `me()` if `bohub_token` exists; 401 clears session.

## Data fetching pattern

```text
page useEffect
  → AbortController
  → lib/<domain>.ts list/get/create…
  → setState
  → cleanup abort
```

Lists: debounce search → reset page 1 → fetch.  
Pagination: URL `searchParams` where Clients/Projects/Billing already do (prefer same).

## Home data

`HomePage` `Promise.all` over existing APIs (projects, clients, hours, billing summary, maintenances).  
No `/api/home` endpoint.

## Timer Analytics

Lazy `import('./TimerAnalytics')` so recharts stays off Mis horas path.  
Aggregate hours for selected month in client (`lib/time.ts` helpers).

## Path aliases

`@/` → `src/` (Vite).
