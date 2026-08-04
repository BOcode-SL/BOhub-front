import { Banknote } from 'lucide-react';
import { LedgerListPage, type LedgerListConfig, type LedgerRowBase } from '@/pages/billing/LedgerListPage';
import {
    createPayroll,
    deletePayroll,
    formatMoney,
    listPayrolls,
    updatePayroll,
    type BillingMeta,
    type Payroll,
    type PayrollInput,
} from '@/lib/billing';
import { PayrollSheet } from '@/pages/billing/PayrollSheet';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

type PayrollRow = Payroll & LedgerRowBase;

async function listPayrollRows(
    params: {
        search?: string;
        page?: number;
        perPage?: number;
        status?: string;
    },
    signal?: AbortSignal,
): Promise<{ data: PayrollRow[]; meta: BillingMeta }> {
    const res = await listPayrolls(
        {
            search: params.search,
            page: params.page,
            perPage: params.perPage,
        },
        signal,
    );
    return {
        data: res.data.map((p) => ({
            ...p,
            totalAmount: p.totalCost ?? p.baseSalary,
            invoiceUrl: null,
        })),
        meta: res.meta,
    };
}

const config: LedgerListConfig<PayrollRow, PayrollInput> = {
    title: 'Nóminas',
    description: 'Gestión de nóminas de empleados.',
    icon: Banknote,
    searchPlaceholder: 'Buscar nóminas…',
    searchAriaLabel: 'Buscar nóminas',
    addLabel: 'Añadir nómina',
    emptyLabel: 'No hay nóminas',
    titleColumnHeader: 'Empleado',
    deleteTitle: '¿Eliminar nómina?',
    paginationAriaLabel: 'Paginación nóminas',
    successCreate: 'Nómina creada',
    successUpdate: 'Nómina actualizada',
    successDelete: 'Nómina eliminada',
    list: listPayrollRows,
    create: createPayroll,
    update: updatePayroll,
    remove: deletePayroll,
    rowDate: (row) => {
        const label = MONTH_LABELS[row.month - 1] || String(row.month);
        return `${label} ${row.year}`;
    },
    rowTitle: (row) => (
        <div className="flex flex-col gap-0.5">
            <span>{row.employeeName}</span>
            <span className="text-xs text-muted-foreground">
                {formatMoney(row.totalCost ?? row.baseSalary)} coste · {formatMoney(row.netSalary)} neto
            </span>
        </div>
    ),
    renderSheet: (props) => <PayrollSheet {...props} />,
};

export function PayrollsPage() {
    return <LedgerListPage config={config} />;
}
