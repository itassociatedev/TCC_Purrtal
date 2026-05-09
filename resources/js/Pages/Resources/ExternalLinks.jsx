import React, { useState, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';

// --- Automated Logo Fetcher Component ---
const ResourceLogo = ({ link }) => { 
    const [hasError, setHasError] = useState(false);

    // Automatically extract the domain from the URL
    const domain = useMemo(() => {
        try {
            return new URL(link.url).hostname;
        } catch (e) {
            return null;
        }
    }, [link.url]);

    // Check for custom uploaded image first
    const logoUrl = link.image_path 
        ? `/storage/${link.image_path}` 
        : (domain ? `https://logo.clearbit.com/${domain}` : null);

    // Fallback to red letter icon
    if (!logoUrl || hasError) {
        return (
            <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-24 h-24 rounded-full bg-red-50 group-hover:bg-white group-hover:shadow-md transition-all duration-500">
                <span className="text-4xl font-extrabold text-red-400 group-hover:text-red-600 transition-colors duration-500 uppercase">
                    {link.title.charAt(0)}
                </span>
            </div>
        );
    }

    // Render the image
    return (
        <div className="relative z-10 flex-shrink-0 flex items-center justify-center w-24 h-24 rounded-full bg-white shadow-sm border border-gray-100 group-hover:shadow-md transition-all duration-500 p-4">
            <img
                src={logoUrl}
                alt={`${link.title} logo`}
                onError={() => setHasError(true)} 
                className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
            />
        </div>
    );
};

export default function ExternalLinks({ links = [] }) {
    // 🟢 FORCE SORTING BY SORT_ORDER ON THE FRONTEND 🟢
    const sortedLinks = [...links].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

    const generalSidebarLinks = [
        { href: route('dashboard'), label: 'Overview', active: route().current('dashboard') },
        { href: route('dashboard.announcements'), label: 'Announcements', active: route().current('dashboard.announcements') },
        { href: route('dashboard.mission-vision'), label: 'About Us', active: route().current('dashboard.mission-vision') },
        { href: route('dashboard.org-chart'), label: 'Organizational Directory', active: route().current('dashboard.org-chart') },
    ];

    const header = (
        <div>
            <h2 className="text-xl font-semibold leading-tight text-gray-800">Employee Benefits & Services</h2>
            <p className="text-sm text-gray-500 mt-1">External links for your statutory, healthcare, and government portals.</p>
        </div>
    );

    return (
        <SidebarLayout header={header} activeModule="General" sidebarLinks={generalSidebarLinks}>
            <Head title="External Links" />

            <div className="bg-gray-50/50 p-6 shadow-sm sm:rounded-2xl sm:p-12 min-h-[65vh] flex flex-col items-center justify-center border border-gray-100">
                {sortedLinks.length > 0 ? (
                    <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto w-full">
                        {sortedLinks.map((link) => (
                            <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" className="group relative flex flex-col items-center text-center gap-6 p-8 bg-white rounded-2xl shadow-sm hover:shadow-2xl border border-gray-100 hover:border-red-200 transition-all duration-500 hover:-translate-y-2 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-br from-red-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                                <ResourceLogo link={link} />
                                
                                <div className="relative z-10 flex-grow flex flex-col justify-center">
                                    <span className="block text-lg font-bold text-gray-900 group-hover:text-red-700 transition-colors duration-300">
                                        {link.title}
                                    </span>
                                    {link.description && (
                                        <p className="text-xs text-gray-400 mt-1 group-hover:text-gray-500">{link.description}</p>
                                    )}
                                    <span className="block text-sm font-medium text-red-500 mt-2 opacity-0 group-hover:opacity-100 transition-all duration-500 transform translate-y-4 group-hover:translate-y-0">
                                        Visit Portal &rarr;
                                    </span>
                                </div>
                            </a>
                        ))}
                    </div>
                ) : (
                    <div className="text-center text-gray-500">
                        <p className="text-lg font-medium">No External Links Configured</p>
                        <p className="text-sm">Administrators can add links from the Admin Dashboard.</p>
                    </div>
                )}
            </div>
        </SidebarLayout>
    );
}