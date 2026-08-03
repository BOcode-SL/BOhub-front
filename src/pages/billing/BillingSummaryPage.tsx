import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  billingErrorMessage,
  currentQuarter,
  formatMoney,
  getBillingSummary,
  type BillingSummary,
} from '@/lib/billing'
import { BillingTabs } from '@/pages/billing/BillingTabs'

const selectClass =
  'h-9 cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

function parseYear(v: string | null): number {
  const n = Number(v)
  const y = new Date().getFullYear()
  return Number.isFinite(n) && n >= 2000 && n <= 2100 ? Math.floor(n) : y
}

function parseQuarter(
  v: string | null,
): 1 | 2 | 3 | 4 | 'all' {
  if (v === 'all') return 'all'
  const n = Number(v)
  if (n === 1 || n === 2 || n === 3 || n === 4) return n
  return currentQuarter()
}

export function BillingSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const urlHasPeriod =
    searchParams.has('year') && searchParams.has('quarter')
  const year = parseYear(searchParams.get('year'))
  const quarter = parseQuarter(searchParams.get('quarter'))

  const [summary, setSummary] = useState<BillingSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // one effect: seed URL defaults OR fetch (avoids double request)
  useEffect(() => {
    if (!urlHasPeriod) {
      setSearchParams(
        { year: String(year), quarter: String(quarter) },
        { replace: true },
      )
      return
    }

    const ac = new AbortController()
    let cancelled = false
    setLoading(true)
    setError(null)
    void getBillingSummary({ year, quarter }, ac.signal)
      .then((s) => {
        if (!cancelled) setSummary(s)
      })
      .catch((err) => {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(billingErrorMessage(err))
        setSummary(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [urlHasPeriod, year, quarter, setSearchParams])

  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

  function setPeriod(nextYear: number, nextQuarter: 1 | 2 | 3 | 4 | 'all') {
    setSearchParams({ year: String(nextYear), quarter: String(nextQuarter) })
  }

  const periodLabel =
    quarter === 'all' ? `Año ${year}` : `T${quarter} ${year}`

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Facturación
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ledger interno. Registra facturas creadas en tu app de facturación.
            Periodo: {periodLabel}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="cursor-pointer"
            render={<Link to="/app/billing/income" />}
          >
            Ingresos
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer"
            render={<Link to="/app/billing/expenses" />}
          >
            Gastos
          </Button>
        </div>
      </header>

      <BillingTabs />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Año
          <select
            value={year}
            onChange={(e) => setPeriod(Number(e.target.value), quarter)}
            className={selectClass}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Trimestre
          <select
            value={quarter === 'all' ? 'all' : String(quarter)}
            onChange={(e) => {
              const v = e.target.value
              setPeriod(
                year,
                v === 'all' ? 'all' : (Number(v) as 1 | 2 | 3 | 4),
              )
            }}
            className={selectClass}
          >
            <option value="1">T1</option>
            <option value="2">T2</option>
            <option value="3">T3</option>
            <option value="4">T4</option>
            <option value="all">Todo el año</option>
          </select>
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => setPeriod(new Date().getFullYear(), currentQuarter())}
        >
          Trimestre actual
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => setPeriod(year, 'all')}
        >
          Todo el año
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}

      {loading && !summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      )}

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Ingresos"
            value={formatMoney(summary.income.total)}
            hint={`${summary.income.count} facturas · base ${formatMoney(summary.income.base)}`}
          />
          <SummaryCard
            title="Gastos"
            value={formatMoney(summary.expense.total)}
            hint={`${summary.expense.count} gastos · base ${formatMoney(summary.expense.base)}`}
          />
          <SummaryCard
            title="Pendiente cobro"
            value={formatMoney(summary.income.pendingTotal)}
            hint={`${summary.income.pendingCount} ingresos`}
          />
          <SummaryCard
            title="Neto periodo"
            value={formatMoney(summary.net)}
            hint={`${summary.from} → ${summary.to}`}
            emphasize
          />
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  title,
  value,
  hint,
  emphasize,
}: {
  title: string
  value: string
  hint: string
  emphasize?: boolean
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p
        className={
          emphasize
            ? 'mt-2 text-2xl font-semibold tracking-tight text-primary'
            : 'mt-2 text-2xl font-semibold tracking-tight text-foreground'
        }
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}
