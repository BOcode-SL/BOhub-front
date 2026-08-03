import { useId, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const emailId = useId()
  const passwordId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      await login(email.trim(), password)
      navigate('/app', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401
            ? 'Credenciales inválidas. Revisa email y contraseña.'
            : err.message,
        )
      } else {
        setError('No se pudo iniciar sesión.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#E2E8F0_0%,_#F8FAFC_55%,_#F8FAFC_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            'linear-gradient(#CBD5E1 1px, transparent 1px), linear-gradient(90deg, #CBD5E1 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)',
        }}
      />

      <section className="relative w-full max-w-md">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium tracking-[0.18em] text-cta uppercase">
            Bocode
          </p>
          <h1 className="mt-3 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
            BOhub
          </h1>
          <p className="mt-3 text-base text-ink-muted">
            Acceso interno al hub de proyectos.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-5 border border-line bg-white p-6 sm:p-8"
          noValidate
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={emailId} className="text-sm font-medium text-ink">
              Email
            </label>
            <input
              id={emailId}
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-line bg-surface px-3 py-2.5 text-ink outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-cta focus:ring-2 focus:ring-cta/30"
              placeholder="tu@bocode.es"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={passwordId} className="text-sm font-medium text-ink">
              Contraseña
            </label>
            <input
              id={passwordId}
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="border border-line bg-surface px-3 py-2.5 text-ink outline-none transition-colors duration-200 placeholder:text-slate-400 focus:border-cta focus:ring-2 focus:ring-cta/30"
            />
          </div>

          {error && (
            <p role="alert" className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="cursor-pointer bg-cta px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cta-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </section>
    </main>
  )
}
