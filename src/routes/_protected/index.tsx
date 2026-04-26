import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { ArrowRight, Building2, MapPin, Plus, Server, Tag } from 'lucide-react';
import { useState } from 'react';
import {
    createDatacenter,
    type Datacenter,
    getDatacenters,
} from '../../features/datacenters/datacenter-service';

export const Route = createFileRoute('/_protected/')({
    loader: async () => {
        const datacenters = await getDatacenters();
        return { datacenters };
    },
    component: DashboardPage,
});

function DashboardPage() {
    const { datacenters: initialDatacenters } = Route.useLoaderData();
    const router = useRouter();
    const createDcFn = useServerFn(createDatacenter);

    const [datacenters, setDatacenters] =
        useState<Datacenter[]>(initialDatacenters);
    const [showForm, setShowForm] = useState(false);
    const [formError, setFormError] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleCreateDc = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setFormError('');
        setSubmitting(true);

        const form = e.currentTarget;
        const name = (
            form.elements.namedItem('name') as HTMLInputElement
        ).value.trim();
        const code = (form.elements.namedItem('code') as HTMLInputElement).value
            .trim()
            .toUpperCase();
        const location = (
            form.elements.namedItem('location') as HTMLInputElement
        ).value.trim();

        try {
            const result = await createDcFn({ data: { name, code, location } });
            setDatacenters((prev) => [result.datacenter, ...prev]);
            setShowForm(false);
            form.reset();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : 'Failed to create datacenter');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="w-full px-4 md:px-8 pb-16 pt-8">
            <div className="max-w-300 w-full mx-auto">
                {/* Page Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 border-b border-(--line) pb-6">
                    <div>
                        <p className="island-kicker mb-2">Infrastructure</p>
                        <h1 className="text-3xl font-black text-(--sea-ink) tracking-tighter">
                            Your Datacenters
                        </h1>
                        <p className="text-sm text-(--sea-ink-soft) mt-1 font-medium">
                            {datacenters.length} datacenter
                            {datacenters.length !== 1 ? 's' : ''} managed
                        </p>
                    </div>
                    <button
                        id="open-create-dc-form"
                        type="button"
                        onClick={() => setShowForm((v) => !v)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-(--lagoon-deep) text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-900/15 hover:brightness-110 transition-all active:scale-95 whitespace-nowrap border border-white/10 cursor-pointer"
                    >
                        <Plus size={16} />
                        Add Datacenter
                    </button>
                </div>

                {/* Create Datacenter Form */}
                {showForm && (
                    <div className="mb-8 island-shell rounded-2xl p-6 border-2 border-(--lagoon-deep)/20 animate-in zoom-in-95 duration-200">
                        <h2 className="text-base font-black text-(--sea-ink) mb-5 flex items-center gap-2">
                            <Plus size={16} className="text-(--lagoon-deep)" />
                            New Datacenter
                        </h2>
                        <form
                            id="create-dc-form"
                            onSubmit={handleCreateDc}
                            className="grid md:grid-cols-3 gap-4"
                        >
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="dc-name"
                                    className="island-kicker"
                                >
                                    Datacenter Name
                                </label>
                                <input
                                    id="dc-name"
                                    name="name"
                                    type="text"
                                    required
                                    placeholder="Jakarta Main DC"
                                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="dc-code"
                                    className="island-kicker"
                                >
                                    DC Code
                                </label>
                                <input
                                    id="dc-code"
                                    name="code"
                                    type="text"
                                    required
                                    placeholder="JKT-01"
                                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm font-mono uppercase tracking-wide"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <label
                                    htmlFor="dc-location"
                                    className="island-kicker"
                                >
                                    Location
                                </label>
                                <input
                                    id="dc-location"
                                    name="location"
                                    type="text"
                                    required
                                    placeholder="Jakarta, Indonesia"
                                    className="px-4 py-2.5 rounded-xl bg-white/60 dark:bg-zinc-900/60 border border-(--line) focus:outline-none focus:ring-2 focus:ring-(--lagoon-deep)/40 transition-all text-(--sea-ink) placeholder:text-(--sea-ink-soft)/40 text-sm"
                                />
                            </div>

                            {formError && (
                                <div className="md:col-span-3 px-4 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 text-sm font-medium">
                                    {formError}
                                </div>
                            )}

                            <div className="md:col-span-3 flex gap-3 pt-1">
                                <button
                                    id="create-dc-submit"
                                    type="submit"
                                    disabled={submitting}
                                    className="px-6 py-2.5 bg-(--lagoon-deep) text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-900/15 hover:brightness-110 transition-all active:scale-95 disabled:opacity-60 cursor-pointer"
                                >
                                    {submitting
                                        ? 'Creating…'
                                        : 'Add Datacenter'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowForm(false);
                                        setFormError('');
                                    }}
                                    className="px-6 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-(--sea-ink-soft) rounded-xl font-bold text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Datacenter Grid */}
                {datacenters.length === 0 ? (
                    <EmptyState onCreateClick={() => setShowForm(true)} />
                ) : (
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {datacenters.map((dc) => (
                            <DatacenterCard
                                key={dc.id}
                                dc={dc}
                                onClick={() =>
                                    router.navigate({
                                        to: '/dc/$dcId',
                                        params: { dcId: dc.id },
                                    })
                                }
                            />
                        ))}
                    </div>
                )}
            </div>
        </main>
    );
}

function DatacenterCard({
    dc,
    onClick,
}: {
    dc: Datacenter;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="island-shell feature-card rounded-2xl p-6 text-left cursor-pointer group w-full border border-(--line) hover:border-(--lagoon-deep)/30 transition-all"
        >
            <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-(--lagoon-deep)/10 border border-(--lagoon-deep)/20 flex items-center justify-center">
                    <Server size={18} className="text-(--lagoon-deep)" />
                </div>
                <ArrowRight
                    size={16}
                    className="text-(--sea-ink-soft) opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                />
            </div>

            <h2 className="text-base font-black text-(--sea-ink) tracking-tight mb-1 group-hover:text-(--lagoon-deep) transition-colors">
                {dc.name}
            </h2>

            <div className="flex items-center gap-1.5 mb-3">
                <Tag size={11} className="text-(--sea-ink-soft) opacity-60" />
                <span className="text-[11px] font-mono font-bold text-(--sea-ink-soft) opacity-70 uppercase tracking-wider">
                    {dc.code}
                </span>
            </div>

            <div className="flex items-center gap-1.5">
                <MapPin
                    size={11}
                    className="text-(--sea-ink-soft) opacity-60"
                />
                <span className="text-xs text-(--sea-ink-soft) opacity-70">
                    {dc.location}
                </span>
            </div>
        </button>
    );
}

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center py-24 text-center rise-in">
            <div className="w-20 h-20 rounded-3xl island-shell flex items-center justify-center mb-6">
                <Building2
                    size={32}
                    className="text-(--lagoon-deep) opacity-60"
                />
            </div>
            <h2 className="text-xl font-black text-(--sea-ink) mb-2">
                No datacenters yet
            </h2>
            <p className="text-sm text-(--sea-ink-soft) mb-8 max-w-sm">
                Create your first datacenter to start managing your
                infrastructure racks and devices.
            </p>
            <button
                id="empty-state-create-dc"
                type="button"
                onClick={onCreateClick}
                className="flex items-center gap-2 px-6 py-3 bg-(--lagoon-deep) text-white rounded-xl text-sm font-black shadow-lg shadow-emerald-900/15 hover:brightness-110 transition-all active:scale-95 cursor-pointer"
            >
                <Plus size={16} />
                Create your first datacenter
            </button>
        </div>
    );
}
