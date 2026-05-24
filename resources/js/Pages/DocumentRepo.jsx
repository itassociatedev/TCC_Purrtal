import ConfirmModal from '@/Components/ConfirmModal';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getDocumentSidebarLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { formatAppDate } from '@/Utils/date';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useState } from 'react';

export default function Documents({ auth, documents = [], categories = [], departments = [], branches = [], activeCategory }) {

    const isAdmin = ['admin', 'HRBP', 'HR Assistant', 'Human Resources Assistant'].includes(auth.user?.role?.name) || 
                    auth.user?.permissions?.includes('director of corporate services and operations');
    const sidebarLinks = getDocumentSidebarLinks(categories, activeCategory);
    const { system } = usePage().props;

    const [viewingDoc, setViewingDoc] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');

    // Office Viewer for Word/Excel files
    const getViewerUrl = (doc) => {
        const appUrl = window.location.origin; 
        const fullFileUrl = `${appUrl}/storage/${doc.file_path}`; 
        return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fullFileUrl)}`;
    };

    // Google Docs Viewer for PDFs (Mobile & Desktop)
    const getPdfViewerUrl = (doc) => {
        const appUrl = window.location.origin; 
        const fullFileUrl = `${appUrl}/storage/${doc.file_path}`; 
        return `https://docs.google.com/gview?url=${encodeURIComponent(fullFileUrl)}&embedded=true&rm=minimal`;
    };

    // --- Manage Categories Modal State ---
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    
    // Inline Category Edit State
    const [editingCategoryId, setEditingCategoryId] = useState(null);
    const [editCategoryName, setEditCategoryName] = useState('');

    const { data: catData, setData: setCatData, post: postCategory, processing: catProcessing, reset: resetCat, clearErrors: clearCatErrors } = useForm({ name: '' });

    const closeCategoryModal = () => { 
        setIsCategoryModalOpen(false); 
        resetCat(); 
        clearCatErrors(); 
        setEditingCategoryId(null);
    };
    
    const submitCategory = (e) => {
        e.preventDefault();
        postCategory(route('admin.documents.category.store'), { 
            preserveScroll: true, 
            onSuccess: () => {
                resetCat();
            } 
        });
    };

    // Start inline edit
    const startEditingCategory = (category) => {
        setEditingCategoryId(category.id);
        setEditCategoryName(category.name);
    };

    // Cancel inline edit
    const cancelEditingCategory = () => {
        setEditingCategoryId(null);
        setEditCategoryName('');
    };

    // Save inline edit
    const saveCategoryEdit = (categoryId) => {
        if (!editCategoryName.trim()) return;
        
        router.patch(route('admin.documents.category.update', categoryId), {
            name: editCategoryName
        }, {
            preserveScroll: true,
            onSuccess: () => cancelEditingCategory(),
        });
    };

    const deleteCategory = (categoryId, categoryName) => {
        if (confirm(`Are you sure you want to delete the "${categoryName}" category?`)) {
            router.delete(route('admin.documents.category.destroy', categoryId), {
                preserveScroll: true,
            });
        }
    };

    // Toggle Downloadable Status
    const toggleDownloadable = (categoryId, isDownloadable) => {
        router.patch(route('admin.documents.category.toggle-downloadable', categoryId), {
            is_downloadable: isDownloadable
        }, { 
            preserveScroll: true 
        });
    };

    // --- Upload / Edit Document Modal State ---
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null); 
    
    const { data: uploadData, setData: setUploadData, post: postDocument, processing: uploadProcessing, errors: uploadErrors, reset: resetUpload, clearErrors: clearUploadErrors } = useForm({
        title: '', 
        category: activeCategory !== 'Overview' ? activeCategory : '', 
        department_id: '', 
        branch_id: '', 
        description: '', 
        file: null,
        _method: 'POST', 
    });

    const closeUploadModal = () => { 
        setIsUploadModalOpen(false); 
        setEditingDoc(null);
        resetUpload(); 
        clearUploadErrors(); 
    };

    // Open Edit Modal & populate data
    const openEditModal = (doc) => {
        clearUploadErrors();
        setEditingDoc(doc);
        setUploadData({
            title: doc.title,
            category: doc.category,
            department_id: doc.department_id || '',
            branch_id: doc.branch_id || '',
            description: doc.description || '',
            file: null, 
            _method: 'PUT', 
        });
        setIsUploadModalOpen(true);
    };

    const submitDocument = (e) => {
        e.preventDefault();
        
        const targetRoute = editingDoc 
            ? route('admin.documents.update', editingDoc.id) 
            : route('admin.documents.store');

        postDocument(targetRoute, { 
            preserveScroll: true, 
            forceFormData: true,
            onSuccess: () => closeUploadModal() 
        });
    };

    // --- Delete Document Modal State ---
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [documentToDelete, setDocumentToDelete] = useState(null);

    const triggerDelete = (doc) => {
        setDocumentToDelete(doc);
        setIsConfirmModalOpen(true);
    };

    const closeConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setDocumentToDelete(null);
    };

    const executeDelete = () => {
        if (!documentToDelete) return;
        router.delete(route('admin.documents.destroy', documentToDelete.id), { 
            preserveScroll: true,
            onSuccess: () => closeConfirmModal()
        });
    };

    const filteredDocuments = documents.filter(doc => {
        const query = searchQuery.toLowerCase();
        const matchesTitle = doc.title?.toLowerCase().includes(query);
        const matchesDesc = doc.description?.toLowerCase().includes(query);
        const matchesSearch = matchesTitle || matchesDesc;
        const matchesDept = filterDepartment === '' || doc.department_id?.toString() === filterDepartment;

        return matchesSearch && matchesDept;
    });

    return (
        <SidebarLayout activeModule="Document Repository" sidebarLinks={sidebarLinks}>
            <Head title={`Documents - ${activeCategory}`} />

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <h1 className="text-2xl font-semibold leading-tight text-gray-900 shrink-0">{activeCategory}</h1>

                <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto lg:flex-1 lg:justify-end items-center">
                    
                    <select
                        value={filterDepartment}
                        onChange={(e) => setFilterDepartment(e.target.value)}
                        className="block w-full sm:w-48 py-2 pl-3 pr-10 border border-gray-300 rounded-lg leading-5 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out text-gray-600"
                    >
                        <option value="">All Departments</option>
                        {departments.map(dep => (
                            <option key={dep.id} value={dep.id}>{dep.name}</option>
                        ))}
                    </select>

                    <div className="w-full sm:max-w-xs relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search documents..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
                        />
                    </div>
                    
                    {isAdmin && (
                        <button
                            type="button"
                            onClick={() => {
                                setEditingDoc(null);
                                setUploadData({ title: '', category: activeCategory !== 'Overview' ? activeCategory : '', department_id: '', branch_id: '', description: '', file: null, _method: 'POST' });
                                setIsUploadModalOpen(true);
                            }}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 hover:shadow shrink-0"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-4 w-4 shrink-0 text-indigo-600">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V6.75m0 0L8.25 10.5M12 6.75l3.75 3.75M4.5 17.25v.75A1.5 1.5 0 006 19.5h12a1.5 1.5 0 001.5-1.5v-.75" />
                            </svg>
                            Upload Document
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                {filteredDocuments.length === 0 ? (
                    <div className="col-span-full rounded-lg bg-white p-12 text-center text-gray-500 shadow-sm border border-gray-100">
                        <svg className="mx-auto mb-3 h-12 w-12 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {searchQuery || filterDepartment ? 'No documents match your filters.' : 'No documents found in this category.'}
                    </div>
                ) : (
                    filteredDocuments.map((doc) => {
                        const docCategory = categories.find(c => c.name === doc.category);
                        const isDownloadable = docCategory ? Boolean(docCategory.is_downloadable) : true; 

                        return (
                            <div key={doc.id} className="flex flex-col rounded-lg bg-white p-5 shadow-sm border border-gray-100 transition hover:shadow-md">
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="rounded bg-red-50 p-2 text-black">
                                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 line-clamp-1" title={doc.title}>{doc.title}</h3>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                <span className="text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{doc.category}</span>
                                                
                                                {doc.department && (
                                                     <span className="text-xs font-medium text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">{doc.department.name}</span>
                                                )}
                                                
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${doc.branch ? 'text-amber-600 bg-amber-50' : 'text-emerald-600 bg-emerald-50'}`}>
                                                    {doc.branch ? doc.branch.name : 'All Branches'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="mt-4 text-sm text-gray-600 line-clamp-2 flex-1">{doc.description || 'No description provided.'}</p>
                                
                                <div className="mt-6 flex items-center justify-between border-t pt-4">
                                    <span className="text-xs text-gray-400">Uploaded {formatAppDate(doc.created_at, system?.timezone)}</span>
                                    <div className="flex items-center gap-3">
                                        <button 
                                            onClick={() => setViewingDoc(doc)}
                                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
                                        >
                                            View
                                        </button>
                                        
                                        {isDownloadable ? (
                                            <a 
                                                href={`/storage/${doc.file_path}`}
                                                download={doc.title}
                                                className="text-sm font-medium text-emerald-600 hover:text-emerald-800"
                                            >
                                                Download
                                            </a>
                                        ) : null}

                                        {isAdmin && (
                                            <>
                                                <button 
                                                    onClick={() => openEditModal(doc)}
                                                    className="text-sm font-medium text-amber-600 hover:text-amber-800"
                                                >
                                                    Edit
                                                </button>
                                                <button 
                                                    onClick={() => triggerDelete(doc)}
                                                    className="text-sm font-medium text-red-600 hover:text-red-800"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* --- MANAGE CATEGORY MODAL --- */}
            <Modal show={isCategoryModalOpen} onClose={closeCategoryModal} maxWidth="md">
                <div className="p-6">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b">
                        <h2 className="text-lg font-bold text-gray-900">Manage Categories</h2>
                        <button onClick={closeCategoryModal} className="text-gray-400 hover:text-gray-600">✕</button>
                    </div>

                    <div className="mb-6">
                        <h3 className="text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">Current Categories</h3>
                        {categories.length === 0 ? (
                            <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded border border-gray-100">No custom categories yet.</p>
                        ) : (
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {categories.map(cat => (
                                    <li key={cat.id} className="flex justify-between items-center bg-gray-50 p-2.5 rounded border border-gray-100">
                                        {editingCategoryId === cat.id ? (
                                            <div className="flex items-center w-full gap-2">
                                                <input 
                                                    type="text" 
                                                    value={editCategoryName} 
                                                    onChange={(e) => setEditCategoryName(e.target.value)}
                                                    className="flex-1 rounded border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm py-1 px-2"
                                                    autoFocus
                                                />
                                                <button onClick={() => saveCategoryEdit(cat.id)} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">Save</button>
                                                <button onClick={cancelEditingCategory} className="text-xs font-medium text-gray-500 hover:text-gray-700">Cancel</button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-sm font-medium text-gray-800">{cat.name}</span>
                                                <div className="flex items-center gap-3">
                                                    
                                                    {/* Hoverable Downloadable Checkbox */}
                                                    <label 
                                                        className="flex items-center cursor-pointer" 
                                                        title="Toggle Downloadable Status"
                                                    >
                                                        <input 
                                                            type="checkbox" 
                                                            checked={Boolean(cat.is_downloadable ?? true)} 
                                                            onChange={(e) => toggleDownloadable(cat.id, e.target.checked)}
                                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 w-4 h-4"
                                                        />
                                                    </label>

                                                    <button 
                                                        onClick={() => startEditingCategory(cat)}
                                                        className="text-xs font-medium text-amber-500 hover:text-amber-700 transition-colors"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => deleteCategory(cat.id, cat.name)}
                                                        className="text-xs font-medium text-red-500 hover:text-red-700 transition-colors"
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <form onSubmit={submitCategory} className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                        <h3 className="text-sm font-semibold text-indigo-900 mb-3">Create New Category</h3>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <TextInput 
                                    id="name" 
                                    className="block w-full h-10 text-sm" 
                                    placeholder="e.g. Employee Handbooks"
                                    value={catData.name} 
                                    onChange={(e) => setCatData('name', e.target.value)} 
                                    required 
                                />
                                <InputError message={clearCatErrors?.name} className="mt-1" />
                            </div>
                            <button 
                                type="submit" 
                                disabled={catProcessing}
                                className="h-10 px-4 bg-indigo-600 text-white text-sm font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                            >
                                Add
                            </button>
                        </div>
                    </form>
                </div>
            </Modal>

            {/* --- UPLOAD / EDIT DOCUMENT MODAL --- */}
            <Modal show={isUploadModalOpen} onClose={closeUploadModal} maxWidth="md">
                <form onSubmit={submitDocument} className="p-6 space-y-4">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">
                        {editingDoc ? 'Edit Document' : 'Upload New Document'}
                    </h2>
                    <div>
                        <InputLabel htmlFor="title" value="Document Title" />
                        <TextInput id="title" className="mt-1 block w-full" value={uploadData.title} onChange={(e) => setUploadData('title', e.target.value)} required />
                        <InputError message={uploadErrors.title} className="mt-2" />
                    </div>
                    <div>
                        <InputLabel htmlFor="category" value="Category" />
                        <select id="category" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" value={uploadData.category} onChange={(e) => setUploadData('category', e.target.value)} required>
                            <option value="" disabled>Select a category...</option>
                            {categories.map(cat => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}
                        </select>
                        <InputError message={uploadErrors.category} className="mt-2" />
                        
                        {!editingDoc && isAdmin && (
                            <div className="mt-2 flex justify-end">
                                <button 
                                    type="button" 
                                    onClick={() => setIsCategoryModalOpen(true)}
                                    className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.99l1.005.828c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                    </svg>
                                    Manage Categories
                                </button>
                            </div>
                        )}
                    </div>

                    <div>
                        <InputLabel htmlFor="department_id" value="Department" />
                        <select 
                            id="department_id" 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
                            value={uploadData.department_id} 
                            onChange={(e) => setUploadData('department_id', e.target.value)} 
                            required
                        >
                            <option value="" disabled>Select a department...</option>
                            {departments.map(dep => (<option key={dep.id} value={dep.id}>{dep.name}</option>))}
                        </select>
                        <InputError message={uploadErrors.department_id} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="branch_id" value="Branch Assignment" />
                        <select 
                            id="branch_id" 
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" 
                            value={uploadData.branch_id} 
                            onChange={(e) => setUploadData('branch_id', e.target.value)}
                        >
                            <option value="">All Branches</option>
                            {branches.map(branch => (<option key={branch.id} value={branch.id}>{branch.name}</option>))}
                        </select>
                        <InputError message={uploadErrors.branch_id} className="mt-2" />
                    </div>

                    <div>
                        <InputLabel htmlFor="description" value="Short Description (Optional)" />
                        <textarea id="description" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" rows="2" value={uploadData.description} onChange={(e) => setUploadData('description', e.target.value)} />
                        <InputError message={uploadErrors.description} className="mt-2" />
                    </div>
                    <div>
                        <InputLabel htmlFor="file" value={editingDoc ? "Replace File (Optional)" : "Select File (PDF, DOCX, XLSX)"} />
                        <input 
                            type="file" 
                            id="file" 
                            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" 
                            onChange={(e) => setUploadData('file', e.target.files[0])} 
                            required={!editingDoc} 
                        />
                        <InputError message={uploadErrors.file} className="mt-2" />
                    </div>
                    <div className="mt-6 flex justify-end gap-3 pt-4 border-t">
                        <SecondaryButton type="button" onClick={closeUploadModal}>Cancel</SecondaryButton>
                        <PrimaryButton disabled={uploadProcessing}>
                            {editingDoc ? 'Save Changes' : 'Upload File'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* --- DELETE CONFIRMATION MODAL --- */}
            <ConfirmModal show={isConfirmModalOpen} onClose={closeConfirmModal} onConfirm={executeDelete} title="Delete Document" message={`Are you sure you want to delete the document "${documentToDelete?.title}"?\n\nThis will permanently remove the file from the server.`} confirmText="Delete Document" />

            {/* --- VIEWER MODAL (WITH ANTI-DOWNLOAD & HIDDEN TOOLBAR) --- */}
            <Modal show={!!viewingDoc} onClose={() => setViewingDoc(null)} maxWidth="7xl">
                {viewingDoc && (
                    <div className="flex flex-col bg-white overflow-hidden h-[95vh] sm:h-[90vh]">
                        <div className="flex justify-between items-center p-3 sm:p-4 border-b border-gray-200 bg-gray-50 shrink-0 gap-3 sm:gap-4 relative z-20 shadow-sm">
                            <h2 
                                className="text-base sm:text-lg font-bold text-gray-800 truncate flex-1" 
                                title={viewingDoc.title}
                            >
                                {viewingDoc.title}
                            </h2>

                            <button 
                                onClick={() => setViewingDoc(null)} 
                                className="flex items-center gap-1.5 rounded-lg bg-gray-200/80 px-3.5 py-2 text-sm font-bold text-gray-600 transition-colors hover:bg-red-100 hover:text-red-700 shrink-0"
                            >
                                ✕ <span className="hidden sm:inline">Close</span>
                            </button>
                        </div>

                        {/* Localhost Warning */}
                        {(window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') && (
                            <div className="bg-yellow-50 p-2 sm:p-3 text-xs sm:text-sm text-yellow-800 border-b border-yellow-200 shrink-0 text-center z-20">
                                <strong>Note:</strong> You are on localhost. External viewers cannot access local files. 
                                <br className="hidden sm:block"/>If the document doesn't load below, it is because your site is not live yet!
                            </div>
                        )}

                        {/* Document iFrame Area */}
                        <div 
                            className="flex-1 w-full bg-[#525659] relative overflow-hidden select-none"
                            onContextMenu={(e) => e.preventDefault()} // Disables right-click
                        >
                            {viewingDoc.file_path?.endsWith('.pdf') ? (
                                <iframe 
                                    src={
                                        window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
                                            ? `/storage/${viewingDoc.file_path}#toolbar=0&navpanes=0&scrollbar=0`
                                            : getPdfViewerUrl(viewingDoc)
                                    } 
                                    className={`absolute left-0 w-full border-0 pointer-events-auto ${
                                        window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost'
                                            ? 'top-0 h-full' 
                                            : '-top-14 h-[calc(100%+3.5rem)]' 
                                    }`}
                                    title="PDF Viewer"
                                />
                            ) : (
                                <iframe 
                                    src={getViewerUrl(viewingDoc)} 
                                    className="absolute inset-0 w-full h-full border-0 bg-white pointer-events-auto" 
                                    title="Office Viewer"
                                />
                            )}
                        </div>
                    </div>
                )}
            </Modal>
        </SidebarLayout>
    );
}