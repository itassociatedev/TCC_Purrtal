import '../css/app.css';
import '../css/clinic-design.css';
import '../css/clinic-preferences.css';
import './Utils/displayPreferences.mjs';
import './bootstrap';

import { createInertiaApp } from '@inertiajs/react';
import { resolvePageComponent } from 'laravel-vite-plugin/inertia-helpers';
import { createRoot } from 'react-dom/client';

// =========================================================================
// GLOBAL TIMEZONE ENFORCEMENT (PST / ASIA/MANILA)
// =========================================================================
// 1. Save the original native Javascript time functions
const originalDateString = Date.prototype.toLocaleDateString;
const originalTimeString = Date.prototype.toLocaleTimeString;

// 2. Override them globally to strictly default to Philippine Standard Time
Date.prototype.toLocaleDateString = function (locales = 'en-US', options = {}) {
    return originalDateString.call(this, locales, { 
        timeZone: 'Asia/Manila', 
        ...options 
    });
};

Date.prototype.toLocaleTimeString = function (locales = 'en-US', options = {}) {
    return originalTimeString.call(this, locales, { 
        timeZone: 'Asia/Manila', 
        ...options 
    });
};
// =========================================================================

const appName = import.meta.env.VITE_APP_NAME || 'Laravel';

createInertiaApp({
    title: (title) => title,
    resolve: (name) =>
        resolvePageComponent(
            `./Pages/${name}.jsx`,
            import.meta.glob('./Pages/**/*.jsx'),
        ),
    setup({ el, App, props }) {
        const root = createRoot(el);

        root.render(<App {...props} />);
    },
    progress: {
        color: '#4B5563',
    },
});