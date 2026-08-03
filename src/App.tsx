import { useState } from 'react'

type HealthResponse = {
  ok?: boolean
  service?: string
  db?: string
  db_message?: string
}

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function App() {
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function checkHealth() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch(`${apiUrl}/api/health`)
      const data: HealthResponse = await res.json()
      setResult(JSON.stringify(data, null, 2))
      if (!res.ok) {
        setError(`HTTP ${res.status}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-6 px-6 py-16">
      <div>
        <h1 className="text-4xl font-semibold tracking-tight text-stone-900">
          BOhub
        </h1>
        <p className="mt-2 text-stone-600">
          Scaffold — comprueba la API y CORS contra el health endpoint.
        </p>
      </div>

      <button
        type="button"
        onClick={checkHealth}
        disabled={loading}
        className="w-fit rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Checking…' : 'Check API health'}
      </button>

      <p className="text-xs text-stone-500">
        GET {apiUrl}/api/health
      </p>

      {error && (
        <pre className="overflow-auto rounded-md bg-red-50 p-4 text-sm text-red-800">
          error: {error}
        </pre>
      )}

      {result && (
        <pre className="overflow-auto rounded-md bg-stone-900 p-4 text-sm text-stone-100">
          {result}
        </pre>
      )}
    </main>
  )
}

export default App
