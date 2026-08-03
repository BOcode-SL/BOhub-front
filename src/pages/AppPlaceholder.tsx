import { useState } from 'react'
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
    <main className="flex min-h-screen flex-col bg-surface px-4 py-10 sm:px-6 lg:px-8">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium tracking-[0.18em] text-cta uppercase">
            Bocode
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">
            BOhub
          </h1>
        </div>
        <button
          type="button"
          onClick={() => void onLogout()}
          disabled={busy}
          className="cursor-pointer border border-line bg-white px-4 py-2 text-sm font-medium text-ink transition-colors duration-200 hover:border-ink/30 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? 'Saliendo…' : 'Logout'}
        </button>
      </header>

      <section className="mx-auto mt-16 w-full max-w-3xl border border-line bg-white p-8">
        <h2 className="text-xl font-semibold text-ink">
          BOhub — dashboard (PASO 04)
        </h2>
        <p className="mt-2 text-ink-muted">
          Placeholder. El shell con sidebar shadcn llega en el siguiente paso.
        </p>
        {user && (
          <dl className="mt-6 grid gap-2 text-sm text-ink-muted">
            <div>
              <dt className="inline font-medium text-ink">Usuario: </dt>
              <dd className="inline">{user.name}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">Email: </dt>
              <dd className="inline">{user.email}</dd>
            </div>
            <div>
              <dt className="inline font-medium text-ink">Rol: </dt>
              <dd className="inline">{user.role}</dd>
            </div>
          </dl>
        )}
      </section>
    </main>
  )
}
