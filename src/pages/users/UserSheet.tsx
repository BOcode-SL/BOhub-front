import { useEffect, useState, type FormEvent } from 'react';
import { AppSelect } from '@/components/app-select';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    FormPanel,
    FormPanelDescription,
    FormPanelFooter,
    FormPanelHeader,
    FormPanelTitle,
} from '@/components/responsive-form-panel';
import { ApiError, flattenFieldErrors } from '@/lib/api';
import { USER_ROLES, USER_ROLE_LABELS, type HubUser, type UserInput, type UserRole } from '@/lib/users';
import { toastError } from '@/lib/toast';

const emptyForm: UserInput = {
    name: '',
    email: '',
    password: '',
    role: 'employee',
    avatarUrl: '',
    employeeName: '',
    dni: '',
    category: '',
};

function toForm(u: HubUser): UserInput {
    return {
        name: u.name,
        email: u.email,
        password: '',
        role: u.role,
        avatarUrl: u.avatarUrl ?? '',
        employeeName: u.employeeName ?? '',
        dni: u.dni ?? '',
        category: u.category ?? '',
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
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        setFieldErrors({});
        setPasswordConfirm('');
        setForm(mode === 'edit' && user ? toForm(user) : emptyForm);
    }, [open, mode, user]);

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function setField<K extends keyof UserInput>(key: K, value: UserInput[K]) {
        setForm((prev) => ({ ...prev, [key]: value }));
        clearFieldError(String(key));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();

        const pwd = form.password ?? '';
        if (mode === 'add' || pwd.length > 0) {
            if (pwd.length < 8) {
                toastError('La contraseña debe tener al menos 8 caracteres.');
                return;
            }
        }
        if ((mode === 'add' || pwd.length > 0) && pwd !== passwordConfirm) {
            toastError('Las contraseñas no coinciden.');
            return;
        }

        setSaving(true);
        try {
            const payload: UserInput = {
                name: form.name.trim(),
                email: form.email.trim(),
                role: form.role,
                avatarUrl: form.avatarUrl?.toString().trim() || null,
                employeeName: form.employeeName?.toString().trim() || null,
                dni: form.dni?.toString().trim() || null,
                category: form.category?.toString().trim() || null,
            };
            if (mode === 'add' || pwd.length > 0) {
                payload.password = pwd;
            }
            await onSubmit(payload);
            onOpenChange(false);
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setSaving(false);
        }
    }

    return (
        <FormPanel open={open} onOpenChange={onOpenChange} contentClassName="w-full overflow-y-auto sm:max-w-md">
                <FormPanelHeader>
                    <FormPanelTitle>{mode === 'add' ? 'Añadir usuario' : 'Editar usuario'}</FormPanelTitle>
                    <FormPanelDescription>Cuenta interna de BOhub (rol y acceso).</FormPanelDescription>
                </FormPanelHeader>

                <form id="user-form" noValidate onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 px-4">
                    <FormField id="user-name" label="Nombre *" error={fieldErrors.name}>
                        <Input
                            id="user-name"
                            required
                            maxLength={255}
                            value={form.name}
                            onChange={(e) => setField('name', e.target.value)}
                            aria-invalid={!!fieldErrors.name}
                            className="bg-background"
                        />
                    </FormField>
                    <FormField id="user-email" label="Email *" error={fieldErrors.email}>
                        <Input
                            id="user-email"
                            type="email"
                            required
                            maxLength={255}
                            value={form.email}
                            onChange={(e) => setField('email', e.target.value)}
                            aria-invalid={!!fieldErrors.email}
                            className="bg-background"
                        />
                    </FormField>
                    <FormField
                        id="user-password"
                        label={`Contraseña ${mode === 'add' ? '*' : '(opcional)'}`}
                        error={fieldErrors.password}
                    >
                        <Input
                            id="user-password"
                            type="password"
                            required={mode === 'add'}
                            minLength={8}
                            value={form.password ?? ''}
                            onChange={(e) => setField('password', e.target.value)}
                            aria-invalid={!!fieldErrors.password}
                            className="bg-background"
                            autoComplete="new-password"
                        />
                    </FormField>
                    {(mode === 'add' || (form.password?.length ?? 0) > 0) && (
                        <FormField id="user-password-confirm" label="Confirmar contraseña *">
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
                        </FormField>
                    )}
                    <FormField id="user-role" label="Rol *" error={fieldErrors.role}>
                        <AppSelect
                            id="user-role"
                            items={USER_ROLES.map((role) => ({
                                label: USER_ROLE_LABELS[role],
                                value: role,
                            }))}
                            value={form.role}
                            onValueChange={(value) => setField('role', value as UserRole)}
                            aria-invalid={!!fieldErrors.role}
                        />
                    </FormField>
                    <FormField id="user-avatar" label="URL avatar" error={fieldErrors.avatarUrl}>
                        <Input
                            id="user-avatar"
                            type="url"
                            maxLength={2048}
                            value={form.avatarUrl ?? ''}
                            onChange={(e) => setField('avatarUrl', e.target.value)}
                            placeholder="https://…"
                            aria-invalid={!!fieldErrors.avatarUrl}
                            className="bg-background"
                        />
                    </FormField>

                    <div className="space-y-2 border-t border-border pt-4">
                        <p className="text-sm font-medium text-foreground">Datos de nómina</p>
                        <p className="text-xs text-muted-foreground">Se usan al crear nóminas desde el selector de empleado.</p>
                    </div>
                    <FormField id="user-employee-name" label="Nombre empleado" error={fieldErrors.employeeName}>
                        <Input
                            id="user-employee-name"
                            maxLength={255}
                            value={form.employeeName ?? ''}
                            onChange={(e) => setField('employeeName', e.target.value)}
                            placeholder="Nombre y apellidos"
                            aria-invalid={!!fieldErrors.employeeName}
                            className="bg-background"
                        />
                    </FormField>
                    <FormField id="user-dni" label="DNI" error={fieldErrors.dni}>
                        <Input
                            id="user-dni"
                            maxLength={32}
                            value={form.dni ?? ''}
                            onChange={(e) => setField('dni', e.target.value)}
                            placeholder="99999999R"
                            aria-invalid={!!fieldErrors.dni}
                            className="bg-background"
                        />
                    </FormField>
                    <FormField id="user-category" label="Categoría" error={fieldErrors.category}>
                        <Input
                            id="user-category"
                            maxLength={120}
                            value={form.category ?? ''}
                            onChange={(e) => setField('category', e.target.value)}
                            placeholder="Categoría de nómina"
                            aria-invalid={!!fieldErrors.category}
                            className="bg-background"
                        />
                    </FormField>
                </form>

                <FormPanelFooter>
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
                </FormPanelFooter>
        </FormPanel>
    );
}
