import React, { useMemo, useState } from 'react';
import { Head, useForm } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';

export default function PhotoCapture({ assets = [], rejectedSubmissions = [] }) {
    const [search, setSearch] = useState('');
    const form = useForm({ asset_id: '', photo: null });
    const matches = useMemo(() => assets.filter(asset => `${asset.name} ${asset.asset_tag}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30), [assets, search]);

    return <SidebarLayout activeModule="Assets" header={<h2 className="font-semibold text-xl text-gray-800">Asset Photo Capture</h2>}>
        <Head title="Asset Photo Capture" />
        <div className="py-8 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <form onSubmit={event => { event.preventDefault(); form.post(route('asset-photos.submit'), { forceFormData: true, preserveScroll: true, onSuccess: () => form.reset('photo') }); }} className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
                <div><h1 className="text-lg font-black">Submit an asset photo</h1><p className="text-sm text-gray-500">Use the phone camera or choose an existing image. Photos remain private until IT approves them.</p></div>
                <div><label className="block text-sm font-bold text-gray-700">Find asset</label><TextInput value={search} onChange={event => setSearch(event.target.value)} className="mt-1 w-full" placeholder="Search by asset tag or name" /><div className="mt-2 max-h-48 overflow-y-auto border rounded-md">{matches.map(asset => <button type="button" key={asset.id} onClick={() => form.setData('asset_id', asset.id)} className={`block w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 ${String(form.data.asset_id) === String(asset.id) ? 'bg-indigo-50 font-bold' : ''}`}>{asset.asset_tag} — {asset.name}</button>)}</div></div>
                <div><label className="block text-sm font-bold text-gray-700">Photo</label><input required type="file" accept="image/*" capture="environment" onChange={event => form.setData('photo', event.target.files[0])} className="mt-1 w-full text-sm" /></div>
                <PrimaryButton disabled={form.processing || !form.data.asset_id}>{form.processing ? 'Submitting…' : 'Submit for review'}</PrimaryButton>
            </form>
            <div className="bg-white rounded-xl shadow-sm border p-6"><h2 className="font-black">Your rejected submissions</h2>{rejectedSubmissions.length === 0 ? <p className="text-sm text-gray-500 mt-2">No rejected photos.</p> : <div className="mt-3 space-y-2">{rejectedSubmissions.map(item => <div key={item.id} className="rounded-md bg-red-50 p-3 text-sm"><span className="font-bold">{item.asset?.asset_tag}</span> — {item.rejection_reason || 'No reason provided'}</div>)}</div>}</div>
        </div>
    </SidebarLayout>;
}
