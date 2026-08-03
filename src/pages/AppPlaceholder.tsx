import { useState } from 'react'
import { Zap } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function AppPlaceholder() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  async function onLogout() {
    setBusy(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-background px-4 py-10 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(45deg,var(--primary)_1px,transparent_1px),linear-gradient(-45deg,var(--primary)_1px,transparent_1px)] bg-size-[30px_30px] opacity-[0.03]"
      />

      <header className="relative z-10 mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
            <Zap className="size-5 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-primary">BOhub</h1>
            <p className="text-xs font-medium text-muted-foreground">by BOcode</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={busy}
          className="cursor-pointer rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? 'Saliendo…' : 'Logout'}
        </button>
      </header>

      <section className="relative z-10 mx-auto mt-16 w-full max-w-3xl overflow-hidden rounded-xl border border-primary/10 bg-card/80 p-8 shadow-xl backdrop-blur-xl">
        <div
          aria-hidden
          className="absolute top-0 right-0 left-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent"
        />
        <h2 className="text-xl font-semibold text-foreground">
          BOhub — dashboard (PASO 04)
        </h2>
        <p className="mt-2 text-muted-foreground">
          Placeholder. El shell con sidebar shadcn llega en el siguiente paso.
        </p>
        {user && (
          <dl className="mt-6 grid gap-2 text-sm text-muted-foreground">
            <div>
              <dt className="inline font-medium text-foreground">Usuario: </dt>
              <dd className="inline">{user.name}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Email: </dt>
              <dd className="inline">{user.email}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-foreground">Rol: </dt>
              <dd className="inline">{user.role}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  )
}
