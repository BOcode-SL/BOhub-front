import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'
import { listClientOptions } from '@/lib/clients'
import { listProjectOptions } from '@/lib/projects'
import {
  MAINTENANCE_PERIODS,
  MAINTENANCE_PERIOD_LABELS,
  MAINTENANCE_STATUSES,
  MAINTENANCE_STATUS_LABELS,
  createMaintenance,
  deleteMaintenance,
  listMaintenances,
  maintenanceErrorMessage,
  updateMaintenance,
  type MaintenanceInput,
  type MaintenanceMeta,
  type MaintenancePeriod,
  type MaintenanceStatus,
} from '@/lib/maintenance'
import { MaintenanceSheet } from '@/pages/maintenance/MaintenanceSheet'

const PER_PAGE = 15
const selectClass =
  'h-9 cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

function parsePage(v: string | null) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

export function MaintenancePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const urlStatus = searchParams.get('status') ?? ''
  const urlScope = searchParams.get('scope') ?? (urlStatus ? '' : 'open')
  const urlClient = searchParams.get('client_id') ?? ''
  const urlProject = searchParams.get('project_id') ?? ''
  const urlPeriod = searchParams.get('period') ?? ''
  const urlEnding = searchParams.get('ending_within') ?? ''

  const filterKey = `${urlStatus}|${urlScope}|${urlClient}|${urlProject}|${urlPeriod}|${urlEnding}`
  const [debouncedFilters, setDebouncedFilters] = useState(filterKey)

  const [rows, setRows] = useState<MaintenancePeriod[]>([])
  const [meta, setMeta] = useState<MaintenanceMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  const [clients, setClients] = useState<{ id: number; name: string }[]>([])
  const [projects, setProjects] = useState<{ id: number; name: string }[]>([])

  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState<'add' | 'edit'>('add')
  const [editing, setEditing] = useState<MaintenancePeriod | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<MaintenancePeriod | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    void listClientOptions().then(setClients)
    void listProjectOptions().then(setProjects)
  }, [])

  // ponytail: 300ms debounce on filters; page/tick fetch immediately
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filterKey), 300)
    return () => window.clearTimeout(t)
  }, [filterKey])

  useEffect(() => {
    const [status, scope, client, project, periodKind, endingRaw] =
      debouncedFilters.split('|')
    const ac = new AbortController()
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const ending =
          endingRaw === '7' || endingRaw === '30'
            ? (Number(endingRaw) as 7 | 30)
            : undefined
        const res = await listMaintenances(
          {
            page,
            perPage: PER_PAGE,
            status: status || undefined,
            scope: scope || undefined,
            period:
              periodKind === 'monthly' || periodKind === 'annual'
                ? periodKind
                : undefined,
            clientId: client ? Number(client) : undefined,
            projectId: project ? Number(project) : undefined,
            endingWithin: ending,
            sort: 'ends_on',
          },
          ac.signal,
        )
        if (cancelled) return
        setRows(res.data)
        setMeta(res.meta)
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(maintenanceErrorMessage(err))
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
  }, [page, debouncedFilters, tick])

  function patch(next: Record<string, string | null>) {
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(next)) {
          if (v == null || v === '') p.delete(k)
          else p.set(k, v)
        }
        if (!('page' in next)) p.set('page', '1')
        return p
      },
      { replace: true },
    )
  }

  async function handleSave(data: MaintenanceInput) {
    if (sheetMode === 'edit' && editing) {
      await updateMaintenance(editing.id, data)
    } else {
      await createMaintenance(data)
    }
    setTick((n) => n + 1)
  }

  async function handleCancel(row: MaintenancePeriod) {
    await updateMaintenance(row.id, { status: 'cancelled' })
    setTick((n) => n + 1)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteMaintenance(deleteTarget.id)
      setDeleteTarget(null)
      setTick((n) => n + 1)
    } catch (err) {
      setError(maintenanceErrorMessage(err))
    } finally {
      setDeleting(false)
    }
  }

  const lastPage = meta?.last_page ?? 1
  const currentPage = meta?.current_page ?? page

  return (
    <>
      <ListPageShell
        title="Mantenimientos"
        description="Cola de contratos de soporte por vencimiento. Historial intacto."
        icon={Wrench}
        toolbar={
          <div className="flex flex-col gap-2 py-1 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-end gap-2">
              <label className="grid gap-1 text-xs text-muted-foreground">
                Estado
                <select
                  value={urlStatus || (urlScope === 'open' ? 'open' : '')}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'open') {
                      patch({ status: null, scope: 'open' })
                    } else if (v === '') {
                      patch({ status: null, scope: null })
                    } else {
                      patch({ status: v, scope: null })
                    }
                  }}
                  className={selectClass + ' min-w-40'}
                >
                  <option value="open">Abiertos (prog. + activos)</option>
                  <option value="">Todos</option>
                  {MAINTENANCE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {MAINTENANCE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs text-muted-foreground">
                Periodo
                <select
                  value={urlPeriod}
                  onChange={(e) => patch({ period: e.target.value || null })}
                  className={selectClass + ' min-w-36'}
                >
                  <option value="">Todos</option>
                  {MAINTENANCE_PERIODS.map((p) => (
                    <option key={p} value={p}>
                      {MAINTENANCE_PERIOD_LABELS[p]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs text-muted-foreground">
                Cliente
                <select
                  value={urlClient}
                  onChange={(e) => patch({ client_id: e.target.value || null })}
                  className={selectClass + ' min-w-40'}
                >
                  <option value="">Todos</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-xs text-muted-foreground">
                Proyecto
                <select
                  value={urlProject}
                  onChange={(e) => patch({ project_id: e.target.value || null })}
                  className={selectClass + ' min-w-40'}
                >
                  <option value="">Todos</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex gap-1 pb-0.5">
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                    urlEnding === '7'
                      ? 'bg-sidebar-accent font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  onClick={() =>
                    patch({ ending_within: urlEnding === '7' ? null : '7' })
                  }
                >
                  Vence en 7d
                </button>
                <button
                  type="button"
                  className={cn(
                    'cursor-pointer rounded-md px-3 py-1.5 text-sm transition-colors duration-200',
                    'focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none',
                    urlEnding === '30'
                      ? 'bg-sidebar-accent font-medium text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  onClick={() =>
                    patch({ ending_within: urlEnding === '30' ? null : '30' })
                  }
                >
                  Vence en 30d
                </button>
              </div>
            </div>
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
              Añadir mantenimiento
            </Button>
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
              <TableHead>Proyecto</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Periodo</TableHead>
              <TableHead>Inicio</TableHead>
              <TableHead>Fin</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              rows.length === 0 &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!loading && rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={7}
                  className="h-24 text-center text-muted-foreground"
                >
                  No hay periodos de mantenimiento.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row) => {
              const clientTip = [row.client?.email, row.client?.phone]
                .filter(Boolean)
                .join(' · ')
              return (
                <TableRow key={row.id}>
                  <TableCell className="font-medium text-foreground">
                    {row.project?.name ?? `#${row.projectId}`}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground"
                    title={clientTip || undefined}
                  >
                    <span className="block text-foreground">
                      {row.client?.name ?? '—'}
                    </span>
                    {row.client?.email && (
                      <span className="block text-xs text-muted-foreground">
                        {row.client.email}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                      {MAINTENANCE_PERIOD_LABELS[row.period] ?? row.period}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.startsOn}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.endsOn}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {MAINTENANCE_STATUS_LABELS[row.status as MaintenanceStatus] ??
                      row.status}
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
                        {row.status !== 'cancelled' && (
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => void handleCancel(row)}
                          >
                            Cancelar periodo
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="cursor-pointer text-destructive"
                          onClick={() => setDeleteTarget(row)}
                        >
                          <Trash2 />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {(meta?.total ?? 0) > 0 && (
        <nav
          aria-label="Paginación mantenimientos"
          className="flex items-center justify-between"
        >
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {lastPage}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
              disabled={currentPage <= 1 || loading}
              onClick={() => patch({ page: String(currentPage - 1) })}
            >
              <ChevronLeft />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="cursor-pointer"
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

      <MaintenanceSheet
        open={sheetOpen}
        mode={sheetMode}
        period={editing}
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
            <DialogTitle>Eliminar periodo</DialogTitle>
            <DialogDescription>
              Soft delete. Preferible cancelar si solo quieres cerrarlo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => setDeleteTarget(null)}
            >
              Volver
            </Button>
            <Button
              variant="destructive"
              className="cursor-pointer"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
