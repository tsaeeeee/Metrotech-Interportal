import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { changePassword } from '../features/auth/auth-service';

export const Route = createFileRoute('/change-password')({
    beforeLoad: ({ context }) => {
        if (!context.session) throw redirect({ to: '/login' });
    },
    component: ChangePasswordPage,
});

function ChangePasswordPage() {
    const router = useRouter();
    const changeFn = useServerFn(changePassword);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError('');
        const form = event.currentTarget;
        const currentPassword = (form.elements.namedItem('currentPassword') as HTMLInputElement).value;
        const newPassword = (form.elements.namedItem('newPassword') as HTMLInputElement).value;
        const confirm = (form.elements.namedItem('confirm') as HTMLInputElement).value;
        if (newPassword !== confirm) { setError('New passwords do not match'); return; }
        setSaving(true);
        try {
            await changeFn({ data: { currentPassword, newPassword } });
            await router.invalidate();
            await router.navigate({ to: '/' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unable to update password');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="flex min-h-[70vh] items-center justify-center px-4 py-10">
            <section className="island-shell w-full max-w-md rounded-xl p-7">
                <h1 className="text-lg font-bold text-(--sea-ink)">Change Password</h1>
                <p className="mt-2 text-xs text-(--sea-ink-soft)">Set a new personal password before accessing DCIM.</p>
                <form className="mt-6 space-y-4" onSubmit={submit}>
                    <label className="asset-label" htmlFor="currentPassword">Current Password</label>
                    <input className="asset-control" id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
                    <label className="asset-label" htmlFor="newPassword">New Password</label>
                    <input className="asset-control" id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={12} required />
                    <label className="asset-label" htmlFor="confirm">Confirm New Password</label>
                    <input className="asset-control" id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={12} required />
                    {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
                    <button className="auth-submit" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Password'}</button>
                </form>
            </section>
        </main>
    );
}
