import { Settings } from 'lucide-react';
import { ListPageShell } from '@/components/list-page-shell';

/** Placeholder — settings UI TBD. */
export function SettingsPage() {
    return (
        <ListPageShell title="Configuración" description="Ajustes de la cuenta y del hub." icon={Settings}>
            <p className="text-sm text-muted-foreground">Próximamente.</p>
        </ListPageShell>
    );
}
