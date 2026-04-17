import { Link } from '@tanstack/react-router';
import { ChevronRight, Home, LayoutPanelLeft } from 'lucide-react';

interface BreadcrumbNavProps {
    datacenter?: string;
    floor?: string;
    rack?: string;
}

export function BreadcrumbNav({ datacenter, floor, rack }: BreadcrumbNavProps) {
    return (
        <nav className="flex items-center gap-2 text-sm font-medium">
            <Link
                to="/"
                className="flex items-center gap-1.5 p-1 rounded-md text-(--sea-ink-soft) hover:text-(--sea-ink) hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
                <Home size={16} />
                <span>Dashboard</span>
            </Link>

            {datacenter && (
                <>
                    <ChevronRight size={14} className="text-zinc-300" />
                    <span className="flex items-center gap-1.5 p-1 text-(--sea-ink)">
                        <LayoutPanelLeft
                            size={16}
                            className="text-emerald-600"
                        />
                        {datacenter}
                    </span>
                </>
            )}

            {floor && (
                <>
                    <ChevronRight size={14} className="text-zinc-300" />
                    <span className="text-(--sea-ink)">{floor}</span>
                </>
            )}

            {rack && (
                <>
                    <ChevronRight
                        size={14}
                        className="text-zinc-300 font-bold"
                    />
                    <span className="font-bold text-(--lagoon-deep)">
                        {rack}
                    </span>
                </>
            )}
        </nav>
    );
}
