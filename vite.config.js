import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        host: '0.0.0.0', // Listen on all network interfaces
        port: 5173,
        strictPort: true,
        hmr: {
            host: '127.0.0.1',
            clientPort: 5173,
        },
    },
    plugins: [
        laravel({
            input: 'resources/js/app.jsx',
            refresh: true,
        }),
        react(),
    ],
});
