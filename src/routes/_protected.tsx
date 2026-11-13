import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected')({
    beforeLoad: ({ context }) => {
        if (!context.session) {
            throw redirect({ to: '/login' });
        }
        if (context.session.user.mustChangePassword) {
            throw redirect({ to: '/change-password' });
        }
    },
    component: () => <Outlet />,
});
