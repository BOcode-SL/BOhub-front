import { useEffect, useState, type ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  ShieldCheck,
  Search,
  Server,
  Bot,
  Zap,
  Play,
  Activity,
} from 'lucide-react'
import { usePageCrumb } from '@/components/layout/page-crumb'
import { AppSelect } from '@/components/app-select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  fetchWebsiteAnalysisHistory,
  createWebsiteAnalysis,
  deleteWebsiteAnalysis,
  type WebsiteAnalysis,
  type AuditFinding,
} from '@/lib/website-analysis'
import { toastError, toastSuccess } from '@/lib/toast'

function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card className="min-w-0 gap-2 py-4">
      <CardHeader className="px-4">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-xl">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function getCategoryIcon(cat: string) {
  switch (cat) {
    case 'Security':
      return <ShieldCheck className="size-3.5" />
    case 'SEO':
      return <Search className="size-3.5" />
    case 'AI Discoverability':
      return <Bot className="size-3.5" />
    case 'Infrastructure':
      return <Server className="size-3.5" />
    case 'Performance':
      return <Zap className="size-3.5" />
    default:
      return null
  }
}

function PriorityBadge({ priority, status }: { priority: string; status: string }) {
  if (status === 'Passed') {
    return (
      <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-medium">
        PASSED
      </Badge>
    )
  }
  switch (priority) {
    case 'HIGH':
      return (
        <Badge variant="destructive" className="font-semibold gap-1">
          <AlertCircle className="size-3" /> CRÍTICO
        </Badge>
      )
    case 'MEDIUM':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-1">
          <AlertTriangle className="size-3" /> MEDIO
        </Badge>
      )
    case 'LOW':
      return (
        <Badge className="bg-blue-600 hover:bg-blue-700 text-white font-semibold gap-1">
          <Info className="size-3" /> LEVE
        </Badge>
      )
    default:
      return <Badge variant="outline">{priority}</Badge>
  }
}

function FindingCard({ finding }: { finding: AuditFinding }) {
  const isPassed = finding.status === 'Passed'

  const borderClass = isPassed
    ? 'border-border'
    : finding.priority === 'HIGH'
    ? 'border-destructive/50 bg-destructive/5'
    : finding.priority === 'MEDIUM'
    ? 'border-amber-500/50 bg-amber-500/5'
    : 'border-blue-500/50 bg-blue-500/5'

  return (
    <Card className={`gap-3 py-4 transition-all ${borderClass}`}>
      <CardHeader className="px-4 pb-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            {isPassed ? (
              <CheckCircle2 className="size-4 text-primary shrink-0" />
            ) : finding.priority === 'HIGH' ? (
              <AlertCircle className="size-4 text-destructive shrink-0" />
            ) : finding.priority === 'MEDIUM' ? (
              <AlertTriangle className="size-4 text-amber-500 shrink-0" />
            ) : (
              <Info className="size-4 text-blue-500 shrink-0" />
            )}
            <CardTitle className="text-base font-semibold text-foreground">
              {finding.title}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Badge variant="outline" className="gap-1 text-xs">
              {getCategoryIcon(finding.category)}
              {finding.category}
            </Badge>
            <PriorityBadge priority={finding.priority} status={finding.status} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pt-1 flex flex-col gap-3">
        {/* Evidence */}
        <div className="rounded-md bg-muted/70 px-3 py-2 font-mono text-xs text-foreground/90 break-words border border-border/50">
          <span className="text-muted-foreground font-sans font-medium select-none block mb-0.5">
            Evidencia detectada:
          </span>
          {finding.evidence}
        </div>

        {/* Why it matters */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">Por qué importa: </span>
          {finding.whyItMatters}
        </p>

        {/* Recommended Fix */}
        <div className="rounded-md border border-border bg-background/80 px-3 py-2.5 text-sm flex items-start gap-2.5">
          <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
          <div className="leading-snug">
            <span className="font-semibold text-foreground">Solución recomendada: </span>
            <span className="text-muted-foreground">{finding.recommendedFix}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function WebsiteAnalysisReportSkeleton({ domain }: { domain?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-6 pb-12">
      {/* Back button */}
      <div className="min-w-0">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 cursor-pointer"
          nativeButton={false}
          render={<Link to="/dashboard/website-analysis" />}
        >
          <ArrowLeft /> Análisis Web
        </Button>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {domain || 'Cargando análisis...'}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Loader2 className="size-3 animate-spin" /> Cargando análisis...
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Obteniendo métricas de rendimiento, seguridad e infraestructura...
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-9 w-36 rounded-md" />
            <Skeleton className="h-9 w-9 rounded-md" />
          </div>
        </div>
      </div>

      {/* Loading banner */}
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-foreground flex items-center gap-3">
        <Loader2 className="size-5 animate-spin text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Cargando reporte de auditoría...</p>
          <p className="text-xs text-muted-foreground">
            Recuperando el análisis completo y las métricas de rendimiento para <strong className="text-foreground">{domain || 'este dominio'}</strong>.
          </p>
        </div>
      </div>

      {/* Grid de Resumen Ejecutivo (StatCards) */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="gap-2 py-4">
            <CardHeader className="px-4 pb-0">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="px-4 pt-2">
              <Skeleton className="h-7 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Especificaciones Técnicas Skeletons */}
      <div className="grid gap-6">
        <Skeleton className="h-6 w-56" />

        {Array.from({ length: 3 }).map((_, idx) => (
          <Card key={idx} className="gap-3 py-4">
            <CardHeader className="px-4">
              <Skeleton className="h-5 w-48 mb-1" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent className="px-4 pt-2">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, cellIdx) => (
                  <div key={cellIdx} className="grid gap-1">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-5 w-36" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Findings Section Skeleton */}
      <div className="flex flex-col gap-4 mt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-6 w-60" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-1.5">
            <Skeleton className="h-8 w-20 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
            <Skeleton className="h-8 w-24 rounded-md" />
          </div>
        </div>

        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="gap-3 py-4">
              <CardHeader className="px-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-52" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </CardHeader>
              <CardContent className="px-4 pt-1 flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export function WebsiteAnalysisReportPage() {
  const params = useParams()
  const rawDomain = params.domain || params['*'] || ''
  const domain = rawDomain
    ? decodeURIComponent(rawDomain)
        .trim()
        .replace(/^https?:\/\//i, '')
        .replace(/\/+$/, '')
    : ''
  const navigate = useNavigate()

  const [reports, setReports] = useState<WebsiteAnalysis[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<'all' | 'open' | 'passed'>('all')

  usePageCrumb(domain)

  useEffect(() => {
    if (!domain) return
    const abort = new AbortController()
    load(domain, abort.signal)
    return () => abort.abort()
  }, [domain])

  // Polling si hay algún análisis en 'pending'
  useEffect(() => {
    if (!domain) return
    const hasPending = reports.some((r) => r.status === 'pending')
    if (!hasPending) return

    const interval = setInterval(() => {
      fetchWebsiteAnalysisHistory(domain)
        .then((list) => {
          setReports(list)
        })
        .catch(() => {})
    }, 4000)

    return () => clearInterval(interval)
  }, [domain, reports])

  async function load(domainName: string, signal?: AbortSignal) {
    try {
      setLoading(true)
      const list = await fetchWebsiteAnalysisHistory(domainName, signal)
      setReports(list)
      if (list.length > 0) {
        setSelectedId((prev) => (prev && list.some((r) => r.id === prev) ? prev : list[0].id))
      } else {
        setSelectedId(null)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') toastError(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleReanalyze() {
    if (!domain) return
    try {
      setReanalyzing(true)
      const newReport = await createWebsiteAnalysis({ domain })
      toastSuccess('Análisis iniciado en segundo plano')
      setReports((prev) => [newReport, ...prev.filter((r) => r.id !== newReport.id)])
      setSelectedId(newReport.id)
    } catch (err) {
      toastError(err)
    } finally {
      setReanalyzing(false)
    }
  }

  async function handleDelete() {
    if (!currentReport) return
    if (!window.confirm('¿Estás seguro de que deseas eliminar este reporte?')) return

    try {
      setDeleting(true)
      await deleteWebsiteAnalysis(currentReport.id)
      toastSuccess('Reporte eliminado')
      const remaining = reports.filter((r) => r.id !== currentReport.id)
      if (remaining.length === 0) {
        navigate('/dashboard/website-analysis')
      } else {
        setReports(remaining)
        setSelectedId(remaining[0].id)
      }
    } catch (err) {
      toastError(err)
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return <WebsiteAnalysisReportSkeleton domain={domain} />
  }

  const currentReport = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null

  if (!currentReport) {
    return (
      <div className="flex min-w-0 flex-col gap-6 pb-12">
        <div className="min-w-0">
          <Button
            variant="ghost"
            size="sm"
            className="mb-2 -ml-2 cursor-pointer"
            nativeButton={false}
            render={<Link to="/dashboard/website-analysis" />}
          >
            <ArrowLeft /> Análisis Web
          </Button>
          <div className="flex flex-col gap-1.5 min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {domain}
            </h1>
          </div>
        </div>

        <Card className="p-8 text-center flex flex-col items-center justify-center gap-4 border-dashed">
          <div className="rounded-full bg-primary/10 p-3 text-primary">
            <Activity className="size-8" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-semibold text-foreground">Dominio no analizado todavía</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No se han encontrado auditorías previas para <strong className="text-foreground">{domain}</strong>. Puedes iniciar el primer análisis ahora mismo.
            </p>
          </div>
          <Button onClick={handleReanalyze} disabled={reanalyzing} className="mt-2">
            {reanalyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            {reanalyzing ? 'Iniciando análisis...' : 'Auditar este sitio ahora'}
          </Button>
        </Card>
      </div>
    )
  }

  const isPending = currentReport.status === 'pending'
  const isFailed = currentReport.status === 'failed'

  const score = currentReport.performanceData?.score
  const performanceError = currentReport.performanceData?.error
  const seo = currentReport.seoData?.seo
  const sec = currentReport.seoData?.security
  const dns = currentReport.seoData?.dns
  const ssl = currentReport.seoData?.ssl
  const findings: AuditFinding[] = currentReport.auditFindings || []

  const openFindings = findings.filter((f) => f.status === 'Open')
  const passedFindings = findings.filter((f) => f.status === 'Passed')

  const highIssues = openFindings.filter((f) => f.priority === 'HIGH')
  const mediumIssues = openFindings.filter((f) => f.priority === 'MEDIUM')
  const lowIssues = openFindings.filter((f) => f.priority === 'LOW')

  const historyItems = reports.map((r, idx) => ({
    value: r.id,
    label: `${idx === 0 ? 'Último: ' : ''}${new Date(r.createdAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}${r.status === 'pending' ? ' (En progreso...)' : ''}`,
  }))

  const targetUrl = currentReport.domain.startsWith('http')
    ? currentReport.domain
    : `https://${currentReport.domain}`

  return (
    <div className="flex min-w-0 flex-col gap-6 pb-12">
      {/* Back button */}
      <div className="min-w-0">
        <Button
          variant="ghost"
          size="sm"
          className="mb-2 -ml-2 cursor-pointer"
          nativeButton={false}
          render={<Link to="/dashboard/website-analysis" />}
        >
          <ArrowLeft /> Análisis Web
        </Button>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
                {currentReport.domain}
              </h1>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                nativeButton={false}
                render={<a href={targetUrl} target="_blank" rel="noreferrer" />}
                title="Abrir web externa"
              >
                <ExternalLink className="size-3.5" />
              </Button>
              <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
                {reports.length} {reports.length === 1 ? 'versión' : 'versiones'}
              </span>
            </div>

            {/* Badges de Stack Tecnológico */}
            {currentReport.techStack && currentReport.techStack.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground font-medium mr-0.5">Stack detectado:</span>
                {currentReport.techStack.map((tech) => (
                  <Badge key={tech} variant="secondary" className="font-normal text-xs px-2 py-0.5">
                    {tech}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {reports.length > 1 && (
              <div className="min-w-[200px]">
                <AppSelect
                  items={historyItems}
                  value={selectedId}
                  onValueChange={(val) => val && setSelectedId(val)}
                  className="h-9 min-w-[190px]"
                />
              </div>
            )}

            <Button onClick={handleReanalyze} disabled={reanalyzing || deleting || isPending}>
              {reanalyzing || isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {isPending ? 'Analizando...' : 'Volver a Analizar'}
            </Button>

            <Button
              variant="destructive"
              size="icon"
              onClick={handleDelete}
              disabled={deleting || reanalyzing}
              title="Eliminar este reporte"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Banner si el análisis actual está en progreso */}
      {isPending && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-amber-600 dark:text-amber-400 flex items-center gap-3">
          <Loader2 className="size-5 animate-spin shrink-0" />
          <div>
            <p className="font-semibold text-foreground">Auditoría en curso en segundo plano</p>
            <p className="text-sm text-muted-foreground">
              Estamos recopilando métricas de Lighthouse, cabeceras de seguridad, certificados SSL y DNS. Esta vista se actualizará automáticamente en unos segundos.
            </p>
          </div>
        </div>
      )}

      {/* Banner si el análisis falló */}
      {isFailed && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-destructive flex items-center gap-3">
          <AlertCircle className="size-5 shrink-0" />
          <div>
            <p className="font-semibold">El análisis ha fallado</p>
            <p className="text-sm text-muted-foreground">
              No fue posible conectar con el servidor o resolver el dominio. Puedes reintentarlo con el botón superior.
            </p>
          </div>
        </div>
      )}

      {/* Grid de Resumen Ejecutivo (Executive Summary) */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Problemas Críticos (High)"
          value={
            isPending ? (
              <span className="text-muted-foreground text-base">Analizando...</span>
            ) : highIssues.length > 0 ? (
              <span className="text-destructive font-bold flex items-center gap-2">
                <AlertCircle className="size-5" /> {highIssues.length} {highIssues.length === 1 ? 'crítico' : 'críticos'}
              </span>
            ) : (
              <span className="text-primary font-medium flex items-center gap-2">
                <CheckCircle2 className="size-5" /> 0 Críticos
              </span>
            )
          }
        />

        <StatCard
          label="Problemas Medios & Leves"
          value={
            isPending ? (
              <span className="text-muted-foreground text-base">Analizando...</span>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-amber-500 font-semibold">{mediumIssues.length} Medios</span>
                <span className="text-muted-foreground text-sm">/</span>
                <span className="text-blue-500 font-semibold">{lowIssues.length} Leves</span>
              </div>
            )
          }
        />

        <StatCard
          label="Pruebas Superadas"
          value={
            isPending ? (
              <span className="text-muted-foreground text-base">Analizando...</span>
            ) : (
              <span className="text-primary font-bold flex items-center gap-2">
                <CheckCircle2 className="size-5" /> {passedFindings.length} Pasadas
              </span>
            )
          }
        />

        <StatCard
          label="Rendimiento PageSpeed"
          value={
            isPending ? (
              <span className="text-muted-foreground text-base">Analizando...</span>
            ) : score !== null && score !== undefined ? (
              <div className="flex flex-col gap-1">
                <span
                  className={
                    score >= 90 ? 'text-primary font-bold' : score >= 50 ? 'text-yellow-500 font-bold' : 'text-destructive font-bold'
                  }
                >
                  {score}/100
                </span>
                {(currentReport.performanceData?.accessibility != null ||
                  currentReport.performanceData?.best_practices != null ||
                  currentReport.performanceData?.seo != null) && (
                  <span className="text-[11px] text-muted-foreground font-normal">
                    Acc: {currentReport.performanceData?.accessibility ?? '—'} · BP:{' '}
                    {currentReport.performanceData?.best_practices ?? '—'} · SEO:{' '}
                    {currentReport.performanceData?.seo ?? '—'}
                  </span>
                )}
              </div>
            ) : performanceError ? (
              <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono">
                Error API (429/Quota)
              </Badge>
            ) : (
              'N/D'
            )
          }
        />
      </div>

      {/* Tarjetas de Detalles Técnicos con <dl> */}
      <div className="grid gap-6">
        <h2 className="text-xl font-bold tracking-tight text-foreground border-b border-border pb-3">
          Especificaciones Técnicas On-Page
        </h2>

        {/* SEO & Descubrimiento AI */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>SEO & Descubrimiento AI</CardTitle>
            <CardDescription>Etiquetas meta, Open Graph, jerarquía y accesibilidad semántica.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-2">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Etiqueta Title</dt>
                <dd className="text-sm font-medium text-foreground break-words">
                  {seo?.title || (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Meta Description</dt>
                <dd className="text-sm font-medium text-foreground break-words">
                  {seo?.description || (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Encabezado H1</dt>
                <dd className="text-sm font-medium text-foreground break-words">
                  {seo?.h1 || (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Open Graph (og:title / og:image)</dt>
                <dd className="text-sm font-medium text-foreground">
                  {seo?.og_title || seo?.og_image ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Texto Visible (Palabras)</dt>
                <dd className="text-sm font-medium text-foreground">
                  {seo?.word_count !== undefined ? (
                    <span>{seo.word_count} palabras</span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Atributo Lang</dt>
                <dd className="text-sm font-medium text-foreground">
                  {seo?.lang ? (
                    <Badge variant="outline">{seo.lang}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1 lg:col-span-3">
                <dt className="text-sm text-muted-foreground">URL Canonical</dt>
                <dd className="text-sm font-medium text-foreground break-all">
                  {seo?.canonical || (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Seguridad HTTP */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>Seguridad HTTP</CardTitle>
            <CardDescription>Cabeceras de protección activa emitidas por el servidor web.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-2">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Strict-Transport-Security (HSTS)</dt>
                <dd>
                  {sec?.hsts ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      Detectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Content-Security-Policy (CSP)</dt>
                <dd>
                  {sec?.csp ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      Detectado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">X-Frame-Options</dt>
                <dd>
                  {sec?.x_frame_options ? (
                    <Badge variant="outline">{sec.x_frame_options}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">X-Content-Type-Options</dt>
                <dd>
                  {sec?.x_content_type_options ? (
                    <Badge variant="outline">{sec.x_content_type_options}</Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Falta
                    </Badge>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Infraestructura, Correo & DNS */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>Infraestructura & DNS</CardTitle>
            <CardDescription>Validaciones de red, servidores de correo y certificados SSL.</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pt-2">
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Registro SPF (Anti-Spam)</dt>
                <dd>
                  {dns?.has_spf ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      No detectado
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Registro DMARC</dt>
                <dd>
                  {dns?.has_dmarc ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      Configurado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      No detectado
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Servidores MX (Correo)</dt>
                <dd className="text-sm font-medium text-foreground">
                  {dns?.mx_records && dns.mx_records.length > 0 ? (
                    <span title={dns.mx_records.join(', ')}>
                      {dns.mx_records.length} {dns.mx_records.length === 1 ? 'servidor' : 'servidores'}
                    </span>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Ninguno
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Registros A (Dirección IP)</dt>
                <dd className="text-sm font-mono text-foreground break-all">
                  {dns?.a_records && dns.a_records.length > 0 ? (
                    dns.a_records.join(', ')
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Ninguno
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Certificado SSL</dt>
                <dd>
                  {ssl?.valid ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                      Válido
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                      Inválido
                    </Badge>
                  )}
                </dd>
              </div>

              <div className="grid gap-1">
                <dt className="text-sm text-muted-foreground">Caducidad SSL</dt>
                <dd className="text-sm font-medium text-foreground">
                  {ssl?.valid_to_unix
                    ? new Date(ssl.valid_to_unix * 1000).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '—'}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Section: Findings (Auditoría Profunda) */}
      {!isPending && findings.length > 0 && (
        <div className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                Hallazgos y Reglas de Auditoría ({findings.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                Evaluación exhaustiva de seguridad, infraestructura, indexación y visibilidad IA.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <Button
                variant={activeTab === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('all')}
              >
                Todos ({findings.length})
              </Button>
              <Button
                variant={activeTab === 'open' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('open')}
              >
                Problemas ({openFindings.length})
              </Button>
              <Button
                variant={activeTab === 'passed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('passed')}
              >
                Aprobados ({passedFindings.length})
              </Button>
            </div>
          </div>

          {/* Open Findings (Issues) */}
          {(activeTab === 'all' || activeTab === 'open') && openFindings.length > 0 && (
            <div className="flex flex-col gap-4">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-500" />
                Problemas Detectados que Requieren Atención ({openFindings.length})
              </h3>
              <div className="grid gap-4">
                {openFindings
                  .sort((a, b) => {
                    const weight: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
                    return (weight[b.priority] || 0) - (weight[a.priority] || 0)
                  })
                  .map((finding) => (
                    <FindingCard key={finding.id} finding={finding} />
                  ))}
              </div>
            </div>
          )}

          {/* Passed Findings */}
          {(activeTab === 'all' || activeTab === 'passed') && passedFindings.length > 0 && (
            <div className="flex flex-col gap-4 mt-2">
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" />
                Señales Positivas y Pruebas Superadas ({passedFindings.length})
              </h3>
              <div className="grid gap-4">
                {passedFindings.map((finding) => (
                  <FindingCard key={finding.id} finding={finding} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
