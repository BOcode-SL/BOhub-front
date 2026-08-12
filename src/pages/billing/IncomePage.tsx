import { useMemo } from 'react';
import { ReceiptEuro } from 'lucide-react';
import { createPayment, deletePayment, listPayments, updatePayment, type Payment, type PaymentInput } from '@/lib/billing';
import { LedgerListPage, type LedgerListConfig } from '@/pages/billing/LedgerListPage';
import { PaymentSheet } from '@/pages/billing/PaymentSheet';

export function IncomePage() {
    const config = useMemo<LedgerListConfig<Payment, PaymentInput>>(
        () => ({
            title: 'Ingresos',
            description: 'Borradores y facturas emitidas del periodo.',
            icon: ReceiptEuro,
            searchPlaceholder: 'Buscar concepto o nº factura…',
            searchAriaLabel: 'Buscar ingresos',
            addLabel: 'Añadir ingreso',
            emptyLabel: 'No hay ingresos. Añade el primero.',
            deleteTitle: 'Eliminar ingreso',
            paginationAriaLabel: 'Paginación ingresos',
            successCreate: 'Ingreso creado',
            successUpdate: 'Ingreso actualizado',
            successDelete: 'Ingreso eliminado',
            invoiceActions: true,
            list: listPayments,
            create: createPayment,
            update: updatePayment,
            remove: deletePayment,
            rowDate: (row) => row.invoiceDate,
            renderSheet: ({ open, mode, editing, onOpenChange, onSubmit, onReload }) => (
                <PaymentSheet
                    open={open}
                    mode={mode}
                    payment={editing}
                    onOpenChange={onOpenChange}
                    onSubmit={onSubmit}
                    onEmitted={() => onReload()}
                />
            ),
        }),
        [],
    );

    return <LedgerListPage config={config} />;
}
