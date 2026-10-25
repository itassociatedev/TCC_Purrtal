import ConfirmModal from '@/Components/ConfirmModal';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getPRPOLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { useState } from 'react';

export default function SuppliersIndex({ auth, suppliers = [] }) {
    const PRPOLinks = getPRPOLinks(auth);
    
    const userRole = auth.user.role?.name?.toLowerCase().trim() || '';
    const canManageSuppliers = userRole.includes('procurement') || userRole.includes('admin');

    const [selectedSuppliers, setSelectedSuppliers] = useState([]);
    const [filterSupplierSearch, setFilterSupplierSearch] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        confirmColor: '',
        onConfirm: () => {},
    });

    const { data, setData, post, put, processing, errors, reset } = useForm({
        name: '',
        contact_person: '',
        contact_number: '',
        email: '',
        address: '',
    });

    const filteredSuppliers = suppliers.filter(s =>
        s.name.toLowerCase().includes(filterSupplierSearch.toLowerCase())
    );

    const handleAdd = () => {
        reset();
        setSelectedSupplier(null);
        setIsModalOpen(true);
    };

    const handleEdit = (supplier) => {
        setData({
            name: supplier.name || '',
            contact_person: supplier.contact_person || '',
            contact_number: supplier.contact_number || '',
            email: supplier.email || '',
            address: supplier.address || '',
        });
        setSelectedSupplier(supplier);
        setIsModalOpen(true);
    };

    const handleSave = (e) => {
        e.preventDefault();
        if (selectedSupplier) {
            put(route('prpo.suppliers.update', selectedSupplier.id), {
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                },
            });
        } else {
            post(route('prpo.suppliers.store'), {
                onSuccess: () => {
                    setIsModalOpen(false);
                    reset();
                },
            });
        }
    };

    const handleDelete = (supplier) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Supplier',
            message: `Are you sure you want to delete "${supplier.name}"?`,
            confirmText: 'Delete',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('prpo.suppliers.destroy', supplier.id), {
                    onSuccess: () => {
                        setConfirmDialog({ ...confirmDialog, isOpen: false });
                    },
                });
            },
        });
    };

    const handleToggleStatus = (supplier) => {
        router.patch(
            route('prpo.suppliers.toggle-status', supplier.id),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    // Refresh the list
                },
            }
        );
    };

    return (
        <SidebarLayout activeModule="PR/PO Module" sidebarLinks={PRPOLinks}>
            <Head title="Suppliers Management" />

            <div className="mx-auto max-w-7xl py-6 px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Suppliers Masterlist</h2>
                        <p className="mt-1 text-sm text-gray-500">Manage supplier information and details.</p>
                    </div>
                    {canManageSuppliers && (
                        <PrimaryButton onClick={handleAdd}>+ Add Supplier</PrimaryButton>
                    )}
                </div>

                <div className="mb-6 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <input
                        type="text"
                        placeholder="Search suppliers..."
                        value={filterSupplierSearch}
                        onChange={(e) => setFilterSupplierSearch(e.target.value)}
                        className="block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                </div>

                <div className="bg-white shadow-sm rounded-lg overflow-hidden border border-gray-200">
                    <table className="w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contact Person</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Email</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-gray-500">
                                        No suppliers found.
                                    </td>
                                </tr>
                            ) : (
                                filteredSuppliers.map((supplier) => (
                                    <tr key={supplier.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 text-sm font-medium text-gray-900">{supplier.name}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.contact_person || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">{supplier.email || '-'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${supplier.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {supplier.is_active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm space-x-2">
                                            {canManageSuppliers && (
                                                <>
                                                    <button
                                                        onClick={() => handleEdit(supplier)}
                                                        className="text-indigo-600 hover:text-indigo-900 font-medium"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(supplier)}
                                                        className="text-red-600 hover:text-red-900 font-medium"
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Add/Edit Modal */}
                <Modal show={isModalOpen} onClose={() => setIsModalOpen(false)} maxWidth="md">
                    <div className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">
                            {selectedSupplier ? 'Edit Supplier' : 'Add New Supplier'}
                        </h3>
                        
                        <form onSubmit={handleSave} className="space-y-4">
                            <div>
                                <InputLabel htmlFor="name" value="Supplier Name" />
                                <TextInput
                                    id="name"
                                    type="text"
                                    value={data.name}
                                    onChange={(e) => setData('name', e.target.value)}
                                    className="mt-1 block w-full"
                                    required
                                />
                                <InputError message={errors.name} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="contact_person" value="Contact Person" />
                                <TextInput
                                    id="contact_person"
                                    type="text"
                                    value={data.contact_person}
                                    onChange={(e) => setData('contact_person', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="email" value="Email" />
                                <TextInput
                                    id="email"
                                    type="email"
                                    value={data.email}
                                    onChange={(e) => setData('email', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="contact_number" value="Contact Number" />
                                <TextInput
                                    id="contact_number"
                                    type="text"
                                    value={data.contact_number}
                                    onChange={(e) => setData('contact_number', e.target.value)}
                                    className="mt-1 block w-full"
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="address" value="Address" />
                                <textarea
                                    id="address"
                                    value={data.address}
                                    onChange={(e) => setData('address', e.target.value)}
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    rows="3"
                                />
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <SecondaryButton onClick={() => setIsModalOpen(false)}>Cancel</SecondaryButton>
                                <PrimaryButton type="submit" disabled={processing}>
                                    {processing ? 'Saving...' : 'Save'}
                                </PrimaryButton>
                            </div>
                        </form>
                    </div>
                </Modal>

                <ConfirmModal
                    show={confirmDialog.isOpen}
                    title={confirmDialog.title}
                    message={confirmDialog.message}
                    confirmText={confirmDialog.confirmText}
                    confirmColor={confirmDialog.confirmColor}
                    onConfirm={confirmDialog.onConfirm}
                    onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                />
            </div>
        </SidebarLayout>
    );
}
