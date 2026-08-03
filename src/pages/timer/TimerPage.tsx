import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Clock, Pause, Play, Plus, Square, Trash2 } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ListPageShell } from '@/components/list-page-shell'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { listProjectOptions } from '@/lib/projects'
import {
  createHour,
  deleteHour,
  discardTimer,
  formatDuration,
  getActiveTimer,
  listHours,
  listTeamHours,
  patchTimer,
  saveTimer,
  startTimer,
  timerErrorMessage,
  updateHour,
  type ActiveTimer,
  type Hour,
  type HoursMeta,
} from '@/lib/timer'
import { HoursTable } from './HoursTable'
import { TimerTabs } from './TimerTabs'

// ponytail: keep recharts off the Mis horas / Equipo path until Analytics opens
const TimerAnalytics = lazy(() =>
  import('./TimerAnalytics').then((m) => ({ default: m.TimerAnalytics })),
)

const selectClass =
  'h-9 w-full rounded-md border border-border bg-input/30 px-2 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

type Tab = 'mine' | 'team' | 'analytics'

type ListFilters = {
  projectId: number | ''
  userId: number | ''
  from: string
  to: string
}

export function TimerPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [projects, setProjects] = useState<{ id: number; name: string }[]>([])
  const [timer, setTimer] = useState<ActiveTimer | null>(null)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const [liveProjectId, setLiveProjectId] = useState<number | ''>('')
  const [liveDesc, setLiveDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<Tab>('mine')
  const [hours, setHours] = useState<Hour[]>([])
  const [meta, setMeta] = useState<HoursMeta | null>(null)
  const [teamUsers, setTeamUsers] = useState<{ id: number; name: string }[]>([])
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<ListFilters>({
    projectId: '',
    userId: '',
    from: '',
    to: '',
  })
  const [debouncedFilters, setDebouncedFilters] = useState(filters)
  const [listLoading, setListLoading] = useState(true)
  const [listTick, setListTick] = useState(0)

  const [saveOpen, setSaveOpen] = useState(false)
  const [frozenSeconds, setFrozenSeconds] = useState(0)
  const [saveProjectId, setSaveProjectId] = useState<number | ''>('')
  const [saveDesc, setSaveDesc] = useState('')
  const [saveDate, setSaveDate] = useState(today())

  const [manualOpen, setManualOpen] = useState(false)
  const [manualProjectId, setManualProjectId] = useState<number | ''>('')
  const [manualHours, setManualHours] = useState('0')
  const [manualMinutes, setManualMinutes] = useState('30')
  const [manualSeconds, setManualSeconds] = useState('0')
  const [manualDate, setManualDate] = useState(today())
  const [manualDesc, setManualDesc] = useState('')
  const [manualSaving, setManualSaving] = useState(false)

  const [editHour, setEditHour] = useState<Hour | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Hour | null>(null)
  const [editHours, setEditHours] = useState('0')
  const [editMinutes, setEditMinutes] = useState('0')
  const [editDesc, setEditDesc] = useState('')
  const [editDate, setEditDate] = useState('')

  useEffect(() => {
    void listProjectOptions().then(setProjects)
  }, [])

  // ponytail: 300ms debounce on list filters; AbortSignal cancels in-flight
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedFilters(filters), 300)
    return () => window.clearTimeout(t)
  }, [filters])

  async function refreshTimer() {
    const t = await getActiveTimer()
    setTimer(t)
    if (t) {
      setDisplaySeconds(t.elapsedSeconds)
      setLiveProjectId(t.projectId ?? '')
      setLiveDesc(t.description ?? '')
    } else {
      setDisplaySeconds(0)
    }
  }

  useEffect(() => {
    void refreshTimer().catch((err) => setError(timerErrorMessage(err)))
  }, [])

  // ponytail: local 1s tick only; API resync on pause/resume/focus/visibility — not each second
  useEffect(() => {
    if (!timer || timer.state !== 'running') return
    const anchor = Date.now()
    const base = timer.elapsedSeconds
    const id = window.setInterval(() => {
      setDisplaySeconds(base + Math.floor((Date.now() - anchor) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [timer])

  useEffect(() => {
    function resync() {
      if (document.visibilityState === 'hidden') return
      void refreshTimer().catch(() => {})
    }
    window.addEventListener('focus', resync)
    document.addEventListener('visibilitychange', resync)
    return () => {
      window.removeEventListener('focus', resync)
      document.removeEventListener('visibilitychange', resync)
    }
  }, [])

  useEffect(() => {
    if (tab === 'team' && !isAdmin) setTab('mine')
  }, [tab, isAdmin])

  useEffect(() => {
    if (tab === 'analytics') return
    const ac = new AbortController()
    let cancelled = false
    async function run() {
      setListLoading(true)
      try {
        if (tab === 'team') {
          const res = await listTeamHours(
            {
              page,
              perPage: 10,
              projectId: debouncedFilters.projectId || undefined,
              userId: debouncedFilters.userId || undefined,
              from: debouncedFilters.from || undefined,
              to: debouncedFilters.to || undefined,
            },
            ac.signal,
          )
          if (!cancelled) {
            setHours(res.data)
            setMeta(res.meta)
            if (res.users?.length) setTeamUsers(res.users)
          }
        } else {
          const res = await listHours(
            {
              page,
              perPage: 10,
              projectId: debouncedFilters.projectId || undefined,
              from: debouncedFilters.from || undefined,
              to: debouncedFilters.to || undefined,
            },
            ac.signal,
          )
          if (!cancelled) {
            setHours(res.data)
            setMeta(res.meta)
          }
        }
      } catch (err) {
        if (cancelled) return
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(timerErrorMessage(err))
      } finally {
        if (!cancelled) setListLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [page, listTick, tab, debouncedFilters])

  async function runAction(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(timerErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function reloadList() {
    setListTick((n) => n + 1)
  }

  function switchTab(next: Tab) {
    if (tab === next) return
    setTab(next)
    setPage(1)
  }

  function patchFilters(patch: Partial<ListFilters>) {
    setFilters((prev) => ({ ...prev, ...patch }))
    setPage(1)
  }

  async function handleStart() {
    await runAction(async () => {
      const t = await startTimer({
        projectId: liveProjectId || null,
        description: liveDesc.trim() || null,
      })
      setTimer(t)
      setDisplaySeconds(t.elapsedSeconds)
    })
  }

  async function handlePause() {
    if (!timer) return
    await runAction(async () => {
      const t = await patchTimer(timer.id, { action: 'pause' })
      setTimer(t)
      setDisplaySeconds(t.elapsedSeconds)
    })
  }

  async function handleResume() {
    if (!timer) return
    await runAction(async () => {
      const t = await patchTimer(timer.id, { action: 'resume' })
      setTimer(t)
      setDisplaySeconds(t.elapsedSeconds)
    })
  }

  function handleStop() {
    if (!timer) return
    setFrozenSeconds(displaySeconds)
    setSaveProjectId(liveProjectId || timer.projectId || '')
    setSaveDesc(liveDesc || timer.description || '')
    setSaveDate(today())
    setSaveOpen(true)
  }

  async function confirmSave() {
    if (!timer) return
    await runAction(async () => {
      await saveTimer(timer.id, {
        projectId: saveProjectId ? Number(saveProjectId) : null,
        description: saveDesc.trim() || null,
        workedOn: saveDate,
      })
      setTimer(null)
      setDisplaySeconds(0)
      setSaveOpen(false)
      reloadList()
    })
  }

  async function confirmDiscardFromSave() {
    if (!timer) return
    await runAction(async () => {
      await discardTimer(timer.id)
      setTimer(null)
      setDisplaySeconds(0)
      setSaveOpen(false)
    })
  }

  async function handleManual(e: FormEvent) {
    e.preventDefault()
    if (!manualProjectId) {
      setError('Selecciona un proyecto.')
      return
    }
    setManualSaving(true)
    setError(null)
    try {
      await createHour({
        projectId: Number(manualProjectId),
        hours: Number(manualHours) || 0,
        minutes: Number(manualMinutes) || 0,
        seconds: Number(manualSeconds) || 0,
        workedOn: manualDate,
        description: manualDesc.trim() || null,
      })
      setManualDesc('')
      setManualOpen(false)
      reloadList()
    } catch (err) {
      setError(timerErrorMessage(err))
    } finally {
      setManualSaving(false)
    }
  }

  function openEdit(h: Hour) {
    setEditHour(h)
    const total = h.durationSeconds
    setEditHours(String(Math.floor(total / 3600)))
    setEditMinutes(String(Math.floor((total % 3600) / 60)))
    setEditDesc(h.description ?? '')
    setEditDate(h.workedOn)
  }

  async function saveEdit() {
    if (!editHour) return
    setBusy(true)
    setError(null)
    try {
      await updateHour(editHour.id, {
        hours: Number(editHours) || 0,
        minutes: Number(editMinutes) || 0,
        seconds: 0,
        description: editDesc.trim() || null,
        workedOn: editDate,
      })
      setEditHour(null)
      reloadList()
    } catch (err) {
      setError(timerErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusy(true)
    try {
      await deleteHour(deleteTarget.id)
      setDeleteTarget(null)
      reloadList()
    } catch (err) {
      setError(timerErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const isRunning = timer?.state === 'running'
  const isPaused = timer?.state === 'paused'

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
        >
          {error}
        </p>
      )}

      <section className="flex flex-col items-center gap-6 rounded-xl border border-border bg-card px-4 py-8 sm:px-8">
        <p
          className="font-mono text-5xl font-semibold tracking-tight text-primary tabular-nums sm:text-6xl md:text-7xl"
          aria-live="polite"
        >
          {formatDuration(displaySeconds)}
        </p>

        <div className="grid w-full max-w-xl gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="live-project">Proyecto</Label>
            <select
              id="live-project"
              value={liveProjectId}
              onChange={(e) =>
                setLiveProjectId(e.target.value ? Number(e.target.value) : '')
              }
              className={selectClass}
              disabled={busy || saveOpen}
            >
              <option value="">Seleccionar…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="live-desc">Descripción</Label>
            <Input
              id="live-desc"
              value={liveDesc}
              onChange={(e) => setLiveDesc(e.target.value)}
              className="bg-background"
              disabled={busy || saveOpen}
              placeholder="¿En qué trabajas?"
            />
          </div>
        </div>

        <div className="flex w-full max-w-xl flex-wrap justify-center gap-2">
          {!timer && (
            <Button
              type="button"
              size="lg"
              className="min-w-32"
              disabled={busy}
              onClick={() => void handleStart()}
            >
              <Play />
              Iniciar
            </Button>
          )}
          {isRunning && (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="min-w-32"
                disabled={busy}
                onClick={() => void handlePause()}
              >
                <Pause />
                Pausar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="min-w-32"
                disabled={busy}
                onClick={handleStop}
              >
                <Square />
                Parar
              </Button>
            </>
          )}
          {isPaused && (
            <>
              <Button
                type="button"
                size="lg"
                className="min-w-32"
                disabled={busy}
                onClick={() => void handleResume()}
              >
                <Play />
                Reanudar
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="min-w-32"
                disabled={busy}
                onClick={handleStop}
              >
                <Square />
                Parar
              </Button>
            </>
          )}
        </div>
      </section>

      {tab === 'analytics' ? (
        <Suspense
          fallback={<Skeleton className="h-[420px] w-full rounded-xl" />}
        >
          <TimerAnalytics
            above={
              <TimerTabs tab={tab} isAdmin={isAdmin} onChange={switchTab} />
            }
          />
        </Suspense>
      ) : (
        <ListPageShell
          title={tab === 'team' ? 'Equipo' : 'Mis horas'}
          description={
            tab === 'team'
              ? 'Horas registradas por el equipo.'
              : 'Historistro de tus horas trabajadas.'
          }
          icon={Clock}
          above={
            <TimerTabs tab={tab} isAdmin={isAdmin} onChange={switchTab} />
          }
          toolbar={
            <div className="flex flex-col gap-2 py-1 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="shrink-0">Proyecto</span>
                  <select
                    value={filters.projectId}
                    onChange={(e) =>
                      patchFilters({
                        projectId: e.target.value
                          ? Number(e.target.value)
                          : '',
                      })
                    }
                    className={selectClass + ' w-auto min-w-40'}
                  >
                    <option value="">Todos</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                {tab === 'team' && (
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="shrink-0">Usuario</span>
                    <select
                      value={filters.userId}
                      onChange={(e) =>
                        patchFilters({
                          userId: e.target.value
                            ? Number(e.target.value)
                            : '',
                        })
                      }
                      className={selectClass + ' w-auto min-w-40'}
                    >
                      <option value="">Todos</option>
                      {teamUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="shrink-0">Desde</span>
                  <Input
                    type="date"
                    value={filters.from}
                    onChange={(e) => patchFilters({ from: e.target.value })}
                    className="h-9 w-auto bg-input/30"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="shrink-0">Hasta</span>
                  <Input
                    type="date"
                    value={filters.to}
                    onChange={(e) => patchFilters({ to: e.target.value })}
                    className="h-9 w-auto bg-input/30"
                  />
                </label>
              </div>
              {tab === 'mine' && (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setManualProjectId('')
                    setManualHours('0')
                    setManualMinutes('30')
                    setManualSeconds('0')
                    setManualDate(today())
                    setManualDesc('')
                    setManualOpen(true)
                  }}
                >
                  <Plus />
                  Añadir
                </Button>
              )}
            </div>
          }
        >
          <HoursTable
            hours={hours}
            meta={meta}
            loading={listLoading}
            showUser={tab === 'team'}
            showActions={tab === 'mine'}
            page={page}
            onPageChange={setPage}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        </ListPageShell>
      )}

      <Dialog
        open={saveOpen}
        onOpenChange={(o) => {
          if (!o && !busy) setSaveOpen(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Guardar tiempo</DialogTitle>
            <DialogDescription>
              Duración congelada. Guarda o descarta la sesión.
            </DialogDescription>
          </DialogHeader>
          <p className="font-mono text-3xl font-semibold text-primary tabular-nums">
            {formatDuration(frozenSeconds)}
          </p>
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label>Proyecto</Label>
              <select
                value={saveProjectId}
                onChange={(e) =>
                  setSaveProjectId(
                    e.target.value ? Number(e.target.value) : '',
                  )
                }
                className={selectClass}
              >
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input
                value={saveDesc}
                onChange={(e) => setSaveDesc(e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={saveDate}
                onChange={(e) => setSaveDate(e.target.value)}
                className="bg-card"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="destructive"
             
              disabled={busy}
              onClick={() => void confirmDiscardFromSave()}
            >
              <Trash2 />
              Descartar
            </Button>
            <Button
              type="button"
             
              disabled={busy}
              onClick={() => void confirmSave()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Añadir horas</DialogTitle>
            <DialogDescription>Alta manual de tiempo.</DialogDescription>
          </DialogHeader>
          <form
            id="manual-hour-form"
            className="grid gap-3"
            onSubmit={(e) => void handleManual(e)}
          >
            <div className="grid gap-2">
              <Label>Proyecto</Label>
              <select
                required
                value={manualProjectId}
                onChange={(e) =>
                  setManualProjectId(
                    e.target.value ? Number(e.target.value) : '',
                  )
                }
                className={selectClass}
              >
                <option value="">Seleccionar…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="grid gap-2">
                <Label>Horas</Label>
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="grid gap-2">
                <Label>Min</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="grid gap-2">
                <Label>Seg</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={manualSeconds}
                  onChange={(e) => setManualSeconds(e.target.value)}
                  className="bg-card"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input
                value={manualDesc}
                onChange={(e) => setManualDesc(e.target.value)}
                className="bg-card"
              />
            </div>
          </form>
          <DialogFooter>
            <Button
              variant="outline"
             
              onClick={() => setManualOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="manual-hour-form"
             
              disabled={manualSaving}
            >
              {manualSaving ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editHour)}
        onOpenChange={(o) => {
          if (!o) setEditHour(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar horas</DialogTitle>
            <DialogDescription>
              {editHour?.project?.name ?? 'Entrada'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label>Horas</Label>
                <Input
                  type="number"
                  min={0}
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="bg-card"
                />
              </div>
              <div className="grid gap-2">
                <Label>Minutos</Label>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={editMinutes}
                  onChange={(e) => setEditMinutes(e.target.value)}
                  className="bg-card"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="grid gap-2">
              <Label>Descripción</Label>
              <Input
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="bg-card"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
             
              onClick={() => setEditHour(null)}
            >
              Cancelar
            </Button>
            <Button
             
              disabled={busy}
              onClick={() => void saveEdit()}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar horas</DialogTitle>
            <DialogDescription>Soft delete de esta entrada.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
             
              onClick={() => setDeleteTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
             
              disabled={busy}
              onClick={() => void confirmDelete()}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
