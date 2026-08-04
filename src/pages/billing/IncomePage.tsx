import { useMemo } from 'react';
import { ReceiptEuro } from 'lucide-react';
import { createPayment, deletePayment, listPayments, updatePayment, type Payment, type PaymentInput } from '@/lib/billing';
import { LedgerListPage, type LedgerListConfig } from '@/pages/billing/LedgerListPage';
import { PaymentSheet } from '@/pages/billing/PaymentSheet';

export function IncomePage() {
    const config = useMemo<LedgerListConfig<Payment, PaymentInput>>(
        () => ({
            title: 'Ingresos',
            description: 'Facturas emitidas (ledger). Metadata de factura externa + PDF stub.',
            icon: ReceiptEuro,
            searchPlaceholder: 'Buscar referencia o nº factura…',
            searchAriaLabel: 'Buscar ingresos',
            addLabel: 'Añadir ingreso',
            emptyLabel: 'No hay ingresos. Añade el primero.',
            titleColumnHeader: 'Nº / Ref',
            deleteTitle: 'Eliminar ingreso',
            paginationAriaLabel: 'Paginación ingresos',
            successCreate: 'Pago creado',
            successUpdate: 'Pago actualizado',
            successDelete: 'Pago eliminado',
            list: listPayments,
            create: createPayment,
            update: updatePayment,
            remove: deletePayment,
            rowDate: (row) => row.invoiceDate,
            rowTitle: (row) => row.invoiceNumber || row.reference || `#${row.id}`,
            renderSheet: ({ open, mode, editing, onOpenChange, onSubmit }) => (
                <PaymentSheet open={open} mode={mode} payment={editing} onOpenChange={onOpenChange} onSubmit={onSubmit} />
            ),
        }),
        [],
    );

    return <LedgerListPage config={config} />;
}
