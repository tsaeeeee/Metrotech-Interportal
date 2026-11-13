import {
    createFileRoute,
    redirect,
    useRouter,
} from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { login } from '../features/auth/auth-service';

export const Route = createFileRoute('/login')({
    beforeLoad: ({ context }) => {
        if (context.session) {
            throw redirect({ to: '/' });
        }
    },
    component: LoginPage,
});

function LoginPage() {
    const router = useRouter();
    const loginFn = useServerFn(login);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const form = e.currentTarget;
        const username = (form.elements.namedItem('username') as HTMLInputElement)
            .value;
        const password = (
            form.elements.namedItem('password') as HTMLInputElement
        ).value;

        try {
            const result = await loginFn({ data: { username, password } });
            await router.invalidate();
            await router.navigate({ to: result.mustChangePassword ? '/change-password' : '/' });
        } catch (err) {
            setError(
                err instanceof Error ? err.message : 'Something went wrong',
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md rise-in">
                <div className="flex flex-col items-center mb-7">
                    <img src="/assets/metrotech-logo.webp" width={300} height={43} alt="Metrotech" className="auth-logo" />
                    <h1 className="text-2xl font-black text-(--sea-ink) tracking-tight">
                        Welcome back
                    </h1>
                    <p className="text-sm text-(--sea-ink-soft) mt-1">
                        Sign in to Metrotech DCIM
                    </p>
                </div>

                <div className="island-shell auth-panel rounded-2xl p-8">
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-5"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="username" className="island-kicker">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                required
                                autoComplete="username"
                                placeholder="Administrator"
                                className="asset-control"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="password" className="island-kicker">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                autoComplete="current-password"
                                placeholder="••••••••"
                                className="asset-control"
                            />
                        </div>

                        {error && (
                            <div className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            id="login-submit"
                            type="submit"
                            disabled={loading}
                            className="auth-submit"
                        >
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </div>
            </div>
        </main>
    );
}
