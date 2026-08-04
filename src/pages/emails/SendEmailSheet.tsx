import { useDeferredValue, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Paperclip, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  emailsErrorMessage,
  MAX_ATTACHMENT_SIZE,
  MAX_ATTACHMENTS,
  sendEmail,
  substituteVars,
  type EmailTemplate,
} from '@/lib/emails'

type Props = {
  open: boolean
  template: EmailTemplate | null
  onOpenChange: (open: boolean) => void
  onSent: () => void
}

export function SendEmailSheet({
  open,
  template,
  onOpenChange,
  onSent,
}: Props) {
  const [to, setTo] = useState('')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [schedule, setSchedule] = useState(false)
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!open || !template) return
    setTo('')
    setCc('')
    setSubject(template.subject)
    const init: Record<string, string> = {}
    for (const v of template.variables ?? []) init[v] = ''
    setVars(init)
    setSchedule(false)
    setDate('')
    setTime('')
    setFiles([])
    setError(null)
  }, [open, template])

  const deferredVars = useDeferredValue(vars)
  const previewHtml = useMemo(() => {
    if (!template?.htmlBody) return ''
    return substituteVars(template.htmlBody, deferredVars)
  }, [template, deferredVars])

  function addFiles(list: FileList | File[]) {
    const next = [...files]
    for (const f of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) {
        setError(`Máximo ${MAX_ATTACHMENTS} adjuntos`)
        break
      }
      if (f.size > MAX_ATTACHMENT_SIZE) {
        setError(`«${f.name}» supera 10MB`)
        continue
      }
      next.push(f)
    }
    setFiles(next)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!template) return
    setError(null)

    const missing = (template.variables ?? []).filter((v) => !vars[v]?.trim())
    if (missing.length) {
      setError(`Faltan variables: ${missing.join(', ')}`)
      return
    }
    if (!to.trim()) {
      setError('Destinatario requerido')
      return
    }

    let scheduledAt: string | undefined
    if (schedule) {
      if (!date || !time) {
        setError('Fecha y hora de programación requeridas')
        return
      }
      const dt = new Date(`${date}T${time}`)
      if (Number.isNaN(dt.getTime()) || dt <= new Date()) {
        setError('La fecha programada debe ser futura')
        return
      }
      scheduledAt = dt.toISOString()
    }

    setSending(true)
    try {
      await sendEmail({
        templateId: template.id,
        to: to.trim(),
        cc: cc.trim() || undefined,
        subject: subject.trim(),
        variables: vars,
        scheduledAt,
        attachments: files,
      })
      onSent()
    } catch (err) {
      setError(emailsErrorMessage(err))
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>Enviar: {template?.name}</SheetTitle>
          <SheetDescription>
            Completa variables y destinatario. Opcional: programar y adjuntos.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="space-y-1.5">
              <Label htmlFor="send-to">Para</Label>
              <Input
                id="send-to"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="send-cc">CC</Label>
              <Input
                id="send-cc"
                type="email"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="send-subject">Asunto</Label>
              <Input
                id="send-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
              />
            </div>

            {(template?.variables ?? []).map((v) => (
              <div key={v} className="space-y-1.5">
                <Label htmlFor={`var-${v}`}>[{v}]</Label>
                <Input
                  id={`var-${v}`}
                  value={vars[v] ?? ''}
                  onChange={(e) =>
                    setVars((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                  required
                />
              </div>
            ))}

            <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
              <Label htmlFor="send-schedule" className="cursor-pointer">
                Programar envío
              </Label>
              <input
                id="send-schedule"
                type="checkbox"
                className="size-4 cursor-pointer accent-primary"
                checked={schedule}
                onChange={(e) => setSchedule(e.target.checked)}
              />
            </div>
            {schedule && (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="send-date">Fecha *</Label>
                  <Input
                    id="send-date"
                    type="date"
                    required={schedule}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="send-time">Hora *</Label>
                  <Input
                    id="send-time"
                    type="time"
                    required={schedule}
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Adjuntos (máx {MAX_ATTACHMENTS} × 10MB)</Label>
              <div
                className={`rounded-md border border-dashed px-3 py-6 text-center text-sm transition-colors ${
                  dragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border text-muted-foreground'
                }`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragging(false)
                  if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
                }}
              >
                <Paperclip className="mx-auto mb-2 size-5 opacity-60" />
                <p>Arrastra archivos o</p>
                <label className="mt-1 inline-block cursor-pointer text-primary underline">
                  selecciona
                  <input
                    type="file"
                    className="sr-only"
                    multiple
                    onChange={(e) => {
                      if (e.target.files) addFiles(e.target.files)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
              {files.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {files.map((f, i) => (
                    <li
                      key={`${f.name}-${i}`}
                      className="flex items-center justify-between gap-2 rounded-md bg-muted px-2 py-1"
                    >
                      <span className="truncate">
                        {f.name} ({Math.round(f.size / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        className="cursor-pointer text-muted-foreground hover:text-foreground"
                        onClick={() =>
                          setFiles(files.filter((_, idx) => idx !== i))
                        }
                        aria-label={`Quitar ${f.name}`}
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Preview</Label>
              <iframe
                title="Preview envío"
                className="h-40 w-full rounded-md border border-border bg-white"
                srcDoc={previewHtml}
                sandbox=""
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={sending}>
              {sending
                ? 'Enviando…'
                : schedule
                  ? 'Programar'
                  : 'Enviar ahora'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
