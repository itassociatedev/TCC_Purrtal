import React, { useState } from 'react';
import { Head, Link, usePage } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import AssetsAddAssetModal from '@/Pages/Admin/AssetsAddAssetModal';
import { getAssetLinks } from '@/Config/navigation';

export default function AssetEntry({ suppliers = [], departments = [], branches = [] }) {
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
                <section className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
                    <h2 className="text-xl font-black text-gray-900">Capture an existing asset</h2>
                    <p className="mt-2 text-sm text-gray-500">The capture page selects an asset that still needs a photo and lets you search for another one.</p>
                    <Link href={route('asset-photos.capture')} className="mt-6 inline-flex w-full justify-center rounded-md bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700">Open Photo Capture</Link>
                </section>
            </div>
        </div>
        <AssetsAddAssetModal show={showAddModal} onClose={() => setShowAddModal(false)} suppliers={suppliers} departments={departments} branches={branches} onSubmit={() => setShowAddModal(false)} />
    </SidebarLayout>;
}
