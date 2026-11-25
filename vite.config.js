import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '');
    const appUrl = env.APP_URL || 'http://localhost';
    const hmrHost = env.VITE_HMR_HOST || new URL(appUrl).hostname;

    return {
        server: {
            host: '0.0.0.0', // Listen on all network interfaces
            port: 5173,
            strictPort: true,
            hmr: {
                host: hmrHost,
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
    };
});
