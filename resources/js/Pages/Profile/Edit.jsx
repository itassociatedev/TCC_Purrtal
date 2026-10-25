import { getDashboardLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head } from '@inertiajs/react';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';

export default function Edit({ auth, mustVerifyEmail, status }) {

    const dashboardLinks = getDashboardLinks();

    return (
        <SidebarLayout

            activeModule="Profile"
            sidebarLinks={dashboardLinks}
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Profile
                </h2>
            }
        >
            <Head title="Profile" />

            <div className="pb-12 pt-2">
                <div className="mx-auto max-w-7xl space-y-6 sm:px-6 lg:px-8">
                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                            className="max-w-xl"
                        />
                    </div>

                    {/* 🟢 ASSIGNED COMPANY ASSETS SECTION (LATEST 5) 🟢 */}
                    <div className="p-4 sm:p-8 bg-white shadow sm:rounded-lg">
                        <section>
                            <header className="flex items-center gap-3">
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                    </svg>
                                </div>
                                <div className="flex-1 flex justify-between items-center">
                                    <div>
                                        <h2 className="text-lg font-medium text-gray-900">Recent Company Assets</h2>
                                        <p className="mt-1 text-sm text-gray-600">The most recent company property assigned to your accountability.</p>
                                    </div>
                                    {(auth?.user?.assets || []).length > 5 && (
                                        <button onClick={() => window.location.href = route('staff.assets.index')} className="text-sm font-bold text-indigo-600 hover:text-indigo-900 hover:underline">
                                            View All {(auth?.user?.assets || []).length} Assets &rarr;
                                        </button>
                                    )}
                                </div>
                            </header>
                            
                            <div className="mt-6">
                                {(auth?.user?.assets || []).length > 0 ? (
                                    <ul className="divide-y divide-gray-100 border border-gray-200 rounded-lg bg-gray-50 px-4 shadow-sm">
                                        {/* 🟢 SLICE TO GET ONLY THE LAST 5 ITEMS */}
                                        {(auth?.user?.assets || []).slice(0, 5).map(asset => (
                                            <li 
                                                key={asset?.id} 
                                                /* 🟢 REDIRECT TO THE NEW STAFF ASSET MODULE */
                                                onClick={() => window.location.href = route('staff.assets.index')}
                                                className="py-4 flex justify-between items-center cursor-pointer transition-colors hover:bg-indigo-50 px-2 -mx-2 rounded-lg group"
                                            >
                                                <div>
                                                    <p className="font-bold text-sm text-indigo-700 group-hover:text-indigo-900 group-hover:underline">{asset?.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono mt-0.5">Tag: {asset?.asset_tag} {asset?.serial_no ? `| SN: ${asset?.serial_no}` : ''}</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-wider border shadow-sm ${
                                                        asset?.condition === 'Good' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                        asset?.condition === 'Broken' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                        asset?.condition === 'Missing' ? 'bg-gray-100 text-gray-700 border-gray-300' : 
                                                        'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                    }`}>
                                                        {asset?.condition || 'Unknown'}
                                                    </span>
                                                    <svg className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                    </svg>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-gray-200 border-dashed">
                                        <p className="text-sm text-gray-500 italic">You have no company assets assigned to you.</p>
                                    </div>
                                )}
                            </div>
                            
                            {(auth?.user?.assets || []).length > 0 && (
                                <div className="mt-4 flex justify-end">
                                     <button 
                                        onClick={() => window.location.href = route('staff.assets.index')} 
                                        className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md font-semibold text-xs text-gray-700 uppercase tracking-widest shadow-sm hover:bg-gray-50 focus:outline-none disabled:opacity-25 transition ease-in-out duration-150"
                                    >
                                        Open My Asset Masterlist
                                    </button>
                                </div>
                            )}
                        </section>
                    </div>

                    <div className="bg-white p-4 shadow sm:rounded-lg sm:p-8">
                        <UpdatePasswordForm className="max-w-xl" />
                    </div>


                </div>
            </div>
        </SidebarLayout>
    );
}
