import { Link, useRouteContext, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { logout } from '../features/auth/auth-service';
import ThemeToggle from './ThemeToggle';

export default function Header() {
    const { session } = useRouteContext({ from: '__root__' });
    const router = useRouter();
    const logoutFn = useServerFn(logout);

    const handleLogout = async () => {
        await logoutFn();
        router.invalidate();
    };

    return (
        <header className="sticky top-0 z-50 border-b border-(--line) bg-(--header-bg) px-4 backdrop-blur-lg">
            <nav className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 py-3 sm:py-4">
                <h2 className="m-0 shrink-0 text-base font-semibold tracking-tight">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 rounded-full border border-(--chip-line) bg-[var(--chip-bg)] px-3 py-1.5 text-sm text-[var(--sea-ink)] no-underline shadow-[0_8px_24px_rgba(30,90,72,0.08)] sm:px-4 sm:py-2"
                    >
                        <span className="h-2.5 w-2.5 rounded-full bg-(--lagoon-deep) shadow-[0_0_8px_var(--lagoon)]" />
                        Metrotech Interportal
                    </Link>
                </h2>

                <div className="ml-auto flex items-center gap-1.5 sm:ml-0 sm:gap-2">
                    <ThemeToggle />
                </div>

                <div className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-1 pb-1 text-sm font-semibold sm:order-2 sm:w-auto sm:flex-nowrap sm:pb-0">
                    <Link
                        to="/about"
                        className="nav-link"
                        activeProps={{ className: 'nav-link is-active' }}
                    >
                        About
                    </Link>
                    {session ? (
                        <>
                            <span className="text-zinc-500 font-normal">|</span>
                            <span className="text-(--sea-ink)">
                                {session.user.fullName}
                            </span>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="ml-2 rounded-full px-3 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer"
                            >
                                Log Out
                            </button>
                        </>
                    ) : (
                        <Link
                            to="/login"
                            className="nav-link"
                            activeProps={{
                                className: 'nav-link is-active',
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
