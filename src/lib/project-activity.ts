/** event → Spanish label for project timeline (imports often store action as message). */
export const PROJECT_ACTIVITY_EVENT_LABELS: Record<string, string> = {
    created: 'Proyecto creado',
    updated: 'Proyecto actualizado',
    hour_created: 'Hora registrada',
    hour_updated: 'Hora actualizada',
    hour_deleted: 'Hora eliminada',
    expense_created: 'Gasto creado',
    expense_updated: 'Gasto actualizado',
    expense_deleted: 'Gasto eliminado',
    expense_added: 'Gasto creado', // alias import
    payment_created: 'Pago creado',
    payment_updated: 'Pago actualizado',
    payment_deleted: 'Pago eliminado',
    jira_linked: 'Issue Jira vinculado',
    jira_created: 'Tarea Jira creada',
    jira_unlinked: 'Issue Jira desvinculado',
    jira_sync: 'Sincronizado desde Jira',
};

/** Raw import keys look like snake_case events, not full phrases. */
const SNAKE_CASE_KEY = /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/i;

export function formatProjectActivityMessage(
    event?: string | null,
    message?: string | null,
): string {
    const ev = (event ?? '').trim();
    const msg = (message ?? '').trim();
    const label = ev ? PROJECT_ACTIVITY_EVENT_LABELS[ev] : undefined;
    // empty / equals event / snake_case key → label; else keep rich native message
    if (!msg || (ev && msg === ev) || SNAKE_CASE_KEY.test(msg)) {
        return label ?? (msg || ev);
    }
    return msg;
}
