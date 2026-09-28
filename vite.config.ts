import tailwindcss from '@tailwindcss/vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nitro } from 'nitro/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [
        devtools(),
        tsconfigPaths({ projects: ['./tsconfig.json'] }),
        tailwindcss(),
        tanstackStart(),
        nitro(),
        viteReact(),
    ],
    server: {
        host: true, // 🔥 INI PENTING BANGET
        allowedHosts: ['unblushing-ewa-superseraphical.ngrok-free.dev'],
        watch: {
            ignored: ['**/data/**'],
        },
    },
});
