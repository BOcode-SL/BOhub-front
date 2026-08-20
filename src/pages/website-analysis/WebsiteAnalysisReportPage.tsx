import { useEffect, useState, type ReactNode } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, RefreshCw, Trash2, ExternalLink } from 'lucide-react'
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

export function WebsiteAnalysisReportPage() {
  const { domain } = useParams<{ domain: string }>()
  const navigate = useNavigate()

  const [reports, setReports] = useState<WebsiteAnalysis[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reanalyzing, setReanalyzing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  usePageCrumb(domain)

  useEffect(() => {
    if (!domain) return
    const abort = new AbortController()
    load(domain, abort.signal)
    return () => abort.abort()
  }, [domain])

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
      toastSuccess('Nuevo análisis completado')
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
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const currentReport = reports.find((r) => r.id === selectedId) ?? reports[0] ?? null

  if (!currentReport) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <p className="text-sm text-muted-foreground">No se encontraron análisis para este dominio.</p>
        <Button
          variant="outline"
          className="w-fit cursor-pointer"
          nativeButton={false}
          render={<Link to="/dashboard/website-analysis" />}
        >
          <ArrowLeft />
          Volver a análisis
        </Button>
      </div>
    )
  }

  const score = currentReport.performanceData?.score
  const performanceError = currentReport.performanceData?.error
  const seo = currentReport.seoData?.seo
  const sec = currentReport.seoData?.security
  const dns = currentReport.seoData?.dns
  const ssl = currentReport.seoData?.ssl

  const historyItems = reports.map((r, idx) => ({
    value: r.id,
    label: `${idx === 0 ? 'Último: ' : ''}${new Date(r.createdAt).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}`,
  }))

  const targetUrl = currentReport.domain.startsWith('http')
    ? currentReport.domain
    : `https://${currentReport.domain}`

  return (
    <div className="flex min-w-0 flex-col gap-6">
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
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

          <div className="flex flex-wrap items-center gap-2">
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

            <Button onClick={handleReanalyze} disabled={reanalyzing || deleting}>
              {reanalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Volver a Analizar
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

      {/* Grid de Resumen (Executive Summary) */}
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Rendimiento PageSpeed"
          value={
            score !== null && score !== undefined ? (
              <span
                className={
                  score >= 90 ? 'text-primary' : score >= 50 ? 'text-yellow-500' : 'text-destructive'
                }
              >
                {score}/100
              </span>
            ) : performanceError ? (
              <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive text-xs font-mono">
                Error API (429/Timeout)
              </Badge>
            ) : (
              'N/D'
            )
          }
        />

        <StatCard
          label="Estado SSL"
          value={
            ssl?.valid ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Válido
              </Badge>
            ) : (
              <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                Inválido / Falta
              </Badge>
            )
          }
        />

        <StatCard
          label="Estructura SEO"
          value={
            seo?.title && seo?.h1 ? (
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary">
                Optimizado
              </Badge>
            ) : (
              <Badge variant="outline" className="border-destructive/40 bg-destructive/10 text-destructive">
                Incompleto
              </Badge>
            )
          }
        />

        <StatCard
          label="Fecha del Escaneo"
          value={
            <span className="text-base font-medium">
              {new Date(currentReport.createdAt).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          }
        />
      </div>

      {/* Tarjetas de Detalles con <dl> */}
      <div className="grid gap-6">
        {/* SEO & Descubrimiento AI */}
        <Card className="gap-3 py-4">
          <CardHeader className="px-4">
            <CardTitle>SEO & Descubrimiento AI</CardTitle>
            <CardDescription>Etiquetas meta, jerarquía y accesibilidad semántica.</CardDescription>
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

              <div className="grid gap-1 lg:col-span-2">
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
    </div>
  )
}
