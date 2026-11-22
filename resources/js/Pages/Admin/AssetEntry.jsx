import React, { useState } from 'react';
import { Head, usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import AssetsAddAssetModal from '@/Pages/Admin/AssetsAddAssetModal';
import { getAssetLinks } from '@/Config/navigation';

export default function AssetEntry({ suppliers = [], departments = [], branches = [], rejectedPhotoSubmissions = [] }) {
    const { auth } = usePage().props;
    const [showAddModal, setShowAddModal] = useState(false);
    const assetLinks = getAssetLinks(auth);

    return <SidebarLayout activeModule="Assets" sidebarLinks={assetLinks} onTriggerAddModal={() => setShowAddModal(true)} header={<h2 className="font-semibold text-xl text-gray-800">Asset Entry</h2>}>
        <Head title="Asset Entry" />
        <div className="min-h-[calc(100dvh-8rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] py-8 px-4 sm:px-6 lg:px-8">
            <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
                <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                    <h1 className="text-xl font-black text-gray-900">Add an asset</h1>
                    <p className="mt-2 text-sm text-gray-500">Enter a new asset and optionally take its photo using this phone.</p>
                    <PrimaryButton type="button" onClick={() => setShowAddModal(true)} className="mt-6 w-full justify-center">Open Asset Entry</PrimaryButton>
                </section>
            </div>
            <section className="mx-auto max-w-4xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div><h2 className="text-xl font-black text-gray-900">Rejected photo history</h2><p className="mt-1 text-sm text-gray-500">Review your rejected submissions and retake them when needed.</p></div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{rejectedPhotoSubmissions.length} rejected</span>
                </div>
                {rejectedPhotoSubmissions.length === 0 ? <p className="mt-4 text-sm text-gray-500">No rejected photo submissions.</p> : <div className="mt-4 space-y-3">{rejectedPhotoSubmissions.map(item => <div key={item.id} className="rounded-lg border border-red-100 bg-red-50 p-4"><div className="font-bold text-gray-900">{item.asset?.asset_tag} — {item.asset?.name}</div><p className="mt-1 text-sm text-red-800">{item.rejection_reason || 'No reason provided'}</p><p className="mt-1 text-xs text-gray-500">Reviewed by {item.reviewer?.name || 'IT reviewer'}</p><Link href={`${route('asset-photos.capture')}?asset_id=${item.asset_id}`} className="mt-2 inline-flex text-xs font-black text-indigo-700 hover:underline">Retake this photo</Link></div>)}</div>}
            </section>
        </div>
        <AssetsAddAssetModal show={showAddModal} onClose={() => setShowAddModal(false)} suppliers={suppliers} departments={departments} branches={branches} onSubmit={() => setShowAddModal(false)} />
    </SidebarLayout>;
}
