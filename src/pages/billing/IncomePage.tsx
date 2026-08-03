import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptEuro,
  Search,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ListPageShell } from '@/components/list-page-shell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  LEDGER_STATUSES,
  LEDGER_STATUS_LABELS,
  billingErrorMessage,
  createPayment,
  deletePayment,
  formatMoney,
  listPayments,
  updatePayment,
  type BillingMeta,
  type Payment,
  type PaymentInput,
} from '@/lib/billing'
import { BillingTabs } from '@/pages/billing/BillingTabs'
import { PaymentSheet } from '@/pages/billing/PaymentSheet'

const PER_PAGE_OPTIONS = [10, 15, 25] as const
const selectClass =
  'h-9 rounded-md border border-border bg-input/30 px-2 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

function parsePage(v: string | null) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}
function parsePerPage(v: string | null) {
  const n = Number(v)
  return PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])
    ? n
    : 15
}

export function IncomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const perPage = parsePerPage(searchParams.get('per_page'))
  const urlSearch = searchParams.get('search') ?? ''
  const urlStatus = searchParams.get('status') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const [rows, setRows] = useState<Payment[]>([])
  const [meta, setMeta] = useState<BillingMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add')
  const [editing, setEditing] = useState<Payment | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setSearchInput(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim()
      if (next === urlSearch) return
      setSearchParams((prev) => {
        const p = new URLSearchParams(prev)
        if (next) p.set('search', next)
        else p.delete('search')
        p.set('page', '1')
        p.set('per_page', String(perPage))
        return p
      }, { replace: true })
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput, urlSearch, perPage, setSearchParams])

  useEffect(() => {
    const ac = new AbortController()
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await listPayments(
          {
            search: urlSearch || undefined,
            page,
            perPage,
            status: urlStatus || undefined,
          },
          ac.signal,
        )
        if (cancelled) return
        setRows(res.data)
        setMeta(res.meta)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(billingErrorMessage(err))
        setRows([])
        setMeta(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [urlSearch, page, perPage, urlStatus, tick])

  function patch(next: Record<string, string | null>) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(next)) {
        if (v == null || v === '') p.delete(k)
        else p.set(k, v)
      }
      return p
    })
  }

  async function handleSave(data: PaymentInput) {
    if (sheetMode === 'edit' && editing) await updatePayment(editing.id, data)
    else await createPayment(data)
    setTick((n) => n + 1)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deletePayment(deleteTarget.id)
      setDeleteTarget(null)
      setTick((n) => n + 1)
    } catch (err) {
      setError(billingErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const total = meta?.total ?? 0
  const lastPage = meta?.last_page ?? 1
  const currentPage = meta?.current_page ?? page

  return (
    <>
      <ListPageShell
        title="Ingresos"
        description="Facturas emitidas (ledger). Metadata de factura externa + PDF stub."
        icon={ReceiptEuro}
        above={<BillingTabs />}
        toolbar={
          <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar referencia o nº factura…"
                className="pl-9"
                aria-label="Buscar ingresos"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="shrink-0">Estado</span>
                <select
                  value={urlStatus}
                  onChange={(e) =>
                    patch({ status: e.target.value || null, page: '1' })
                  }
                  className={selectClass}
                  aria-label="Filtrar estado"
                >
                  <option value="">Todos</option>
                  {LEDGER_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {LEDGER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="shrink-0">Por página</span>
                <select
                  value={perPage}
                  onChange={(e) =>
                    patch({ per_page: e.target.value, page: '1' })
                  }
                  className={selectClass}
                  aria-label="Por página"
                >
                  {PER_PAGE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                className="w-full sm:w-auto"
                onClick={() => {
                  setSheetMode('add')
                  setEditing(null)
                  setSheetOpen(true)
                }}
              >
                <Plus />
                Añadir ingreso
              </Button>
            </div>
          </div>
        }
      >
        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
          >
            {error}
          </p>
        )}

        <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Fecha</TableHead>
              <TableHead>Nº / Ref</TableHead>
              <TableHead>Proyecto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && total === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="h-32 text-center text-muted-foreground"
                >
                  No hay ingresos. Añade el primero.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id} className={loading ? 'opacity-60' : undefined}>
                <TableCell className="text-muted-foreground">
                  {row.invoiceDate || '—'}
                </TableCell>
                <TableCell className="font-medium text-foreground">
                  <span className="inline-flex items-center gap-2">
                    {row.invoiceNumber || row.reference || `#${row.id}`}
                    {row.invoiceUrl && (
                      <a
                        href={row.invoiceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary"
                        aria-label="Abrir PDF"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.project?.name || '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {LEDGER_STATUS_LABELS[row.status]}
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  {formatMoney(row.totalAmount)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="cursor-pointer"
                        />
                      }
                    >
                      <MoreHorizontal />
                      <span className="sr-only">Acciones</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => {
                          setSheetMode('edit')
                          setEditing(row)
                          setSheetOpen(true)
                        }}
                      >
                        <Pencil />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        className="cursor-pointer"
                        onClick={() => setDeleteTarget(row)}
                      >
                        <Trash2 />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <nav
          aria-label="Paginación ingresos"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {lastPage}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="min-w-24"
              disabled={currentPage <= 1 || loading}
              onClick={() => patch({ page: String(currentPage - 1) })}
            >
              <ChevronLeft />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="min-w-24"
              disabled={currentPage >= lastPage || loading}
              onClick={() => patch({ page: String(currentPage + 1) })}
            >
              Siguiente
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
      </ListPageShell>

      <PaymentSheet
        open={sheetOpen}
        mode={sheetMode}
        payment={editing}
        onOpenChange={setSheetOpen}
        onSubmit={handleSave}
      />

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar ingreso</DialogTitle>
            <DialogDescription>Soft delete del registro ledger.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? 'Eliminando…' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
