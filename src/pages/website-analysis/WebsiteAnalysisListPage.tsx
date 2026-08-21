import { useEffect, useState } from 'react'
import {
  Activity,
  Plus,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { ListPageShell } from '@/components/list-page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import {
  fetchWebsiteAnalyses,
  createWebsiteAnalysis,
  type WebsiteAnalysisGrouped,
  type Paginated,
} from '@/lib/website-analysis'
import { toastError, toastSuccess } from '@/lib/toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const PER_PAGE_OPTIONS = [10, 15, 25] as const
function parsePage(value: string | null): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1
}

function parsePerPage(value: string | null): number {
  const n = Number(value)
  if (PER_PAGE_OPTIONS.includes(n as (typeof PER_PAGE_OPTIONS)[number])) {
    return n
  }
  return 15
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'pending':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium gap-1">
          <Loader2 className="size-3 animate-spin" /> En progreso
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="destructive" className="font-medium gap-1">
          <XCircle className="size-3" /> Fallido
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-medium gap-1">
          <CheckCircle2 className="size-3" /> Completado
        </Badge>
      )
  }
}

export function WebsiteAnalysisListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const perPage = parsePerPage(searchParams.get('per_page'))
  const urlSearch = searchParams.get('search') ?? ''

  const [searchInput, setSearchInput] = useState(urlSearch)
  const [data, setData] = useState<WebsiteAnalysisGrouped[]>([])
  const [meta, setMeta] = useState<Paginated<WebsiteAnalysisGrouped>['meta'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [domain, setDomain] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    setSearchInput(urlSearch)
  }, [urlSearch])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = searchInput.trim()
      if (next === urlSearch) return
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) p.set('search', next)
          else p.delete('search')
          p.set('page', '1')
          p.set('per_page', String(perPage))
          return p
        },
        { replace: true }
      )
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput, urlSearch, perPage, setSearchParams])

  useEffect(() => {
    const abort = new AbortController()
    load(abort.signal)
    return () => abort.abort()
  }, [page, perPage, urlSearch])

  // Polling cada 5s si hay algún análisis en 'pending'
  useEffect(() => {
    const hasPending = data.some((item) => item.status === 'pending')
    if (!hasPending) return

    const interval = setInterval(() => {
      fetchWebsiteAnalyses({ page, per_page: perPage, search: urlSearch || undefined })
        .then((res) => {
          setData(res.data)
          setMeta(res.meta)
        })
        .catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [data, page, perPage, urlSearch])

  async function load(signal?: AbortSignal) {
    try {
      setLoading(true)
      const res = await fetchWebsiteAnalyses(
        { page, per_page: perPage, search: urlSearch || undefined },
        signal
      )
      setData(res.data)
      setMeta(res.meta)
    } catch (err: any) {
      if (err.name !== 'AbortError') toastError(err)
    } finally {
      setLoading(false)
    }
  }

  function patchParams(patch: Record<string, string | null>) {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === '') p.delete(k)
        else p.set(k, v)
      }
      return p
    })
  }

  function setPage(next: number) {
    patchParams({
      page: String(next),
      per_page: String(perPage),
      search: urlSearch || null,
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const targetDomain = domain.trim()
    if (!targetDomain) return

    setCreateOpen(false)
    setDomain('')
    toastSuccess('Análisis iniciado en segundo plano')

    // Optimistic UI update
    setData((prev) => {
      const exists = prev.find((item) => item.domain.toLowerCase() === targetDomain.toLowerCase())
      if (exists) {
        return prev.map((item) =>
          item.domain.toLowerCase() === targetDomain.toLowerCase()
            ? {
                ...item,
                status: 'pending',
                performanceScore: null,
                totalErrors: 0,
                lastAnalyzed: new Date().toISOString(),
              }
            : item
        )
      }
      return [
        {
          domain: targetDomain,
          status: 'pending',
          performanceScore: null,
          totalErrors: 0,
          lastAnalyzed: new Date().toISOString(),
        },
        ...prev,
      ]
    })

    try {
      setCreating(true)
      await createWebsiteAnalysis({ domain: targetDomain })
    } catch (err) {
      toastError(err)
      void load()
    } finally {
      setCreating(false)
    }
  }

  const total = meta?.total ?? 0
  const lastPage = meta?.last_page ?? 1
  const currentPage = meta?.current_page ?? page
  const canPrev = currentPage > 1
  const canNext = currentPage < lastPage

  return (
    <ListPageShell
      title="Análisis Web"
      description="Rendimiento SEO, seguridad y métricas de Core Web Vitals"
      icon={Activity}
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            render={
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo Análisis
              </Button>
            }
          />
          <DialogContent>
            <form onSubmit={handleCreate}>
              <DialogHeader>
                <DialogTitle>Nuevo Análisis Web</DialogTitle>
                <DialogDescription>
                  Introduce el dominio de la web a analizar (ej. bocode.es). El proceso se ejecutará en segundo plano.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="domain">Dominio</Label>
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="ej. bocode.es"
                    autoFocus
                    disabled={creating}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating || !domain.trim()}>
                  {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Analizar
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
      toolbar={
        <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por dominio…"
              className="pl-9"
              aria-label="Buscar dominios"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setSearchParams((prev) => {
                    const p = new URLSearchParams(prev)
                    const next = searchInput.trim()
                    if (next) p.set('search', next)
                    else p.delete('search')
                    p.set('page', '1')
                    p.set('per_page', String(perPage))
                    return p
                  })
                }
              }}
            />
          </div>
        </div>
      }
    >
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Dominio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>PageSpeed</TableHead>
              <TableHead>Problemas</TableHead>
              <TableHead>Último Escaneo</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && data.length === 0 ? (
              Array.from({ length: Math.min(perPage, 5) }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-32" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-20" />
                  </TableCell>
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {urlSearch ? 'No se encontraron análisis que coincidan con la búsqueda.' : 'No hay análisis todavía.'}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => {
                const score = item.performanceScore
                const isPending = item.status === 'pending'
                const errorsCount = item.totalErrors ?? 0

                return (
                  <TableRow key={item.domain} className={loading ? 'opacity-60' : undefined}>
                    <TableCell className="font-medium">{item.domain}</TableCell>
                    <TableCell>
                      <StatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      {isPending ? (
                        <span className="text-muted-foreground text-sm">—</span>
                      ) : score !== null && score !== undefined ? (
                        <span
                          className={`font-semibold inline-flex items-center gap-1 text-sm ${
                            score >= 80
                              ? 'text-primary'
                              : score >= 50
                              ? 'text-amber-500'
                              : 'text-destructive'
                          }`}
                        >
                          <Zap className="size-3.5" />
                          {score}/100
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isPending ? (
                        <span className="text-muted-foreground text-xs">Calculando...</span>
                      ) : errorsCount > 0 ? (
                        <Badge variant="destructive" className="font-semibold gap-1">
                          <AlertTriangle className="size-3" />
                          {errorsCount} {errorsCount === 1 ? 'problema' : 'problemas'}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-primary/40 bg-primary/10 text-primary font-medium gap-1"
                        >
                          <CheckCircle2 className="size-3" />
                          0 problemas
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.lastAnalyzed ? (
                        <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
                          <Clock className="size-3.5" />
                          {new Date(item.lastAnalyzed).toLocaleString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        render={<Link to={`/dashboard/website-analysis/${encodeURIComponent(item.domain)}`} />}
                        nativeButton={false}
                      >
                        Ver detalles
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 && (
        <nav
          aria-label="Paginación de análisis web"
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {meta?.from != null && meta?.to != null ? `${meta.from}–${meta.to} de ${total}` : `${total} en total`}
            <span className="mx-2 text-border">·</span>
            Página {currentPage} de {lastPage}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-24"
              disabled={!canPrev || loading}
              onClick={() => setPage(currentPage - 1)}
            >
              <ChevronLeft />
              Anterior
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-w-24"
              disabled={!canNext || loading}
              onClick={() => setPage(currentPage + 1)}
            >
              Siguiente
              <ChevronRight />
            </Button>
          </div>
        </nav>
      )}
    </ListPageShell>
  )
}
