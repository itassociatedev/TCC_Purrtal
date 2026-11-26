import { Head } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import SecondaryButton from '@/Components/SecondaryButton';
import { getAssetLinks } from '@/Config/navigation';

export default function AssetStickers({ auth, assets = [] }) {
    const assetLinks = getAssetLinks(auth);
    const [search, setSearch] = useState('');
    const [selectedAssets, setSelectedAssets] = useState([]);

    const filteredAssets = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return assets;

        return assets.filter(asset => [asset?.name, asset?.asset_tag, asset?.branch, asset?.department]
            .some(value => String(value || '').toLowerCase().includes(term)));
    }, [assets, search]);

    const visibleIds = filteredAssets.map(asset => asset.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedAssets.includes(id));

    const toggleAsset = (id) => {
        setSelectedAssets(previous => previous.includes(id)
            ? previous.filter(selectedId => selectedId !== id)
            : [...previous, id]);
    };

    const toggleVisibleAssets = () => {
        setSelectedAssets(previous => allVisibleSelected
            ? previous.filter(id => !visibleIds.includes(id))
            : [...new Set([...previous, ...visibleIds])]);
    };

    const downloadStickers = () => {
        if (selectedAssets.length === 0) return;
        const query = new URLSearchParams();
        selectedAssets.forEach(id => query.append('ids[]', id));
        window.location.href = `${route('admin.assets.stickers.pdf')}?${query.toString()}`;
    };

    return (
        <SidebarLayout activeModule="Assets" sidebarLinks={assetLinks} header={
            <div className="flex flex-col gap-1">
                <h2 className="font-semibold text-xl text-gray-800 leading-tight">Print Asset Stickers</h2>
                <p className="text-sm text-gray-500">Select assets to create printable A4 sticker sheets.</p>
            </div>
        }>
            <Head title="Print Asset Stickers" />
            <div className="pt-2 pb-6 sm:pb-10">
                <div className="max-w-[100rem] mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row lg:items-end gap-4">
                            <div className="flex-1">
                                <label htmlFor="sticker-search" className="block text-xs font-black uppercase tracking-wider text-gray-500">Search Assets</label>
                                <input id="sticker-search" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by asset name, tag, branch, or department..." className="mt-1 block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <button type="button" onClick={toggleVisibleAssets} disabled={visibleIds.length === 0} className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">
                                    {allVisibleSelected ? 'Deselect Visible' : 'Select Visible'}
                                </button>
                                <SecondaryButton type="button" onClick={downloadStickers} disabled={selectedAssets.length === 0} className="!border-indigo-600 !bg-indigo-600 !text-white hover:!bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
                                    Download PDF ({selectedAssets.length})
                                </SecondaryButton>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="w-12 px-4 py-3 text-left">
                                            <input type="checkbox" aria-label="Select visible assets" checked={allVisibleSelected} onChange={toggleVisibleAssets} disabled={visibleIds.length === 0} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500" />
                                        </th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Asset Name</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Asset Tag / Number</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Branch</th>
                                        <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wider text-gray-500">Department</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {filteredAssets.map(asset => (
                                        <tr key={asset.id} className={selectedAssets.includes(asset.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}>
                                            <td className="px-4 py-3"><input type="checkbox" checked={selectedAssets.includes(asset.id)} onChange={() => toggleAsset(asset.id)} aria-label={`Select ${asset.name || 'asset'}`} className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500" /></td>
                                            <td className="px-4 py-3 text-sm font-bold text-gray-900">{asset.name || 'Unnamed Asset'}</td>
                                            <td className="px-4 py-3 text-sm font-mono text-gray-700">{asset.asset_tag || 'No Asset Tag'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{asset.branch || 'Unassigned'}</td>
                                            <td className="px-4 py-3 text-sm text-gray-600">{asset.department || '-'}</td>
                                        </tr>
                                    ))}
                                    {filteredAssets.length === 0 && <tr><td colSpan="5" className="px-4 py-10 text-center text-sm text-gray-500">No assets match your search.</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div className="border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                            {filteredAssets.length} asset(s) shown - {selectedAssets.length} selected. The QR area will remain blank in the generated stickers.
                        </div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}
