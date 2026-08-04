import { useEffect, useState, type FormEvent } from 'react';
import { Settings } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListPageShell } from '@/components/list-page-shell';
import { ApiError, flattenFieldErrors, updatePassword, updateProfile } from '@/lib/api';
import { toastError, toastSuccess } from '@/lib/toast';

export function SettingsPage() {
    const { user, refreshMe } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
    const [profileSaving, setProfileSaving] = useState(false);

    const [currentPassword, setCurrentPassword] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirmation, setPasswordConfirmation] = useState('');
    const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
    const [passwordSaving, setPasswordSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        setName(user.name);
        setEmail(user.email);
        setAvatarUrl(user.avatarUrl ?? '');
        setProfileErrors({});
        setCurrentPassword('');
        setPassword('');
        setPasswordConfirmation('');
        setPasswordErrors({});
    }, [user]);

    function clearProfileError(key: string) {
        setProfileErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    function clearPasswordError(key: string) {
        setPasswordErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    async function handleProfileSubmit(e: FormEvent) {
        e.preventDefault();
        if (!name.trim()) {
            setProfileErrors({ name: 'El nombre es obligatorio.' });
            return;
        }
        if (!email.trim()) {
            setProfileErrors({ email: 'El email es obligatorio.' });
            return;
        }
        setProfileSaving(true);
        try {
            await updateProfile({
                name: name.trim(),
                email: email.trim(),
                avatarUrl: avatarUrl.trim() || null,
            });
            await refreshMe();
            toastSuccess('Perfil actualizado');
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setProfileErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setProfileSaving(false);
        }
    }

    async function handlePasswordSubmit(e: FormEvent) {
        e.preventDefault();
        if (!currentPassword) {
            setPasswordErrors({ currentPassword: 'La contraseña actual es obligatoria.' });
            return;
        }
        if (!password) {
            setPasswordErrors({ password: 'La nueva contraseña es obligatoria.' });
            return;
        }
        if (password !== passwordConfirmation) {
            setPasswordErrors({ passwordConfirmation: 'Las contraseñas no coinciden.' });
            return;
        }
        setPasswordSaving(true);
        try {
            await updatePassword({ currentPassword, password, passwordConfirmation });
            setCurrentPassword('');
            setPassword('');
            setPasswordConfirmation('');
            setPasswordErrors({});
            toastSuccess('Contraseña actualizada');
        } catch (err) {
            if (err instanceof ApiError && err.fieldErrors) {
                setPasswordErrors(flattenFieldErrors(err.fieldErrors));
            }
            toastError(err);
        } finally {
            setPasswordSaving(false);
        }
    }

    return (
        <ListPageShell title="Configuración" description="Ajustes de la cuenta y del hub." icon={Settings}>
            <div className="flex max-w-lg flex-col gap-8">
                <form onSubmit={(e) => void handleProfileSubmit(e)} noValidate className="flex flex-col gap-4">
                    <h2 className="text-sm font-medium text-foreground">Perfil</h2>
                    <FormField id="settings-name" label="Nombre *" error={profileErrors.name}>
                        <Input
                            id="settings-name"
                            required
                            maxLength={255}
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                clearProfileError('name');
                            }}
                            className="bg-background"
                            aria-invalid={!!profileErrors.name}
                        />
                    </FormField>
                    <FormField id="settings-email" label="Email *" error={profileErrors.email}>
                        <Input
                            id="settings-email"
                            type="email"
                            required
                            maxLength={255}
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                clearProfileError('email');
                            }}
                            className="bg-background"
                            aria-invalid={!!profileErrors.email}
                        />
                    </FormField>
                    <FormField id="settings-avatar" label="URL avatar" error={profileErrors.avatarUrl}>
                        <Input
                            id="settings-avatar"
                            type="url"
                            maxLength={2048}
                            value={avatarUrl}
                            onChange={(e) => {
                                setAvatarUrl(e.target.value);
                                clearProfileError('avatarUrl');
                            }}
                            placeholder="https://…"
                            className="bg-background"
                            aria-invalid={!!profileErrors.avatarUrl}
                        />
                    </FormField>
                    <Button type="submit" className="w-fit cursor-pointer" disabled={profileSaving}>
                        {profileSaving ? 'Guardando…' : 'Guardar perfil'}
                    </Button>
                </form>

                <form onSubmit={(e) => void handlePasswordSubmit(e)} noValidate className="flex flex-col gap-4 border-t border-border pt-8">
                    <h2 className="text-sm font-medium text-foreground">Contraseña</h2>
                    <FormField id="settings-current-password" label="Contraseña actual *" error={passwordErrors.currentPassword}>
                        <Input
                            id="settings-current-password"
                            type="password"
                            autoComplete="current-password"
                            value={currentPassword}
                            onChange={(e) => {
                                setCurrentPassword(e.target.value);
                                clearPasswordError('currentPassword');
                            }}
                            className="bg-background"
                            aria-invalid={!!passwordErrors.currentPassword}
                        />
                    </FormField>
                    <FormField id="settings-password" label="Nueva contraseña *" error={passwordErrors.password}>
                        <Input
                            id="settings-password"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={password}
                            onChange={(e) => {
                                setPassword(e.target.value);
                                clearPasswordError('password');
                            }}
                            className="bg-background"
                            aria-invalid={!!passwordErrors.password}
                        />
                    </FormField>
                    <FormField
                        id="settings-password-confirm"
                        label="Confirmar contraseña *"
                        error={passwordErrors.passwordConfirmation}
                    >
                        <Input
                            id="settings-password-confirm"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            value={passwordConfirmation}
                            onChange={(e) => {
                                setPasswordConfirmation(e.target.value);
                                clearPasswordError('passwordConfirmation');
                            }}
                            className="bg-background"
                            aria-invalid={!!passwordErrors.passwordConfirmation}
                        />
                    </FormField>
                    <Button type="submit" className="w-fit cursor-pointer" disabled={passwordSaving}>
                        {passwordSaving ? 'Guardando…' : 'Cambiar contraseña'}
                    </Button>
                </form>
            </div>
        </ListPageShell>
    );
}
