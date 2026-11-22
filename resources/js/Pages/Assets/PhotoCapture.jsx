import React, { useMemo, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';

export default function PhotoCapture({ assets = [], rejectedSubmissions = [], nextAssetId = null }) {
    const [search, setSearch] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const form = useForm({ asset_id: nextAssetId || '', photo: null });
    const selectedAsset = assets.find(asset => String(asset.id) === String(form.data.asset_id));
    const matches = useMemo(() => assets.filter(asset => `${asset.name} ${asset.asset_tag}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30), [assets, search]);

    return <SidebarLayout activeModule="Assets" header={<h2 className="font-semibold text-xl text-gray-800">Asset Photo Capture</h2>}>
        <Head title="Asset Photo Capture" />
        <div className="min-h-[calc(100dvh-8rem)] pb-[calc(env(safe-area-inset-bottom)+2rem)] py-8 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <form onSubmit={event => { event.preventDefault(); setSuccessMessage(''); form.post(route('asset-photos.submit'), { forceFormData: true, preserveScroll: true, onSuccess: () => { form.reset('photo'); setSuccessMessage('Photo submitted successfully and is now waiting for IT review. You can continue capturing photos below.'); } }); }} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
                <div><h1 className="text-lg font-black">Submit an asset photo</h1><p className="text-sm text-gray-500">Use the phone camera or choose an existing image. Photos remain private until IT approves them.</p></div>
                {successMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">{successMessage}</div>}
                <div><label className="block text-sm font-bold text-gray-700">Next asset selected</label><div className="mt-1 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-900">{selectedAsset ? `${selectedAsset.asset_tag} — ${selectedAsset.name}` : 'No unphotographed assets remaining'}</div><label className="mt-3 block text-xs font-bold uppercase tracking-wide text-gray-500">Choose a different asset</label><TextInput value={search} onChange={event => setSearch(event.target.value)} className="mt-1 w-full" placeholder="Search by asset tag or name" /><div className="mt-2 max-h-48 overflow-y-auto border rounded-md">{matches.map(asset => <button type="button" key={asset.id} onClick={() => form.setData('asset_id', asset.id)} className={`block w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${String(form.data.asset_id) === String(asset.id) ? 'bg-indigo-50 font-bold' : ''}`}>{asset.asset_tag} — {asset.name}</button>)}</div></div>
                <div><label className="block text-sm font-bold text-gray-700">Take a photo or upload one</label><input required type="file" accept="image/*" capture="environment" onChange={event => form.setData('photo', event.target.files[0])} className="mt-1 w-full text-sm" /><p className="mt-1 text-xs text-gray-500">On a phone, tap this control to open the rear camera. The browser will request camera permission when required. You can also choose an existing image.</p></div>
                <PrimaryButton disabled={form.processing || !form.data.asset_id}>{form.processing ? 'Submitting…' : 'Submit for review'}</PrimaryButton>
            </form>
            <div className="bg-white rounded-xl shadow-sm border p-6"><h2 className="font-black">Your rejected submissions</h2>{rejectedSubmissions.length === 0 ? <p className="text-sm text-gray-500 mt-2">No rejected photos.</p> : <div className="mt-3 space-y-2">{rejectedSubmissions.map(item => <div key={item.id} className="rounded-md bg-red-50 p-3 text-sm"><div><span className="font-bold">{item.asset?.asset_tag}</span> — {item.asset?.name}</div><p className="mt-1 text-red-800">{item.rejection_reason || 'No reason provided'}</p><p className="mt-1 text-xs text-gray-500">Submitted by {item.submitter?.name || 'you'} · Reviewed by {item.reviewer?.name || 'IT reviewer'}</p><button type="button" onClick={() => { form.setData('asset_id', item.asset_id); setSearch(item.asset?.asset_tag || ''); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="mt-2 text-xs font-black text-indigo-700 hover:underline">Retake this photo</button></div>)}</div>}</div>
        </div>
    </SidebarLayout>;
}
