import React, { useState, useRef } from 'react';
import { Head, useForm, router } from '@inertiajs/react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import Modal from '@/Components/Modal';
import InputLabel from '@/Components/InputLabel';
import TextInput from '@/Components/TextInput';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import DangerButton from '@/Components/DangerButton';
import { getAdminLinks } from "@/Config/navigation";

export default function ResourceLinks({ auth, links }) {
    const adminLinks = getAdminLinks(auth);
    
    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingLink, setEditingLink] = useState(null);
    const [linkToDelete, setLinkToDelete] = useState(null);
    const fileInputRef = useRef(null); 

    // 🟢 Drag and Drop State
    const [draggedItem, setDraggedItem] = useState(null);

    // Form handling
    const { data, setData, post, delete: destroy, processing, errors, reset, clearErrors } = useForm({
        title: '',
        url: '',
        description: '',
        type: 'internal',
        is_active: true,
        image: null, 
    });

    // --- Drag and Drop Handlers ---
    const handleDragStart = (e, link) => {
        setDraggedItem(link);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => e.target.classList.add('opacity-40', 'bg-indigo-50'), 0);
    };

    const handleDragEnd = (e) => {
        e.target.classList.remove('opacity-40', 'bg-indigo-50');
        setDraggedItem(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('border-t-2', 'border-indigo-400');
    };

    const handleDragLeave = (e) => {
        e.currentTarget.classList.remove('border-t-2', 'border-indigo-400');
    };

    const handleDrop = (e, targetLink, groupType) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-t-2', 'border-indigo-400');
        
        // Prevent dropping on itself or between different groups (Internal vs External)
        if (!draggedItem || draggedItem.id === targetLink.id) return;
        if (draggedItem.type !== groupType) return; 

        // Extract the current group
        const currentGroup = links.filter(l => l.type === groupType);
        
        const currentIndex = currentGroup.findIndex(l => l.id === draggedItem.id);
        const targetIndex = currentGroup.findIndex(l => l.id === targetLink.id);

        // Rearrange array locally
        const newGroup = [...currentGroup];
        newGroup.splice(currentIndex, 1);
        newGroup.splice(targetIndex, 0, draggedItem);

        // Package data for backend
        const orderedItems = newGroup.map((item, index) => ({
            id: item.id,
            sort_order: index
        }));

        // Send to controller
        router.post(route('admin.resource-links.reorder'), { items: orderedItems }, {
            preserveScroll: true,
        });
    };
    // ---------------------------------

    const openCreateModal = () => {
        setEditingLink(null);
        reset();
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        clearErrors();
        setIsModalOpen(true);
    };

    const openEditModal = (link) => {
        setEditingLink(link);
        setData({
            title: link.title,
            url: link.url,
            description: link.description || '',
            type: link.type,
            is_active: link.is_active,
            image: null, 
        });
        if (fileInputRef.current) fileInputRef.current.value = ""; 
        clearErrors();
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        if (editingLink) {
            router.post(route('admin.resource-links.update', editingLink.id), {
                _method: 'put',
                title: data.title,
                url: data.url,
                description: data.description || '',
                type: data.type,
                is_active: data.is_active ? 1 : 0,
                image: data.image,
            }, {
                forceFormData: true,
                onSuccess: () => setIsModalOpen(false),
            });
        } else {
            post(route('admin.resource-links.store'), {
                forceFormData: true,
                onSuccess: () => setIsModalOpen(false),
            });
        }
    };

    const confirmDelete = (link) => {
        setLinkToDelete(link);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = () => {
        destroy(route('admin.resource-links.destroy', linkToDelete.id), {
            onSuccess: () => setIsDeleteModalOpen(false),
        });
    };

    const internalLinks = links?.filter(link => link.type === 'internal') || [];
    const externalLinks = links?.filter(link => link.type === 'external') || [];

    // 🟢 Updated Row with Draggable attributes
    const renderRow = (link) => (
        <tr 
            key={link.id} 
            draggable
            onDragStart={(e) => handleDragStart(e, link)}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, link, link.type)}
            className="hover:bg-gray-50 transition-colors cursor-move"
            title="Drag to reorder"
        >
            {/* Drag Handle Icon */}
            <td className="px-3 py-4 whitespace-nowrap text-gray-400 text-center w-10">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                </svg>
            </td>
            
            <td className="px-6 py-4 whitespace-nowrap pointer-events-none">
                {link.image_path ? (
                    <img src={`/storage/${link.image_path}`} alt="logo" draggable="false" className="h-8 w-8 object-contain rounded bg-white shadow-sm p-1 border border-gray-200" />
                ) : (
                    <span className="text-xs text-gray-400 italic">Auto</span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 pointer-events-none">{link.title}</td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-xs">
                <a href={link.url} target="_blank" rel="noopener noreferrer" onDragStart={(e) => e.preventDefault()} className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer relative z-10">{link.url}</a>
            </td>
            <td className="px-6 py-4 whitespace-nowrap pointer-events-none">
                {link.is_active ? (
                    <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Active</span>
                ) : (
                    <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-600">Hidden</span>
                )}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium relative z-10">
                <button onClick={() => openEditModal(link)} className="text-indigo-600 hover:text-indigo-900 mr-4 transition-colors">Edit</button>
                <button onClick={() => confirmDelete(link)} className="text-red-600 hover:text-red-900 transition-colors">Delete</button>
            </td>
        </tr>
    );

    return (
        <SidebarLayout activeModule="Admin" sidebarLinks={adminLinks} header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Resource Links Management</h2>}>
            <Head title="Manage Resource Links" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    
                    <div className="mb-6 flex justify-between items-center">
                        <p className="text-gray-600">Drag and drop rows to reorder how they appear in the user directories.</p>
                        <PrimaryButton onClick={openCreateModal}>+ Add New Link</PrimaryButton>
                    </div>

                    <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg border border-gray-200">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 select-none">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {/* Added header space for the drag icon */}
                                        <th className="px-3 py-3 w-10"></th> 
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Logo</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Target URL</th>
                                        <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    
                                    {internalLinks.length > 0 && (
                                        <>
                                            <tr className="bg-slate-100 border-t border-slate-200">
                                                {/* Adjusted colSpan from 5 to 6 to account for the new drag icon column */}
                                                <td colSpan="6" className="px-6 py-3 text-sm font-bold text-slate-800 uppercase tracking-wide">
                                                    Internal Links ({internalLinks.length})
                                                </td>
                                            </tr>
                                            {internalLinks.map(renderRow)}
                                        </>
                                    )}

                                    {externalLinks.length > 0 && (
                                        <>
                                            <tr className="bg-slate-100 border-t border-slate-200">
                                                <td colSpan="6" className="px-6 py-3 text-sm font-bold text-slate-800 uppercase tracking-wide">
                                                    External Links ({externalLinks.length})
                                                </td>
                                            </tr>
                                            {externalLinks.map(renderRow)}
                                        </>
                                    )}

                                    {links.length === 0 && (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-8 text-center text-gray-500">
                                                No resource links have been added yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal show={isModalOpen} onClose={() => setIsModalOpen(false)}>
                <form onSubmit={handleSubmit} className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6">
                        {editingLink ? 'Edit Resource Link' : 'Add New Resource Link'}
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <InputLabel htmlFor="title" value="Link Title" />
                            <TextInput id="title" type="text" className="mt-1 block w-full" value={data.title} onChange={e => setData('title', e.target.value)} required />
                            <InputError message={errors.title} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="url" value="Target URL" />
                            <TextInput id="url" type="text" className="mt-1 block w-full" value={data.url} onChange={e => setData('url', e.target.value)} placeholder="https://..." required />
                            <InputError message={errors.url} className="mt-2" />
                        </div>

                        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                            <InputLabel htmlFor="image" value="Custom Logo Upload (Optional)" className="font-bold text-gray-700" />
                            <p className="text-xs text-gray-500 mb-2">If left blank, the system will try to automatically fetch the company logo.</p>
                            
                            <input
                                type="file"
                                id="image"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={e => setData('image', e.target.files[0])}
                                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                            />
                            <InputError message={errors.image} className="mt-2" />
                            
                            {editingLink && editingLink.image_path && !data.image && (
                                <div className="mt-3">
                                    <p className="text-xs text-gray-500 mb-1">Current Image:</p>
                                    <img src={`/storage/${editingLink.image_path}`} alt="Current Logo" className="h-16 object-contain rounded border bg-white p-1" />
                                </div>
                            )}
                        </div>

                        <div>
                            <InputLabel htmlFor="description" value="Short Description (Optional)" />
                            <TextInput id="description" type="text" className="mt-1 block w-full" value={data.description} onChange={e => setData('description', e.target.value)} />
                            <InputError message={errors.description} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="type" value="Directory Type" />
                            <select id="type" className="mt-1 block w-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm" value={data.type} onChange={e => setData('type', e.target.value)}>
                                <option value="internal">Internal Links</option>
                                <option value="external">External Links</option>
                            </select>
                            <InputError message={errors.type} className="mt-2" />
                        </div>

                        <div className="flex items-center mt-4">
                            <input id="is_active" type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500" checked={data.is_active} onChange={e => setData('is_active', e.target.checked)} />
                            <label htmlFor="is_active" className="ml-2 text-sm text-gray-600">Active (Visible to employees)</label>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={() => setIsModalOpen(false)}>Cancel</SecondaryButton>
                        <PrimaryButton disabled={processing}>
                            {editingLink ? 'Save Changes' : 'Create Link'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} maxWidth="sm">
                <div className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Confirm Deletion</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Are you sure you want to delete the link for <strong>{linkToDelete?.title}</strong>? This action cannot be undone.
                    </p>
                    <div className="flex justify-end gap-3">
                        <SecondaryButton onClick={() => setIsDeleteModalOpen(false)}>Cancel</SecondaryButton>
                        <DangerButton onClick={handleDelete} disabled={processing}>Delete</DangerButton>
                    </div>
                </div>
            </Modal>
        </SidebarLayout>
    );
}