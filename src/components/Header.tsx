import { Link, useRouteContext, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { LogOut, ShieldCheck } from 'lucide-react';
import { logout } from '../features/auth/auth-service';
import ThemeToggle from './ThemeToggle';

export default function Header() {
    const { session } = useRouteContext({ from: '__root__' });
    const router = useRouter();
    const logoutFn = useServerFn(logout);

    const handleLogout = async () => {
        await logoutFn();
        await router.invalidate();
    };

    return (
        <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) backdrop-blur-xl">
            <nav className="page-wrap flex min-h-15 items-center gap-3">
                <Link
                    to="/"
                    className="flex items-center gap-3 no-underline text-(--sea-ink)"
                >
                    <div className="w-8 h-8 rounded-lg bg-(--sea-ink) text-white dark:bg-(--sea-teal) dark:text-zinc-950 flex items-center justify-center shadow-sm">
                        <ShieldCheck size={16} />
                    </div>
                    <div className="hidden sm:flex flex-col leading-none">
                        <span className="text-sm font-extrabold tracking-tight">
                            Metrotech DCIM
                        </span>
                        <span className="text-[9px] uppercase tracking-[0.16em] text-(--sea-ink-soft) mt-1">
                            Infrastructure Portal
                        </span>
                    </div>
                </Link>

                <div className="h-6 w-px bg-(--line) hidden sm:block" />

                <div className="flex items-center gap-1">
                    <Link
                        to="/"
                        className="nav-link text-xs font-bold"
                        activeOptions={{ exact: true }}
                        activeProps={{ className: 'nav-link is-active text-xs font-bold' }}
                    >
                        Datacenters
                    </Link>
                    <Link
                        to="/about"
                        className="nav-link text-xs font-bold"
                        activeProps={{ className: 'nav-link is-active text-xs font-bold' }}
                    >
                        About
                    </Link>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <ThemeToggle />
                    {session ? (
                        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-(--line)">
                            <div className="text-right leading-tight">
                                <div className="text-xs font-bold text-(--sea-ink)">
                                    {session.user.fullName}
                                </div>
                                <div className="text-[9px] text-(--sea-ink-soft)">
                                    {session.user.email}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="w-8 h-8 rounded-lg border border-(--line) bg-(--surface) text-(--sea-ink-soft) hover:text-red-500 hover:border-red-500/30 flex items-center justify-center"
                                title="Log out"
                                aria-label="Log out"
                            >
                                <LogOut size={14} />
                            </button>
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            className="nav-link text-xs font-bold"
                            activeProps={{
                                className: 'nav-link is-active text-xs font-bold',
                            }}
                        >
                            Log In
                        </Link>
                    )}
                </div>
            </nav>
        </header>
    );
}
