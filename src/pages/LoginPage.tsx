import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '@/components/form-field';
import { useAuth } from '../auth/AuthContext';
import { ApiError, flattenFieldErrors } from '../lib/api';
import { toastError } from '@/lib/toast';
import { homePathForRole } from '@/lib/users';
import { cn } from '@/lib/utils';

const loginInputClass =
    'h-12 w-full rounded-md border border-border bg-background/50 px-3 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20 aria-invalid:border-destructive aria-invalid:ring-destructive/20';

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const emailId = useId();
    const passwordId = useId();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    function clearFieldError(key: string) {
        setFieldErrors((prev) => {
            if (!prev[key]) return prev;
            const { [key]: _, ...rest } = prev;
            return rest;
        });
    }

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        const local: Record<string, string> = {};
        if (!email.trim()) local.email = 'El email es obligatorio.';
        if (!password) local.password = 'La contraseña es obligatoria.';
        if (Object.keys(local).length > 0) {
            setFieldErrors(local);
            return;
        }
        setFieldErrors({});
        setSubmitting(true);

        try {
            const authed = await login(email.trim(), password);
            navigate(homePathForRole(authed.role), { replace: true });
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                toastError('Credenciales inválidas. Revisa email y contraseña.');
            } else if (err instanceof ApiError && err.fieldErrors) {
                setFieldErrors(flattenFieldErrors(err.fieldErrors));
                toastError(err);
            } else {
                toastError(err, 'No se pudo iniciar sesión.');
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(45deg,var(--primary)_1px,transparent_1px),linear-gradient(-45deg,var(--primary)_1px,transparent_1px)] bg-size-[30px_30px] opacity-[0.03]"
            />

            <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute top-1/4 left-1/4 size-96 rounded-full bg-primary opacity-5 mix-blend-screen blur-3xl motion-safe:animate-pulse" />
                <div
                    className="absolute right-1/4 bottom-1/4 size-96 rounded-full bg-primary opacity-5 mix-blend-screen blur-3xl motion-safe:animate-pulse"
                    style={{ animationDelay: '2s' }}
                />
            </div>

            <section className="relative z-10 w-full max-w-md overflow-hidden rounded-xl border border-primary/10 bg-card/80 shadow-2xl backdrop-blur-xl">
                <div
                    aria-hidden
                    className="absolute top-0 right-0 left-0 h-px bg-linear-to-r from-transparent via-primary/20 to-transparent"
                />
                <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/5 via-transparent to-transparent"
                />

                <header className="relative space-y-6 pt-10 pb-2 text-center">
                    <div className="relative mx-auto flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-primary shadow-xl">
                        <Zap className="relative z-10 size-10 text-primary-foreground" strokeWidth={2.5} />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight text-primary">BOhub</h1>
                        <p className="text-sm font-medium text-muted-foreground">by BOcode</p>
                    </div>
                </header>

                <form onSubmit={onSubmit} noValidate className="relative space-y-6 px-6 pt-6 pb-8 sm:px-8">
                    <div className="space-y-5">
                        <FormField
                            id={emailId}
                            label="Correo electrónico"
                            error={fieldErrors.email}
                            labelClassName="text-sm font-semibold tracking-wide text-primary"
                        >
                            <input
                                id={emailId}
                                name="email"
                                type="email"
                                autoComplete="username"
                                required
                                maxLength={255}
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    clearFieldError('email');
                                }}
                                placeholder="tu@email.com"
                                className={loginInputClass}
                                aria-invalid={!!fieldErrors.email}
                            />
                        </FormField>

                        <FormField
                            id={passwordId}
                            label="Contraseña"
                            error={fieldErrors.password}
                            labelClassName="text-sm font-semibold tracking-wide text-primary"
                        >
                            <div className="relative">
                                <input
                                    id={passwordId}
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        clearFieldError('password');
                                    }}
                                    placeholder="••••••••"
                                    className={cn(loginInputClass, 'pr-12')}
                                    aria-invalid={!!fieldErrors.password}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    className="absolute top-1/2 right-3 z-10 -translate-y-1/2 cursor-pointer text-muted-foreground transition-colors duration-200 hover:text-primary"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </FormField>
                    </div>

                    <button
                        type="submit"
                        disabled={submitting}
                        className="group relative w-full cursor-pointer overflow-hidden rounded-xl bg-primary py-3 font-semibold text-primary-foreground shadow-xl shadow-primary/20 transition-all duration-300 hover:bg-primary-hover hover:shadow-2xl hover:shadow-primary/30 hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                    >
                        {submitting ? (
                            <span className="relative z-10 flex items-center justify-center">
                                <span className="mr-3 size-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                                Iniciando sesión...
                            </span>
                        ) : (
                            <span className="relative z-10 flex items-center justify-center">
                                Iniciar sesión
                                <LogIn className="ml-2 size-4" strokeWidth={2.5} />
                            </span>
                        )}
                    </button>
                </form>
            </section>
        </main>
    );
}
