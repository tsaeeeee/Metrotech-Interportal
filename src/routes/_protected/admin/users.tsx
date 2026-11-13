import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { createUser, listUsers, type ManagedUser } from '../../../features/admin/user-service';

export const Route = createFileRoute('/_protected/admin/users')({
    beforeLoad: ({ context }) => {
        if (context.session?.user.role !== 'admin') throw redirect({ to: '/' });
    },
    loader: () => listUsers(),
    component: UserManagement,
});

function UserManagement() {
    const initial = Route.useLoaderData();
    const [users, setUsers] = useState<ManagedUser[]>(initial);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [show, setShow] = useState(false);
    const createFn = useServerFn(createUser);
    const listFn = useServerFn(listUsers);
    const router = useRouter();

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = event.currentTarget;
        const fields = new FormData(form);
        setBusy(true); setError('');
        try {
            await createFn({ data: {
                username: String(fields.get('username') || ''),
                fullName: String(fields.get('fullName') || ''),
                email: String(fields.get('email') || ''),
                password: String(fields.get('password') || ''),
            } });
            setUsers(await listFn());
            form.reset(); setShow(false);
            await router.invalidate();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to create user');
        } finally { setBusy(false); }
    };

    return (
        <main className="w-full px-4 pb-12 pt-6 md:px-6">
            <div className="page-wrap">
                <section className="ops-toolbar mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl px-5 py-4">
                    <div>
                        <h1 className="text-lg font-bold text-(--sea-ink)">User Management</h1>
                        <p className="mt-1 text-xs text-(--sea-ink-soft)">{users.length} accounts · Administrator-controlled access</p>
                    </div>
                    <button className="auth-submit !w-auto" type="button" onClick={() => setShow(value => !value)}>
                        {show ? 'Close Form' : 'Add Editor'}
                    </button>
                </section>
                {show && (
                    <form onSubmit={submit} className="ops-panel mb-5 grid gap-4 rounded-xl p-5 md:grid-cols-2">
                        {([
                            ['username', 'Username', 'text'],
                            ['fullName', 'Full Name', 'text'],
                            ['email', 'Email', 'email'],
                            ['password', 'Temporary Password', 'password'],
                        ] as const).map(([name, label, type]) => (
                            <div key={name}>
                                <label htmlFor={name} className="asset-label">{label}</label>
                                <input id={name} name={name} className="asset-control" type={type}
                                    minLength={name === 'password' ? 12 : undefined}
                                    autoComplete="off" required />
                            </div>
                        ))}
                        {error && <p role="alert" className="text-sm text-red-400 md:col-span-2">{error}</p>}
                        <div className="md:col-span-2 flex justify-end">
                            <button className="auth-submit !w-auto" disabled={busy} type="submit">{busy ? 'Saving…' : 'Create Editor'}</button>
                        </div>
                    </form>
                )}
                <section className="ops-panel overflow-x-auto rounded-xl">
                    <table className="w-full text-left text-xs">
                        <thead className="border-b border-(--line) text-(--sea-ink-soft)">
                            <tr><th className="p-4">Username</th><th className="p-4">Full Name</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Status</th></tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr className="border-b border-(--line) last:border-b-0" key={user.id}>
                                    <td className="p-4 font-bold">{user.username}</td>
                                    <td className="p-4">{user.fullName}</td>
                                    <td className="p-4">{user.email || '—'}</td>
                                    <td className="p-4 capitalize">{user.role}</td>
                                    <td className="p-4">{user.isActive ? 'Active' : 'Disabled'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </div>
        </main>
    );
}
