export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer className="site-footer px-4 py-4 text-(--sea-ink-soft)">
            <div className="page-wrap flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span>&copy; {year} Metrotech Indonesia · DCIM</span>
                <span>Internal Use Only</span>
            </div>
        </footer>
    );
}
