import React, { useState } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import SelectInput from '@/Components/SelectInput';

export default function AddAssetModal({ show, onClose, suppliers, departments, branches, onSubmit }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [imagePreview, setImagePreview] = useState('');
    const form = useForm({
        name: '',
        asset_tag: '',
        category: '',
        classification: '',
        department: '',
        branch: '',
        area: '',
        assigned_personnel: '',
        purchase_date: '',
        supplier_id: '',
        warranty_expiration: '',
        condition: 'Good',
        unit_value: '',
        qty: 1,
        asset_status: 'New',
        model_no: '',
        serial_no: '',
        color: '',
        image: null,
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        form.post(route('admin.assets.store'), {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmitting(false);
                form.reset();
                onSubmit?.();
                onClose();
            },
            onError: (errors) => {
                setIsSubmitting(false);
            },
            forceFormData: true,
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="xl">
            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Add New Asset</h2>
                        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                    </div>
                    {Object.keys(form.errors).length > 0 && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{Object.values(form.errors).join(' ')}</div>}

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Asset Name *</label>
                                <TextInput value={form.data.name} onChange={e => form.setData('name', e.target.value)} className="mt-1 w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Asset Tag *</label>
                                <TextInput value={form.data.asset_tag} onChange={e => form.setData('asset_tag', e.target.value)} className="mt-1 w-full" placeholder="e.g., AST-12345" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Category</label>
                                <TextInput value={form.data.category} onChange={e => form.setData('category', e.target.value)} className="mt-1 w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Classification</label>
                                <TextInput value={form.data.classification} onChange={e => form.setData('classification', e.target.value)} className="mt-1 w-full" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Department</label>
                                <TextInput value={form.data.department} onChange={e => form.setData('department', e.target.value)} className="mt-1 w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Branch</label>
                                <TextInput value={form.data.branch} onChange={e => form.setData('branch', e.target.value)} className="mt-1 w-full" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Assigned Personnel</label>
                                <TextInput value={form.data.assigned_personnel} onChange={e => form.setData('assigned_personnel', e.target.value)} className="mt-1 w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Area</label>
                                <TextInput value={form.data.area} onChange={e => form.setData('area', e.target.value)} className="mt-1 w-full" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Purchase Date</label>
                                <TextInput type="date" value={form.data.purchase_date} onChange={e => form.setData('purchase_date', e.target.value)} className="mt-1 w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Warranty Expiration</label>
                                <TextInput type="date" value={form.data.warranty_expiration} onChange={e => form.setData('warranty_expiration', e.target.value)} className="mt-1 w-full" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Supplier</label>
                                <select
                                    value={form.data.supplier_id}
                                    onChange={e => form.setData('supplier_id', e.target.value)}
                                    className="mt-1 w-full rounded-md border-gray-300"
                                >
                                    <option value="">Select supplier</option>
                                    {suppliers?.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Condition *</label>
                                <select
                                    value={form.data.condition}
                                    onChange={e => form.setData('condition', e.target.value)}
                                    className="mt-1 w-full rounded-md border-gray-300"
                                >
                                    <option value="Excellent">Excellent</option>
                                    <option value="Good">Good</option>
                                    <option value="Fair">Fair</option>
                                    <option value="Poor">Poor</option><option value="Defective">Defective</option><option value="For checking">For checking</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                <select
                                    value={form.data.asset_status}
                                    onChange={e => form.setData('asset_status', e.target.value)}
                                    className="mt-1 w-full rounded-md border-gray-300"
                                >
                                    <option value="New">New</option>
                                    <option value="Assigned">Assigned</option>
                                    <option value="In Storage">In Storage</option>
                                    <option value="Maintenance">Maintenance</option>
                                    <option value="Disposed">Disposed</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Quantity</label>
                                <TextInput
                                    type="number"
                                    min="1"
                                    value={form.data.qty}
                                    onChange={e => form.setData('qty', parseInt(e.target.value) || 1)}
                                    className="mt-1 w-full"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Unit Value</label>
                                <TextInput
                                    type="number"
                                    value={form.data.unit_value}
                                    onChange={e => form.setData('unit_value', e.target.value)}
                                    className="mt-1 w-full"
                                    placeholder="₱0.00"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Serial No.</label>
                                <TextInput value={form.data.serial_no} onChange={e => form.setData('serial_no', e.target.value)} className="mt-1 w-full" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Model No.</label>
                                <TextInput value={form.data.model_no} onChange={e => form.setData('model_no', e.target.value)} className="mt-1 w-full" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Color</label>
                                <TextInput value={form.data.color} onChange={e => form.setData('color', e.target.value)} className="mt-1 w-full" />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700">Asset Photo (optional)</label>
                            <label className="mt-1 flex cursor-pointer items-center justify-between rounded-lg border-2 border-dashed border-indigo-200 bg-indigo-50 px-4 py-3 hover:bg-indigo-100"><span className="text-sm font-black text-indigo-800">Choose photo or open camera</span><span className="rounded-md bg-indigo-600 px-3 py-2 text-xs font-black text-white">Choose file</span><input type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files[0]; form.setData('image', file); setImagePreview(file ? URL.createObjectURL(file) : ''); }} className="sr-only" /></label>
                            {imagePreview && <img src={imagePreview} alt="New asset preview" className="mt-3 max-h-48 w-full rounded-md object-contain border bg-gray-50 p-2" />}
                            <p className="mt-1 text-xs text-gray-500">On a phone, this opens the camera and requests permission when required. You may also choose an existing image.</p>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                        <PrimaryButton disabled={isSubmitting || form.processing}>
                            {isSubmitting || form.processing ? 'Saving...' : 'Save Asset'}
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
