import { Link, useRouteContext, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Database, LogOut, ShieldCheck } from 'lucide-react';
import { logout } from '../features/auth/auth-service';
import ThemeToggle from './ThemeToggle';

function initials(name: string) {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('');
}

export default function Header() {
    const { session } = useRouteContext({ from: '__root__' });
    const router = useRouter();
    const logoutFn = useServerFn(logout);

    const handleLogout = async () => {
        await logoutFn();
        await router.invalidate();
        router.navigate({ to: '/login' });
    };

    return (
        <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) backdrop-blur-xl">
            <nav className="mx-auto flex h-15 w-full max-w-[1920px] items-center gap-3 px-4 md:px-8">
                <Link
                    to="/"
                    className="group inline-flex min-w-0 items-center gap-3 text-(--sea-ink) no-underline"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-(--chip-line) bg-(--chip-bg) shadow-sm">
                        <Database
                            size={17}
                            className="text-(--lagoon-deep)"
                        />
                    </span>
                    <span className="hidden min-w-0 sm:block">
                        <span className="block truncate text-sm font-extrabold tracking-tight">
                            Metrotech Interportal
                        </span>
                        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-(--sea-ink-soft)">
                            <ShieldCheck size={10} />
                            DCIM Console
                        </span>
                    </span>
                </Link>

                <div className="ml-2 hidden items-center gap-1 md:flex">
                    <Link
                        to="/"
                        className="app-nav-link"
                        activeProps={{ className: 'app-nav-link is-active' }}
                        activeOptions={{ exact: true }}
                    >
                        Datacenters
                    </Link>
                    <Link
                        to="/about"
                        className="app-nav-link"
                        activeProps={{ className: 'app-nav-link is-active' }}
                    >
                        About
                    </Link>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    <ThemeToggle />

                    {session ? (
                        <>
                            <div className="hidden h-7 w-px bg-(--line) sm:block" />
                            <div className="hidden items-center gap-2 sm:flex">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-(--lagoon-deep)/10 text-[10px] font-black text-(--lagoon-deep)">
                                    {initials(session.user.fullName)}
                                </div>
                                <div className="hidden max-w-40 lg:block">
                                    <div className="truncate text-xs font-bold text-(--sea-ink)">
                                        {session.user.fullName}
                                    </div>
                                    <div className="truncate text-[9px] text-(--sea-ink-soft)">
                                        {session.user.email}
                                    </div>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2 text-[11px] font-bold text-(--sea-ink-soft) hover:border-red-200 hover:bg-red-50 hover:text-red-600 dark:hover:border-red-900/50 dark:hover:bg-red-950/30"
                                title="Log out"
                            >
                                <LogOut size={13} />
                                <span className="hidden lg:inline">Log out</span>
                            </button>
                        </>
                    ) : (
                        <Link
                            to="/login"
                            className="rounded-lg bg-(--lagoon-deep) px-3 py-1.5 text-xs font-bold text-white no-underline hover:brightness-105"
                        >
                            Log in
                        </Link>
                    )}
                </div>
            </nav>
        </header>
    );
}
