import { useEffect, useState } from 'react'
import { Activity, Plus, Loader2, Clock, CheckCircle2, XCircle, AlertTriangle, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ListPageShell } from '@/components/list-page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fetchWebsiteAnalyses, createWebsiteAnalysis, type WebsiteAnalysisGrouped } from '@/lib/website-analysis'
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
  const [data, setData] = useState<WebsiteAnalysisGrouped[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [domain, setDomain] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    const abort = new AbortController()
    load(abort.signal)
    return () => abort.abort()
  }, [])

  // Polling cada 5s si hay algún análisis en 'pending'
  useEffect(() => {
    const hasPending = data.some((item) => item.status === 'pending')
    if (!hasPending) return

    const interval = setInterval(() => {
      fetchWebsiteAnalyses(1)
        .then((res) => setData(res.data))
        .catch(() => {})
    }, 5000)

    return () => clearInterval(interval)
  }, [data])

  async function load(signal?: AbortSignal) {
    try {
      setLoading(true)
      const res = await fetchWebsiteAnalyses(1, signal)
      setData(res.data)
    } catch (err: any) {
      if (err.name !== 'AbortError') toastError(err)
    } finally {
      setLoading(false)
    }
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

  return (
    <ListPageShell
      title="Análisis Web"
      description="Rendimiento SEO, seguridad y métricas de Core Web Vitals"
      icon={Activity}
      actions={
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger render={<Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Análisis
            </Button>} />
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
    >
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dominio</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>PageSpeed</TableHead>
              <TableHead>Problemas</TableHead>
              <TableHead>Último Escaneo</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No hay análisis todavía.
                </TableCell>
              </TableRow>
            ) : (
              data.map((item) => {
                const score = item.performanceScore
                const isPending = item.status === 'pending'
                const errorsCount = item.totalErrors ?? 0

                return (
                  <TableRow key={item.domain}>
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
    </ListPageShell>
  )
}
