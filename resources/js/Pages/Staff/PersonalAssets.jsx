import React, { useState, useMemo } from 'react';
import { Head } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';
import TextInput from '@/Components/TextInput';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import { getDashboardLinks } from '@/Config/navigation'; 

// 🟢 RENAMED COMPONENT TO PREVENT CONFLICTS
export default function PersonalAssets({ auth, myAssets }) {
    // Uses standard dashboard links for staff (hides admin menus)
    const sidebarLinks = getDashboardLinks(); 

    const [search, setSearch] = useState('');
    const [viewingAsset, setViewingAsset] = useState(null);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);

    const safeAssets = Array.isArray(myAssets) ? myAssets : [];

    const openViewModal = (asset) => { setViewingAsset(asset); setIsViewModalOpen(true); };
    const closeViewModal = () => { setIsViewModalOpen(false); setTimeout(() => setViewingAsset(null), 300); };

    // Calculate Stats for their personal items
    const stats = useMemo(() => {
        let totalItems = 0; let totalValue = 0; let needsMaintenance = 0;
        
        safeAssets.forEach(asset => {
            const qty = Number(asset.qty || 1);
            const val = parseFloat(asset.total_value || (asset.unit_value * asset.qty) || 0) || 0;
            totalItems += qty; totalValue += val;
            if (['Broken', 'For Repair', 'Missing'].includes(asset.condition)) needsMaintenance++;
        });

        return { totalItems, totalValue, needsMaintenance };
    }, [safeAssets]);

    // Simple Filter
    const filteredAssets = useMemo(() => {
        return safeAssets.filter(asset => {
            const searchTerm = String(search || '').toLowerCase();
            const safeName = String(asset?.name || '').toLowerCase();
            const safeTag = String(asset?.asset_tag || '').toLowerCase();
            const safeSerial = String(asset?.serial_no || '').toLowerCase();
            return safeName.includes(searchTerm) || safeTag.includes(searchTerm) || safeSerial.includes(searchTerm);
        });
    }, [safeAssets, search]);

    const getBranchValue = (branchData) => {
        if (!branchData) return '';
        if (typeof branchData === 'object' && branchData.name) return branchData.name;
        return String(branchData);
    };

    return (
        <SidebarLayout 
            activeModule="Dashboard" 
            sidebarLinks={sidebarLinks}
            header={<h2 className="font-semibold text-xl text-gray-800 leading-tight">My Assigned Assets</h2>}
        >
            <Head title="My Assets" />
            <div className="py-6 sm:py-12">
                <div className="max-w-[80rem] mx-auto sm:px-6 lg:px-8">
                    
                    {/* PERSONAL STATS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg></div>
                            <div><p className="text-sm font-medium text-gray-500">My Items</p><p className="text-2xl font-bold text-gray-900">{stats.totalItems}</p></div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                            <div><p className="text-sm font-medium text-gray-500">Total Est. Value</p><p className="text-2xl font-bold text-gray-900">₱ {stats.totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}</p></div>
                        </div>
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
                            <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-red-50 flex items-center justify-center text-red-600"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg></div>
                            <div><p className="text-sm font-medium text-gray-500">Needs Action</p><p className="text-2xl font-bold text-gray-900">{stats.needsMaintenance}</p></div>
                        </div>
                    </div>

                    <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6 max-w-sm">
                        <InputLabel value="Search My Assets" />
                        <TextInput className="w-full mt-1" placeholder="Search by name, tag, or serial no..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>

                    {/* One-View Full Data Table */}
                    <div className="bg-white rounded-lg shadow border border-gray-200 w-full overflow-hidden">
                        <table className="w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Asset Name</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Asset Tag</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Serial No.</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Model No.</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Color</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Category</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Status</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Condition</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Department</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Branch</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Area</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Supplier</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Purchased</th>
                                    <th className="px-1 py-1.5 text-left text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Warranty</th>
                                    <th className="px-1 py-1.5 text-center text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Qty</th>
                                    <th className="px-1 py-1.5 text-right text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Unit Value</th>
                                    <th className="px-1 py-1.5 text-right text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap">Total Value</th>
                                    <th className="px-1 py-1.5 text-right text-[8.5px] font-black text-gray-500 uppercase tracking-tighter whitespace-nowrap bg-gray-50">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAssets.length === 0 ? (
                                    <tr><td colSpan="18" className="px-4 py-8 text-center text-gray-500 italic text-sm">No assets found assigned to you.</td></tr>
                                ) : (
                                    filteredAssets.map((asset) => (
                                        <tr key={asset?.id} className="hover:bg-indigo-50/50 transition-colors text-[9.5px] text-gray-800">
                                            
                                            <td className="px-1 py-1.5 whitespace-nowrap"><button type="button" onClick={() => openViewModal(asset)} className="font-bold text-indigo-700 hover:text-indigo-900 hover:underline">{asset?.name}</button></td>
                                            <td className="px-1 py-1.5 font-mono whitespace-nowrap text-gray-600">{asset?.asset_tag}</td>
                                            <td className="px-1 py-1.5 font-mono whitespace-nowrap text-gray-600">{asset?.serial_no || '-'}</td>
                                            <td className="px-1 py-1.5 whitespace-nowrap">{asset?.model_no || '-'}</td>
                                            <td className="px-1 py-1.5 whitespace-nowrap">{asset?.color || '-'}</td>
                                            <td className="px-1 py-1.5 whitespace-nowrap">{asset?.category || '-'}</td>
                                            <td className="px-1 py-1.5 font-bold whitespace-nowrap text-gray-900">{asset?.asset_status || 'Assigned'}</td>
                                            
                                            <td className="px-1 py-1.5 whitespace-nowrap">
                                                <span className={`px-1 py-0.5 inline-flex text-[8px] font-black tracking-widest uppercase rounded border ${
                                                    asset?.condition === 'Good' ? 'bg-green-50 text-green-700 border-green-200' : 
                                                    asset?.condition === 'Broken' ? 'bg-red-50 text-red-700 border-red-200' : 
                                                    asset?.condition === 'Missing' ? 'bg-gray-100 text-gray-700 border-gray-300' : 
                                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                                                }`}>
                                                    {asset?.condition || 'Unknown'}
                                                </span>
                                            </td>

                                            <td className="px-1 py-1.5 whitespace-nowrap">{asset?.department || '-'}</td>
                                            <td className="px-1 py-1.5 whitespace-nowrap font-bold text-indigo-600">{getBranchValue(asset?.branch) || '-'}</td>
                                            <td className="px-1 py-1.5 whitespace-nowrap">{asset?.area || '-'}</td>
                                            <td className="px-1 py-1.5 whitespace-nowrap">{asset?.supplier_name || '-'}</td>

                                            <td className="px-1 py-1.5 whitespace-nowrap text-gray-600">
                                                {asset?.purchase_date ? new Date(asset.purchase_date).toLocaleDateString() : '-'}
                                            </td>

                                            <td className="px-1 py-1.5 whitespace-nowrap">
                                                <span className={`${asset?.warranty_expiration && new Date(asset.warranty_expiration) < new Date() ? 'text-red-600 font-bold' : 'text-gray-600'}`}>
                                                    {asset?.warranty_expiration ? new Date(asset.warranty_expiration).toLocaleDateString() : '-'}
                                                </span>
                                            </td>

                                            <td className="px-1 py-1.5 text-center font-bold whitespace-nowrap text-gray-900">{asset?.qty || 1}</td>

                                            <td className="px-1 py-1.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                                                ₱{parseFloat(asset?.unit_value || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                            </td>

                                            <td className="px-1 py-1.5 text-right font-bold text-emerald-600 whitespace-nowrap">
                                                ₱{parseFloat(asset?.total_value || (asset?.unit_value * asset?.qty) || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                            </td>
                                            
                                            <td className="px-1 py-1.5 text-right font-medium whitespace-nowrap">
                                                <button onClick={() => openViewModal(asset)} className="text-blue-600 hover:text-blue-900 font-bold">View</button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>

            {/* VIEW DETAILS MODAL */}
            <Modal show={isViewModalOpen} onClose={closeViewModal} maxWidth="3xl">
                {viewingAsset && (
                    <div className="p-8">
                        {/* Header Section */}
                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                            <div>
                                <h2 className="text-2xl font-black text-gray-900">{viewingAsset?.name}</h2>
                                <p className="text-sm font-bold text-indigo-600 mt-1">{viewingAsset?.asset_tag}</p>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                <span className={`px-4 py-1.5 inline-flex text-sm font-bold rounded-full border ${
                                    viewingAsset?.condition === 'Good' ? 'bg-green-50 text-green-700 border-green-200' : 
                                    viewingAsset?.condition === 'Broken' ? 'bg-red-50 text-red-700 border-red-200' : 
                                    viewingAsset?.condition === 'Missing' ? 'bg-gray-100 text-gray-700 border-gray-300' : 
                                    'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }`}>
                                    {viewingAsset?.condition || 'Unknown'}
                                </span>
                                <span className="text-[10px] uppercase font-black text-gray-400 tracking-wider">
                                    Status: <span className="text-gray-700">{viewingAsset?.asset_status || 'Assigned'}</span>
                                </span>
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                            
                            {/* Specifications Column */}
                            <div className="space-y-4 bg-gray-50 p-5 rounded-lg border border-gray-100">
                                <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">Specifications</h4>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Category:</span> 
                                    <span className="font-bold text-gray-900">{viewingAsset?.category || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Classification:</span> 
                                    <span className="font-bold text-gray-900">{viewingAsset?.classification || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Model No:</span> 
                                    <span className="font-bold text-gray-900">{viewingAsset?.model_no || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between border-b border-gray-200 pb-2">
                                    <span className="text-gray-500">Serial No:</span> 
                                    <span className="font-bold font-mono text-gray-900">{viewingAsset?.serial_no || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between pb-1">
                                    <span className="text-gray-500">Color:</span> 
                                    <span className="font-bold text-gray-900">{viewingAsset?.color || 'N/A'}</span>
                                </div>
                            </div>

                            {/* Assignment & Location Column */}
                            <div className="space-y-4 bg-indigo-50/50 p-5 rounded-lg border border-indigo-50">
                                <h4 className="text-[11px] font-black text-indigo-400 uppercase tracking-wider mb-2">Assignment Details</h4>
                                <div className="flex justify-between border-b border-indigo-100 pb-2">
                                    <span className="text-gray-500">Assigned To:</span> 
                                    <span className="font-bold text-indigo-700 text-right">
                                        {viewingAsset?.user ? viewingAsset?.user?.name : (viewingAsset?.assigned_personnel || 'Unassigned')}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-indigo-100 pb-2">
                                    <span className="text-gray-500">Branch:</span> 
                                    <span className="font-bold text-gray-900">
                                        {typeof getBranchValue === 'function' ? getBranchValue(viewingAsset?.branch) : (viewingAsset?.branch || 'N/A')}
                                    </span>
                                </div>
                                <div className="flex justify-between border-b border-indigo-100 pb-2">
                                    <span className="text-gray-500">Department:</span> 
                                    <span className="font-bold text-gray-900">{viewingAsset?.department || 'N/A'}</span>
                                </div>
                                <div className="flex justify-between pb-1">
                                    <span className="text-gray-500">Area:</span> 
                                    <span className="font-bold text-gray-900">{viewingAsset?.area || 'N/A'}</span>
                                </div>
                            </div>

                            {/* Procurement & Financials Column */}
                            <div className="space-y-4 bg-emerald-50/50 p-5 rounded-lg border border-emerald-50 md:col-span-2">
                                <h4 className="text-[11px] font-black text-emerald-500 uppercase tracking-wider mb-2">Procurement & Financials</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                                        <span className="text-gray-500">Supplier:</span> 
                                        <span className="font-bold text-gray-900">{viewingAsset?.supplier_name || 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                                        <span className="text-gray-500">Purchase Date:</span> 
                                        <span className="font-bold text-gray-900">{viewingAsset?.purchase_date ? new Date(viewingAsset.purchase_date).toLocaleDateString() : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-emerald-100 pb-2">
                                        <span className="text-gray-500">Warranty Exp:</span> 
                                        <span className={`font-bold ${
                                            viewingAsset?.warranty_expiration && new Date(viewingAsset.warranty_expiration) < new Date() 
                                                ? 'text-red-600' // Red if expired
                                                : 'text-gray-900'
                                        }`}>
                                            {viewingAsset?.warranty_expiration ? new Date(viewingAsset.warranty_expiration).toLocaleDateString() : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between pb-1">
                                        <span className="text-gray-500">Value (Qty {viewingAsset?.qty || 1}):</span> 
                                        <span className="font-bold text-emerald-700">
                                            ₱{parseFloat(viewingAsset?.total_value || (viewingAsset?.unit_value * viewingAsset?.qty) || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="mt-8 flex justify-end">
                            <PrimaryButton type="button" onClick={closeViewModal}>Close</PrimaryButton>
                        </div>
                    </div>
                )}
            </Modal>

        </SidebarLayout>
    );
}