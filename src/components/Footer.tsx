import { useRouteContext } from '@tanstack/react-router';

export default function Footer() {
    const { session } = useRouteContext({ from: '__root__' });
    if (session) return null;

    const year = new Date().getFullYear();

    return (
        <footer className="mt-16 border-t border-(--line) px-4 py-8 text-(--sea-ink-soft)">
            <div className="page-wrap flex flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
                <p className="m-0 text-xs">
                    &copy; {year} Metrotech Interportal
                </p>
                <p className="m-0 text-[10px] font-bold uppercase tracking-[0.16em]">
                    Confidential / Internal Use Only
                </p>
            </div>
        </footer>
    );
}
