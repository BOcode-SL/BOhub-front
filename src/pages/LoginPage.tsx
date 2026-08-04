import { useId, useState, type FormEvent } from 'react';
import { Eye, EyeOff, LogIn, Zap } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../lib/api';
import { toastError } from '@/lib/toast';
import { homePathForRole } from '@/lib/users';

export function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const emailId = useId();
    const passwordId = useId();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setSubmitting(true);

        try {
            const authed = await login(email.trim(), password);
            navigate(homePathForRole(authed.role), { replace: true });
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                toastError('Credenciales inválidas. Revisa email y contraseña.');
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

                <form onSubmit={onSubmit} className="relative space-y-6 px-6 pt-6 pb-8 sm:px-8">
                    <div className="space-y-5">
                        <div className="space-y-2">
                            <label htmlFor={emailId} className="text-sm font-semibold tracking-wide text-primary">
                                Correo electrónico
                            </label>
                            <input
                                id={emailId}
                                name="email"
                                type="email"
                                autoComplete="username"
                                required
                                maxLength={255}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="h-12 w-full rounded-md border border-border bg-background/50 px-3 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor={passwordId} className="text-sm font-semibold tracking-wide text-primary">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    id={passwordId}
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="h-12 w-full rounded-md border border-border bg-background/50 px-3 pr-12 text-foreground outline-none transition-all duration-300 placeholder:text-muted-foreground/50 focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                        </div>
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
