import { Link, useRouteContext, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { Info, LayoutDashboard, LogIn, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { logout } from '../features/auth/auth-service';
import ThemeToggle from './ThemeToggle';

export default function Header() {
    const { session } = useRouteContext({ from: '__root__' });
    const router = useRouter();
    const logoutFn = useServerFn(logout);
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleLogout = async () => {
        setMobileOpen(false);
        await logoutFn();
        await router.invalidate();
        await router.navigate({ to: '/login' });
    };

    return (
        <>
            <header className="metrotech-mobile-bar">
                <Link to="/" className="metrotech-mobile-brand" onClick={() => setMobileOpen(false)}>
                    <img src="/assets/metrotech-logo.webp" width={300} height={43} alt="Metrotech" />
                </Link>
                <button
                    type="button"
                    className="metrotech-mobile-menu"
                    aria-expanded={mobileOpen}
                    aria-controls="metrotech-sidebar"
                    aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                    onClick={() => setMobileOpen((open) => !open)}
                >
                    {mobileOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
            </header>
            {mobileOpen && (
                <button
                    type="button"
                    className="metrotech-sidebar-scrim"
                    aria-label="Close navigation"
                    onClick={() => setMobileOpen(false)}
                />
            )}
            <aside id="metrotech-sidebar" className={['metrotech-sidebar', mobileOpen ? 'is-open' : ''].join(' ')}>
                <Link to="/" className="metrotech-brand" onClick={() => setMobileOpen(false)}>
                    <img src="/assets/metrotech-logo.webp" width={300} height={43} alt="Metrotech" />
                    <span className="metrotech-brand-label">DCIM · Infrastructure Management</span>
                </Link>

                <p className="metrotech-nav-label">Workspace</p>
                <nav className="metrotech-sidebar-nav" aria-label="Main navigation">
                    {session ? (
                        <Link
                            to="/"
                            activeOptions={{ exact: true }}
                            className="metrotech-sidebar-link"
                            activeProps={{ className: 'metrotech-sidebar-link is-active' }}
                            onClick={() => setMobileOpen(false)}
                        >
                            <LayoutDashboard size={17} aria-hidden="true" />
                            Datacenters
                        </Link>
                    ) : (
                        <Link
                            to="/login"
                            className="metrotech-sidebar-link"
                            activeProps={{ className: 'metrotech-sidebar-link is-active' }}
                            onClick={() => setMobileOpen(false)}
                        >
                            <LogIn size={17} aria-hidden="true" />
                            Sign In
                        </Link>
                    )}
                    <Link
                        to="/about"
                        className="metrotech-sidebar-link"
                        activeProps={{ className: 'metrotech-sidebar-link is-active' }}
                        onClick={() => setMobileOpen(false)}
                    >
                        <Info size={17} aria-hidden="true" />
                        About
                    </Link>
                </nav>

                <div className="metrotech-sidebar-footer">
                    <ThemeToggle />
                    {session && (
                        <div className="metrotech-profile">
                            <span className="metrotech-avatar" aria-hidden="true">
                                {session.user.fullName.trim().slice(0, 1).toUpperCase() || 'M'}
                            </span>
                            <div className="metrotech-profile-info">
                                <p className="metrotech-profile-name">{session.user.fullName}</p>
                                <p className="metrotech-profile-email">{session.user.email}</p>
                            </div>
                            <button
                                type="button"
                                className="metrotech-logout"
                                onClick={handleLogout}
                                title="Log out"
                                aria-label="Log out"
                            >
                                <LogOut size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </aside>
        </>
    );
}
