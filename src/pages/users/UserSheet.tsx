import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { USER_ROLES, USER_ROLE_LABELS, userErrorMessage, type HubUser, type UserInput, type UserRole } from '@/lib/users';

const emptyForm: UserInput = {
    name: '',
    email: '',
    password: '',
    role: 'employee',
    avatarUrl: '',
};

function toForm(u: HubUser): UserInput {
    return {
        name: u.name,
        email: u.email,
        password: '',
        role: u.role,
        avatarUrl: u.avatarUrl ?? '',
    };
}

type UserSheetProps = {
    open: boolean;
    mode: 'add' | 'edit';
    user: HubUser | null;
    onOpenChange: (open: boolean) => void;
    onSubmit: (data: UserInput) => Promise<void>;
};

export function UserSheet({ open, mode, user, onOpenChange, onSubmit }: UserSheetProps) {
    const [form, setForm] = useState<UserInput>(emptyForm);
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setError(null);
        setPasswordConfirm('');
        setForm(mode === 'edit' && user ? toForm(user) : emptyForm);
    }, [open, mode, user]);

    function setField<K extends keyof UserInput>(key: K, value: UserInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError(null);

        const pwd = form.password ?? '';
        if (mode === 'add' || pwd.length > 0) {
            if (pwd.length < 8) {
                setError('La contraseña debe tener al menos 8 caracteres.');
                return;
            }
        }
        if ((mode === 'add' || pwd.length > 0) && pwd !== passwordConfirm) {
            setError('Las contraseñas no coinciden.');
            return;
        }

        setSaving(true);
        try {
            const payload: UserInput = {
                name: form.name.trim(),
                email: form.email.trim(),
                role: form.role,
                avatarUrl: form.avatarUrl?.toString().trim() || null,
            };
            if (mode === 'add' || pwd.length > 0) {
                payload.password = pwd;
            }
            await onSubmit(payload);
            onOpenChange(false);
        } catch (err) {
            setError(userErrorMessage(err));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                    <SheetTitle>{mode === 'add' ? 'Añadir usuario' : 'Editar usuario'}</SheetTitle>
                    <SheetDescription>Cuenta interna de BOhub (rol y acceso).</SheetDescription>
                </SheetHeader>

                <form id="user-form" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 px-4">
                    <div className="space-y-2">
                        <Label htmlFor="user-name">Nombre *</Label>
                        <Input
                            id="user-name"
                            required
                            maxLength={255}
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="user-email">Email *</Label>
                        <Input
                            id="user-email"
                            type="email"
                            required
                            maxLength={255}
                            value={form.email}
                            onChange={(e) => setField('email', e.target.value)}
                            className="bg-background"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="user-password">Contraseña {mode === 'add' ? '*' : '(opcional)'}</Label>
                        <Input
                            id="user-password"
                            type="password"
                            required={mode === 'add'}
                            minLength={8}
                            value={form.password ?? ''}
                            onChange={(e) => setField('password', e.target.value)}
                            className="bg-background"
                            autoComplete="new-password"
                        />
                    </div>
                    {(mode === 'add' || (form.password?.length ?? 0) > 0) && (
                        <div className="space-y-2">
                            <Label htmlFor="user-password-confirm">Confirmar contraseña *</Label>
                            <Input
                                id="user-password-confirm"
                                type="password"
                                required
                                minLength={8}
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                className="bg-background"
                                autoComplete="new-password"
                            />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor="user-role">Rol *</Label>
                        <select
                            id="user-role"
                            value={form.role}
                            onChange={(e) => setField('role', e.target.value as UserRole)}
                            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            {USER_ROLES.map((r) => (
                                <option key={r} value={r}>
                                    {USER_ROLE_LABELS[r]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="user-avatar">URL avatar</Label>
                        <Input
                            id="user-avatar"
                            type="url"
                            maxLength={2048}
                            value={form.avatarUrl ?? ''}
                            onChange={(e) => setField('avatarUrl', e.target.value)}
                            placeholder="https://…"
                            className="bg-background"
                        />
                    </div>

                    {error && (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    )}
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
                    <Button type="submit" form="user-form" className="cursor-pointer" disabled={saving}>
                        {saving ? 'Guardando…' : mode === 'add' ? 'Crear' : 'Guardar'}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
