import React, { useState, useMemo } from 'react';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import AssetsAddAssetModal from '@/Pages/Admin/AssetsAddAssetModal';
import { getAssetLinks } from '@/Config/navigation';

export default function AssetEntry({ assets = [], suppliers = [], departments = [], branches = [], rejectedPhotoSubmissions = [], canEnterAssets = false, canAddAssetRecords = false }) {
    const { auth } = usePage().props;
    const assetLinks = getAssetLinks(auth);
    const assetPerms = auth?.user?.asset_permissions || {};
    const [showAddModal, setShowAddModal] = useState(false);
    const canAdd = canAddAssetRecords || assetPerms.canAddAssetRecords || false;
    const canEnter = canEnterAssets || assetPerms.canViewAssetManagement || false;

    // Form for photo submission
    const [search, setSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [previewUrl, setPreviewUrl] = useState('');
    const form = useForm({ asset_id: '', photo: null });

    // Searchable asset list
    const matches = useMemo(() => assets.filter(asset =>
        `${asset.name} ${asset.asset_tag}`.toLowerCase().includes(search.toLowerCase())
    ).slice(0, 30), [assets, search]);

    const choosePhoto = event => {
        const file = event.target.files[0];
        form.setData('photo', file);
        setPreviewUrl(file ? URL.createObjectURL(file) : '');
    };

    const submit = event => {
        event.preventDefault();
        setSuccessMessage('');
        form.post(route('asset-photo-review.submit'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                form.reset('photo');
                setPreviewUrl('');
                setSuccessMessage('Photo submitted successfully and is now waiting for IT review.');
            }
        });
    };

    if (!canEnter) {
        return <SidebarLayout activeModule="Assets" sidebarLinks={assetLinks} header={<h2 className="font-semibold text-xl text-gray-800">Asset Entry</h2>}>
            <Head title="Asset Entry" />
            <div className="min-h-[calc(100dvh-8rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] py-8 px-4 sm:px-6 lg:px-8">
                <section className="mx-auto max-w-4xl rounded-2xl border border-gray-100 bg-gray-50 p-6 shadow-sm">
                    <h1 className="text-xl font-black text-gray-900">Asset Entry</h1>
                    <p className="mt-2 text-sm text-gray-500">You do not have permission to access asset entry. Contact your administrator for access.</p>
                </section>
            </div>
        </SidebarLayout>;
    }

    return <SidebarLayout activeModule="Assets" sidebarLinks={assetLinks} header={<h2 className="font-semibold text-xl text-gray-800">Asset Entry</h2>}>
        <Head title="Asset Entry" />
        <div className="min-h-[calc(100dvh-8rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] py-8 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            {/* Authorized entry users can add a new record to the shared inventory. */}
            {canAdd && (
                <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                    <h1 className="text-xl font-black text-gray-900">Add New Asset</h1>
                    <p className="mt-2 text-sm text-gray-500">Create a new asset in the shared asset-management inventory. You can capture or attach its photo during entry.</p>
                    <PrimaryButton type="button" onClick={() => setShowAddModal(true)} className="mt-6 w-full justify-center">Add Asset</PrimaryButton>
                </section>
            )}

            {/* Photo Capture Section */}
            <section className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-sm">
                <form onSubmit={submit} className="space-y-5">
                    <div>
                        <h1 className="text-lg font-black text-gray-900">Submit an asset photo</h1>
                        <p className="mt-1 text-sm text-gray-500">Use the phone camera or choose an existing image. Photos remain private until IT approves them.</p>
                    </div>
                    {successMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{successMessage}</div>}

                    <div>
                        <label className="block text-sm font-bold text-gray-700">Search & Select Asset</label>
                        <TextInput value={search} onChange={event => setSearch(event.target.value)} className="mt-1 w-full" placeholder="Search by asset tag or name" />
                        <div className="mt-2 max-h-48 overflow-y-auto border rounded-md">
                            {matches.map(asset => (
                                <button
                                    type="button"
                                    key={asset.id}
                                    onClick={() => form.setData('asset_id', asset.id)}
                                    className={`block w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${String(form.data.asset_id) === String(asset.id) ? 'bg-indigo-50 font-bold' : ''}`}
                                >
                                    {asset.asset_tag} — {asset.name}
                                </button>
                            ))}
                            {matches.length === 0 && search && <div className="px-3 py-2 text-sm text-gray-500">No assets found.</div>}
                            {assets.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No assets available.</div>}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-700">Take a photo or upload one</label>
                        <label className="mt-2 flex cursor-pointer items-center justify-between rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 hover:bg-indigo-100">
                            <span className="text-sm font-black text-indigo-800">Choose photo or open camera</span>
                            <span className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-black text-white">Choose file</span>
                            <input required type="file" accept="image/*" capture="environment" onChange={choosePhoto} className="sr-only" />
                        </label>
                        <p className="mt-1 text-xs text-gray-500">On a phone, this requests camera permission when required. JPG, PNG, or WebP photos up to 10 MB are accepted.</p>
                        {previewUrl && <div className="mt-3 rounded-lg border bg-gray-50 p-3"><p className="mb-2 text-xs font-black uppercase tracking-wide text-gray-500">Photo preview</p><img src={previewUrl} alt="Selected asset preview" className="max-h-64 w-full rounded-md object-contain" /></div>}
                        {form.errors.photo && <p className="mt-1 text-sm font-bold text-red-600">{form.errors.photo}</p>}
                    </div>

                    <PrimaryButton disabled={form.processing || !form.data.asset_id}>{form.processing ? 'Submitting…' : 'Submit for review'}</PrimaryButton>
                </form>
            </section>

            {/* Rejected Photo History */}
            <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Rejected photo history</h2>
                        <p className="mt-1 text-sm text-gray-500">Review your rejected submissions and retake them when needed.</p>
                    </div>
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700">{rejectedPhotoSubmissions.length} rejected</span>
                </div>
                {rejectedPhotoSubmissions.length === 0 ? (
                    <p className="mt-4 text-sm text-gray-500">No rejected photo submissions.</p>
                ) : (
                    <div className="mt-4 space-y-3">
                        {rejectedPhotoSubmissions.map(item => (
                            <div key={item.id} className="rounded-lg border border-red-100 bg-red-50 p-4">
                                <div className="font-bold text-gray-900">{item.asset?.asset_tag || item.asset_data?.asset_tag || 'New asset'} — {item.asset?.name || item.asset_data?.name}</div>
                                <p className="mt-1 text-sm text-red-800">{item.rejection_reason || 'No rejection message was provided.'}</p>
                                <p className="mt-1 text-xs text-gray-500">Submitted by {item.submitter?.name || 'you'} · Reviewed by {item.reviewer?.name || 'IT reviewer'}{item.reviewed_at ? ` · ${new Date(item.reviewed_at).toLocaleString()}` : ''}</p>
                                {item.asset_id ? <button
                                    onClick={() => router.visit(`${route('asset-photos.capture')}?asset_id=${item.asset_id}`)}
                                    className="mt-2 inline-flex text-xs font-black text-indigo-700 hover:underline"
                                >Retake this photo</button> : <p className="mt-2 text-xs font-semibold text-gray-600">Re-enter this asset and resubmit the photo for review.</p>}
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
        <AssetsAddAssetModal
            show={showAddModal}
            onClose={() => setShowAddModal(false)}
            suppliers={suppliers}
            departments={departments}
            branches={branches}
            onSubmit={() => setShowAddModal(false)}
        />
    </SidebarLayout>;
}
