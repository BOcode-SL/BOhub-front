import { useMemo } from 'react';
import { Receipt } from 'lucide-react';
import { createExpense, deleteExpense, listExpenses, updateExpense, type Expense, type ExpenseInput } from '@/lib/billing';
import { LedgerListPage, type LedgerListConfig } from '@/pages/billing/LedgerListPage';
import { ExpenseSheet } from '@/pages/billing/ExpenseSheet';

export function ExpensesPage() {
    const config = useMemo<LedgerListConfig<Expense, ExpenseInput>>(
        () => ({
            title: 'Gastos',
            description: 'Facturas recibidas y gastos del periodo.',
            icon: Receipt,
            searchPlaceholder: 'Buscar descripción o proveedor…',
            searchAriaLabel: 'Buscar gastos',
            addLabel: 'Añadir gasto',
            emptyLabel: 'No hay gastos. Añade el primero.',
            deleteTitle: 'Eliminar gasto',
            paginationAriaLabel: 'Paginación gastos',
            successCreate: 'Gasto creado',
            successUpdate: 'Gasto actualizado',
            successDelete: 'Gasto eliminado',
            list: listExpenses,
            create: createExpense,
            update: updateExpense,
            remove: deleteExpense,
            rowDate: (row) => row.expenseDate,
            renderSheet: ({ open, mode, editing, onOpenChange, onSubmit }) => (
                <ExpenseSheet open={open} mode={mode} expense={editing} onOpenChange={onOpenChange} onSubmit={onSubmit} />
            ),
        }),
        [],
    );

    return <LedgerListPage config={config} />;
}
