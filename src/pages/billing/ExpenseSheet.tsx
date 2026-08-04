import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  LEDGER_STATUSES,
  LEDGER_STATUS_LABELS,
  billingErrorMessage,
  calcTotal,
  getExpense,
  type Expense,
  type ExpenseInput,
  type LedgerStatus,
} from '@/lib/billing'
import { listProjectOptions } from '@/lib/projects'

const selectClass =
  'h-9 w-full cursor-pointer rounded-md border border-border bg-card px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/40'

type ProjectOpt = { id: number; name: string }

const empty: ExpenseInput = {
  projectId: null,
  description: '',
  recipient: '',
  category: '',
  baseAmount: '',
  ivaRate: 21,
  irpfRate: 0,
  status: 'pending',
  expenseDate: '',
  paymentDate: '',
  notes: '',
  invoiceUrl: '',
  fileName: '',
}

function toForm(e: Expense): ExpenseInput {
  return {
    projectId: e.projectId,
    description: e.description,
    recipient: e.recipient ?? '',
    category: e.category ?? '',
    baseAmount: e.baseAmount ?? '',
    ivaRate: e.ivaRate ?? 21,
    irpfRate: e.irpfRate ?? 0,
    status: e.status,
    expenseDate: e.expenseDate ?? '',
    paymentDate: e.paymentDate ?? '',
    notes: e.notes ?? '',
    invoiceUrl: e.invoiceUrl ?? '',
    fileName: e.fileName ?? '',
  }
}

type Props = {
  open: boolean
  mode: 'add' | 'edit'
  expense: Expense | null
  onOpenChange: (open: boolean) => void
  onSubmit: (data: ExpenseInput) => Promise<void>
}

export function ExpenseSheet({
  open,
  mode,
  expense,
  onOpenChange,
  onSubmit,
}: Props) {
  const [form, setForm] = useState<ExpenseInput>(empty)
  const [projects, setProjects] = useState<ProjectOpt[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void listProjectOptions().then((rows) => {
      if (!cancelled) setProjects(rows)
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setError(null)
    if (mode !== 'edit' || !expense) {
      setForm(empty)
      return
    }
    setForm(toForm(expense))
    if (expense.baseAmount !== undefined) return
    let cancelled = false
    void getExpense(expense.id)
      .then((full) => {
        if (!cancelled) setForm(toForm(full))
      })
      .catch((err) => {
        if (!cancelled) setError(billingErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
  }, [open, mode, expense])

  function setField<K extends keyof ExpenseInput>(key: K, value: ExpenseInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const preview = calcTotal(
    Number(form.baseAmount) || 0,
    Number(form.ivaRate) || 0,
    Number(form.irpfRate) || 0,
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    try {
      await onSubmit({
        projectId: form.projectId || null,
        description: form.description.trim(),
        recipient: form.recipient?.toString().trim() || null,
        category: form.category?.toString().trim() || null,
        baseAmount: Number(form.baseAmount),
        ivaRate: Number(form.ivaRate) || 0,
        irpfRate: Number(form.irpfRate) || 0,
        status: form.status,
        expenseDate: form.expenseDate?.toString().trim() || null,
        paymentDate: form.paymentDate?.toString().trim() || null,
        notes: form.notes?.toString().trim() || null,
        invoiceUrl: form.invoiceUrl?.toString().trim() || null,
        fileName: form.fileName?.toString().trim() || null,
      })
      onOpenChange(false)
    } catch (err) {
      setError(billingErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {mode === 'add' ? 'Añadir gasto' : 'Editar gasto'}
          </SheetTitle>
          <SheetDescription>
            Factura recibida / gasto interno.
          </SheetDescription>
        </SheetHeader>

        <form
          id="expense-form"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4"
          onSubmit={(e) => void handleSubmit(e)}
        >
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
            >
              {error}
            </p>
          )}

          <div className="grid gap-2">
            <Label htmlFor="exp-desc">Descripción</Label>
            <Input
              id="exp-desc"
              required
              maxLength={255}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              className="bg-card"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="exp-recipient">Proveedor</Label>
              <Input
                id="exp-recipient"
                maxLength={255}
                value={form.recipient ?? ''}
                onChange={(e) => setField('recipient', e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-cat">Categoría</Label>
              <Input
                id="exp-cat"
                value={form.category ?? ''}
                onChange={(e) => setField('category', e.target.value)}
                maxLength={120}
                className="bg-card"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-project">Proyecto</Label>
            <select
              id="exp-project"
              value={form.projectId ?? ''}
              onChange={(e) =>
                setField(
                  'projectId',
                  e.target.value ? Number(e.target.value) : null,
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

          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="exp-base">Base</Label>
              <Input
                id="exp-base"
                type="number"
                step="0.01"
                min="0"
                required
                value={form.baseAmount}
                onChange={(e) => setField('baseAmount', e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-iva">IVA %</Label>
              <Input
                id="exp-iva"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={form.ivaRate}
                onChange={(e) => setField('ivaRate', e.target.value)}
                className="bg-card"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-irpf">IRPF %</Label>
              <Input
                id="exp-irpf"
                type="number"
                step="0.01"
                min={0}
                max={100}
                value={form.irpfRate}
                onChange={(e) => setField('irpfRate', e.target.value)}
                className="bg-card"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Total estimado: <span className="text-foreground">{preview.toFixed(2)} €</span>
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="exp-status">Estado</Label>
              <select
                id="exp-status"
                value={form.status}
                onChange={(e) =>
                  setField('status', e.target.value as LedgerStatus)
                }
                className={selectClass}
              >
                {LEDGER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {LEDGER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-date">Fecha gasto</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.expenseDate ?? ''}
                onChange={(e) => setField('expenseDate', e.target.value)}
                className="bg-card"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-pdf">URL factura (stub)</Label>
            <Input
              id="exp-pdf"
              value={form.invoiceUrl ?? ''}
              onChange={(e) => setField('invoiceUrl', e.target.value)}
              className="bg-card"
              placeholder="https://…"
              maxLength={500}
              type="url"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="exp-notes">Notas</Label>
            <Textarea
              id="exp-notes"
              value={form.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value)}
              rows={3}
              className="bg-card"
            />
          </div>
        </form>

        <SheetFooter>
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="expense-form"
            className="cursor-pointer"
            disabled={saving}
          >
            {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
