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

`GET /api/dashboard/home` — SQL aggregates (counts, status slices, deadlines, month hours + top projects).  
`useHomeDashboard` does a single request; no client-side `fetchAllPages`.

## Timer Analytics

Lazy `import('./TimerAnalytics')` so recharts stays off Mis horas path.  
`GET /api/hours/analytics?year=&month=` returns day×project buckets.

## Path aliases

`@/` → `src/` (Vite).
