import {
    createFileRoute,
    Link,
    redirect,
    useRouter,
} from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { signUp } from '../features/auth/auth-service';

export const Route = createFileRoute('/signup')({
    beforeLoad: ({ context }) => {
        if (context.session) {
            throw redirect({ to: '/' });
        }
    },
    component: SignupPage,
});

function SignupPage() {
    const router = useRouter();
    const signUpFn = useServerFn(signUp);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');
        setPasswordError('');

        const form = e.currentTarget;
        const fullName = (
            form.elements.namedItem('fullName') as HTMLInputElement
        ).value;
        const email = (form.elements.namedItem('email') as HTMLInputElement)
            .value;
        const password = (
            form.elements.namedItem('password') as HTMLInputElement
        ).value;
        const confirmPassword = (
            form.elements.namedItem('confirmPassword') as HTMLInputElement
        ).value;

        if (password !== confirmPassword) {
            setPasswordError('Passwords do not match');
            return;
        }

        setLoading(true);
        try {
            await signUpFn({ data: { fullName, email, password } });
            await router.invalidate();
            router.navigate({ to: '/' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md rise-in">
                {/* Logo mark */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-12 h-12 rounded-2xl bg-(--lagoon-deep) shadow-lg shadow-emerald-900/20 flex items-center justify-center mb-4">
                        <span className="w-3 h-3 rounded-full bg-white/80 shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
                    </div>
                    <h1 className="text-2xl font-black text-(--sea-ink) tracking-tight">
                        Create your account
                    </h1>
                    <p className="text-sm text-(--sea-ink-soft) mt-1">
                        Get started with Metrotech Interportal
                    </p>
                </div>

                <div className="island-shell rounded-2xl p-8">
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col gap-5"
                    >
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="fullName" className="island-kicker">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                required
                                autoComplete="name"
                                placeholder="John Doe"
                                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="email" className="island-kicker">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                autoComplete="email"
                                placeholder="you@company.com"
                                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm"
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
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm"
                            />
                        </div>

                        <div className="flex flex-col gap-1.5">
                            <label
                                htmlFor="confirmPassword"
                                className="island-kicker"
                            >
                                Confirm Password
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                autoComplete="new-password"
                                placeholder="••••••••"
                                className="w-full px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm"
                            />
                        </div>

                        {passwordError && (
                            <div className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium">
                                {passwordError}
                            </div>
                        )}

                        {error && (
                            <div className="px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            id="signup-submit"
                            type="submit"
                            disabled={loading}
                            className="w-full py-2.5 rounded-xl bg-(--lagoon-deep) text-white font-black text-sm shadow-lg shadow-emerald-900/15 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Creating account…' : 'Create Account'}
                        </button>
                    </form>

                    <p className="text-center text-sm text-(--sea-ink-soft) mt-6">
                        Already have an account?{' '}
                        <Link
                            to="/login"
                            className="font-bold text-(--lagoon-deep) hover:underline"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
