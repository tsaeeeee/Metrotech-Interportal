import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_protected')({
    beforeLoad: ({ context }) => {
        if (!context.session) {
            throw redirect({ to: '/login' });
        }
    },
    component: () => <Outlet />,
});
