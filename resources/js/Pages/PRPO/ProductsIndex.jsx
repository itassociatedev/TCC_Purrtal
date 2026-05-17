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
import { useEffect, useMemo, useState } from 'react';

export default function ProductsIndex({ auth, products = [], suppliers = [] }) {

    const PRPOLinks = getPRPOLinks(auth);
    
    // 🟢 DEFINE READ-ONLY STATE
    const userRole = auth.user.role?.name?.toLowerCase().trim() || '';
    const isInventory = userRole.includes('inventory');
    const isReadOnly = isInventory && userRole !== 'admin'; // Admin overrides read-only

    const { data: importData, setData: setImportData, post: postImport, processing: importProcessing, errors: importErrors, reset: resetImport } = useForm({
        import_file: null,
    });

    const handleFileUpload = (e) => {
        const file = e.target.files[0];

        if (file) {
            setConfirmDialog({
                isOpen: true,
                title: 'Confirm Batch Import',
                message: `Are you sure you want to import products from "${file.name}"? Make sure your column headers match the template.`,
                confirmText: 'Import File',
                confirmColor: 'bg-green-600 hover:bg-green-700',
                onConfirm: () => {
                    closeConfirmModal();

                    router.post(route('prpo.products.import'), {
                        import_file: file
                    }, {
                        preserveScroll: true,
                        forceFormData: true,
                        onSuccess: () => {
                            resetImport();
                            e.target.value = null;
                        },
                        onError: () => {
                            e.target.value = null;
                        }
                    });
                }
            });
        }
    };

    // ==========================================
    // 1. DATA TABLE & FILTER STATE
    // ==========================================
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const [filterSupplier, setFilterSupplier] = useState('');
    const [filterProductSearch, setFilterProductSearch] = useState('');
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [selectedProductId, setSelectedProductId] = useState('');

    // Sorting state
    const [sortField, setSortField] = useState('supplier');
    const [sortDirection, setSortDirection] = useState('asc');

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const getSortValue = (product, field) => {
        switch (field) {
            case 'supplier':
                return product.supplier?.name || '';
            case 'name':
                return product.name || '';
            case 'unit':
                return product.unit || '';
            default:
                return '';
        }
    };

    const filteredProducts = useMemo(() => {
        return [...products]
            .filter(product => {
                const matchesSupplier = filterSupplier ? String(product.supplier_id) === String(filterSupplier) : true;
                const matchesProduct = filterProductSearch
                    ? product.name.toLowerCase().includes(filterProductSearch.toLowerCase())
                    : true;

                return matchesSupplier && matchesProduct;
            })
            .sort((a, b) => {
                const aValue = getSortValue(a, sortField).toLowerCase();
                const bValue = getSortValue(b, sortField).toLowerCase();

                const comparison = aValue.localeCompare(bValue, undefined, {
                    numeric: true,
                    sensitivity: 'base',
                });

                return sortDirection === 'asc' ? comparison : -comparison;
            });
    }, [products, filterSupplier, filterProductSearch, sortField, sortDirection]);

    const searchableProducts = products.filter(p =>
        p.name.toLowerCase().includes(filterProductSearch.toLowerCase())
    );

    const isBatchSelection = selectedProducts.length > 0;
    const isAllSelected = filteredProducts.length > 0 && selectedProducts.length === filteredProducts.length;

    useEffect(() => {
        const closeDropdowns = () => {
            setActiveDropdown(null);
            setTimeout(() => setIsProductDropdownOpen(false), 200);
        };
        document.addEventListener('click', closeDropdowns);
        return () => document.removeEventListener('click', closeDropdowns);
    }, []);

    const handleSelectAll = (e) => setSelectedProducts(e.target.checked ? filteredProducts.map(p => p.id) : []);
    const handleSelectOne = (id) => setSelectedProducts(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]);

    const renderHeaderSortButton = (field) => {
        const isActive = sortField === field;

        const upClass =
            isActive && sortDirection === 'asc' ? 'text-gray-900' : 'text-gray-300';
        const downClass =
            isActive && sortDirection === 'desc' ? 'text-gray-900' : 'text-gray-300';

        return (
            <button
                type="button"
                onClick={() => toggleSort(field)}
                className="ml-2 inline-flex items-center justify-center hover:opacity-80 transition"
            >
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="w-4 h-4"
                >
                    <g
                        className={upClass}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M7 17V7" />
                        <path d="M4 10l3-3 3 3" />
                    </g>

                    <g
                        className={downClass}
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <path d="M17 7v10" />
                        <path d="M14 14l3 3 3-3" />
                    </g>
                </svg>
            </button>
        );
    };

    // ==========================================
    // 2. GLOBAL CONFIRM MODAL
    // ==========================================
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {}
    });
    const closeConfirmModal = () => setConfirmDialog({ ...confirmDialog, isOpen: false });

    // ==========================================
    // 3. MANAGE SUPPLIERS MODAL & LOGIC
    // ==========================================
    const [isSupplierModalOpen, setSupplierModalOpen] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierSearchQuery, setSupplierSearchQuery] = useState(''); // 🟢 NEW STATE FOR SEARCH
    const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);

    const handleBulkSupplierDelete = () => {
        if (confirm(`Are you sure you want to delete ${selectedSupplierIds.length} suppliers?`)) {
            router.post(route('prpo.suppliers.batch-destroy'), { ids: selectedSupplierIds }, {
                onSuccess: () => setSelectedSupplierIds([]) // clear selection on success
            });
        }
    };
    
    const { data: supData, setData: setSupData, post: postSup, put: putSup, processing: supProcessing, errors: supErrors, reset: resetSup, clearErrors: clearSupErrors } = useForm({ 
        name: '',
        contact_person: '',
        contact_number: '',
        address: '',
        tin: ''
    });

    const closeSupplierModal = () => {
        setSupplierModalOpen(false);
        setEditingSupplier(null);
        setSupplierSearchQuery(''); // Reset search query on close
        clearSupErrors();
        resetSup();
        setSelectedSupplierIds([]); // Reset checkboxes on close
    };

    const submitSupplier = (e) => {
        e.preventDefault();
        if (editingSupplier) {
            putSup(route('prpo.suppliers.update', editingSupplier.id), {
                preserveScroll: true,
                onSuccess: () => { setEditingSupplier(null); resetSup(); }
            });
        } else {
            postSup(route('prpo.suppliers.store'), {
                preserveScroll: true,
                onSuccess: () => resetSup()
            });
        }
    };

    const editSupplierAction = (sup) => {
        setEditingSupplier(sup);
        setSupData({
            name: sup.name,
            contact_person: sup.contact_person || '',
            contact_number: sup.contact_number || '',
            address: sup.address || '',
            tin: sup.tin || ''
        });
    };

    const confirmDeleteSupplier = (sup) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Supplier',
            message: `Are you sure you want to delete ${sup.name}? This might fail if there are products linked to this supplier.`,
            confirmText: 'Delete Supplier',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('prpo.suppliers.destroy', sup.id), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmToggleSupplierStatus = (sup) => {
        const isDisabling = sup.status !== 'Disabled';
        
        setConfirmDialog({
            isOpen: true,
            title: isDisabling ? 'Disable Supplier' : 'Enable Supplier',
            message: isDisabling 
                ? `Are you sure you want to disable ${sup.name}? \n\n⚠️ ALL products handled by this supplier will also be disabled and hidden from new Purchase Requests.`
                : `Are you sure you want to re-enable ${sup.name}? \n\nAll their associated products will become active again.`,
            confirmText: isDisabling ? 'Disable Supplier' : 'Enable Supplier',
            confirmColor: isDisabling ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500',
            onConfirm: () => {
                router.patch(route('prpo.suppliers.toggle-status', sup.id), {}, {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    // 🟢 FILTERING LOGIC FOR SUPPLIERS
    const filteredSuppliers = useMemo(() => {
        if (!supplierSearchQuery) return suppliers;
        const searchLower = supplierSearchQuery.toLowerCase();
        return suppliers.filter(supplier =>
            supplier.name?.toLowerCase().includes(searchLower) ||
            supplier.contact_person?.toLowerCase().includes(searchLower) ||
            supplier.tin?.toLowerCase().includes(searchLower)
        );
    }, [suppliers, supplierSearchQuery]);

    const confirmToggleProductStatus = (product) => {
        setActiveDropdown(null);
        const isDisabling = product.status !== 'Disabled';
        
        setConfirmDialog({
            isOpen: true,
            title: isDisabling ? 'Disable Product' : 'Enable Product',
            message: isDisabling 
                ? `Are you sure you want to disable ${product.name}? \n\nIt will no longer be available for new Purchase Requests.`
                : `Are you sure you want to re-enable ${product.name}?`,
            confirmText: isDisabling ? 'Disable Product' : 'Enable Product',
            confirmColor: isDisabling ? 'bg-red-600 hover:bg-red-500' : 'bg-green-600 hover:bg-green-500',
            onConfirm: () => {
                router.patch(route('prpo.products.toggle-status', product.id), {}, {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    // ==========================================
    // 4. ADD/EDIT PRODUCT MODAL & LOGIC
    // ==========================================
    const [isProductModalOpen, setProductModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);

    const { data: prodData, setData: setProdData, post: postProd, put: putProd, processing: prodProcessing, errors: prodErrors, reset: resetProd, clearErrors: clearProdErrors } = useForm({
        supplier_id: '',
        name: '',
        details: '',
        unit: '',
        price: ''
    });

    const openProductModal = (product = null) => {
        if (product) {
            setEditingProduct(product);
            setProdData({
                supplier_id: product.supplier_id,
                name: product.name,
                details: product.details || '',
                unit: product.unit || '',
                price: product.price
            });
        } else {
            setEditingProduct(null);
            resetProd();
            if (filterSupplier) setProdData('supplier_id', filterSupplier);
        }
        setProductModalOpen(true);
    };

    const closeProductModal = () => {
        setProductModalOpen(false);
        setEditingProduct(null);
        clearProdErrors();
        resetProd();
    };

    const submitProduct = (e) => {
        e.preventDefault();
        if (editingProduct) {
            putProd(route('prpo.products.update', editingProduct.id), {
                preserveScroll: true,
                onSuccess: () => closeProductModal()
            });
        } else {
            postProd(route('prpo.products.store'), {
                preserveScroll: true,
                onSuccess: () => closeProductModal()
            });
        }
    };

    const confirmDeleteProduct = (product) => {
        setActiveDropdown(null);
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Product',
            message: `Are you sure you want to delete ${product.name}?`,
            confirmText: 'Delete',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('prpo.products.destroy', product.id), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    const confirmBatchDelete = () => {
        setConfirmDialog({
            isOpen: true,
            title: 'Batch Delete Products',
            message: `Are you sure you want to permanently delete the ${selectedProducts.length} selected products?`,
            confirmText: 'Delete All Selected',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.post(route('prpo.products.batch-destroy'), { ids: selectedProducts }, {
                    preserveScroll: true,
                    onSuccess: () => {
                        setSelectedProducts([]);
                        closeConfirmModal();
                    },
                });
            }
        });
    };

    const handleImport = (e) => {
        const file = e.target.files[0];
        if (file) {
            router.post(route('prpo.suppliers.import'), { file: file }, {
                forceFormData: true,
                preserveScroll: true,
                onSuccess: () => {
                    e.target.value = null; // Reset the input after successful upload
                }
            });
        }
    };

    return (
        <SidebarLayout activeModule="PR/PO Module" sidebarLinks={PRPOLinks}>
            <Head title="Products & Suppliers" />

            <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col h-[calc(100vh-140px)] overflow-hidden">
                <div className="flex-none">

                {/* HEADER & TOP CONTROLS */}
                <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Products Masterlist</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            {isReadOnly ? 'View and search the product catalog.' : 'Manage your suppliers and product catalog.'}
                        </p>
                    </div>
                    
                    {/* 🟢 HIDE ALL EDITING ACTIONS IF READ-ONLY */}
                    {!isReadOnly && (
                        <div className="flex flex-wrap gap-3">
                            <SecondaryButton onClick={() => setSupplierModalOpen(true)}>Manage Suppliers</SecondaryButton>

                            <a
                                href={route('prpo.products.import-template')}
                                className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-md font-semibold text-xs text-gray-700 uppercase tracking-widest shadow-sm hover:bg-gray-50 transition ease-in-out duration-150"
                            >
                                📄 Download Template
                            </a>

                            <div className="relative">
                                <input
                                    type="file"
                                    id="excel-upload"
                                    className="hidden"
                                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                                    onChange={handleFileUpload}
                                />

                                <SecondaryButton onClick={() => document.getElementById('excel-upload').click()} disabled={importProcessing} className="bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
                                    {importProcessing ? 'Importing...' : '📁 Batch Import'}
                                </SecondaryButton>
                            </div>

                            <a
                                href={route('prpo.products.export', {
                                    supplier_id: filterSupplier,
                                    search: filterProductSearch
                                })}
                                className="inline-flex items-center px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-md font-bold text-xs text-indigo-700 uppercase tracking-widest shadow-sm hover:bg-indigo-100 transition ease-in-out duration-150"
                            >
                                📥 Export Current View
                            </a>

                            <PrimaryButton onClick={() => openProductModal(null)}>+ Add Product</PrimaryButton>

                            {importErrors.import_file && (
                                <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded w-full">
                                    {importErrors.import_file}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* FILTER BAR & BATCH ACTION BAR */}
                <div className="mb-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <label htmlFor="supplierFilter" className="text-sm font-medium text-gray-700 whitespace-nowrap">Filter by Supplier:</label>
                        <select
                            id="supplierFilter"
                            className="block w-full sm:w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                            value={filterSupplier}
                            onChange={(e) => { setFilterSupplier(e.target.value); setSelectedProducts([]); }}
                        >
                            <option value="">All Suppliers</option>
                            {suppliers.map(sup => <option key={`filter-${sup.id}`} value={sup.id}>{sup.name}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto relative" onClick={(e) => e.stopPropagation()}>
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Product:</label>
                        <div className="relative w-full sm:w-64">
                            <input
                                type="text"
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm pr-8"
                                placeholder="Search by name..."
                                value={filterProductSearch}
                                onChange={(e) => {
                                    setFilterProductSearch(e.target.value);
                                    setSelectedProducts([]);
                                }}
                            />
                            {filterProductSearch && (
                                <button
                                    type="button"
                                    className="absolute right-2 top-1.5 text-gray-400 hover:text-gray-600 font-bold"
                                    onClick={() => {
                                        setFilterProductSearch('');
                                        setSelectedProducts([]);
                                    }}
                                >
                                    ✕
                                </button>
                            )}

                            {isProductDropdownOpen && (
                                <ul className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                                    {searchableProducts.length === 0 ? (
                                        <li className="relative cursor-default select-none py-2 px-4 text-gray-500">No products found.</li>
                                    ) : (
                                        searchableProducts.map(product => (
                                            <li
                                                key={`search-${product.id}`}
                                                className="relative cursor-pointer select-none py-2 px-4 text-gray-900 hover:bg-indigo-600 hover:text-white transition-colors"
                                                onClick={() => {
                                                    setSelectedProductId(product.id);
                                                    setFilterProductSearch(product.name);
                                                    setIsProductDropdownOpen(false);
                                                }}
                                            >
                                                {product.name}
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>
                    <div className="w-full sm:w-auto flex justify-end min-h-[38px]">
                        {!isReadOnly && isBatchSelection && (
                            <button onClick={confirmBatchDelete} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-md shadow-sm transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                Delete Selected ({selectedProducts.length})
                            </button>
                        )}
                    </div>
                </div>
                </div>

                {/* DATA TABLE */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 min-h-0 flex flex-col overflow-hidden">
                    <div className="overflow-x-auto overflow-y-auto flex-1 relative">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50 sticky top-0 z-10 border-b border-gray-200 shadow-sm">
                                <tr>
                                    {/* 🟢 HIDE CHECKBOX COLUMN IF READ-ONLY */}
                                    {!isReadOnly && (
                                        <th scope="col" className="px-6 py-3 text-left w-12">
                                            <input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer" checked={isAllSelected} onChange={handleSelectAll} disabled={filteredProducts.length === 0} />
                                        </th>
                                    )}
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center">
                                            <span>Supplier</span>
                                            {renderHeaderSortButton('supplier')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center">
                                            <span>Product Name</span>
                                            {renderHeaderSortButton('name')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Details</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <div className="flex items-center">
                                            <span>Unit</span>
                                            {renderHeaderSortButton('unit')}
                                        </div>
                                    </th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Price</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                    
                                    {/* 🟢 HIDE ACTIONS COLUMN IF READ-ONLY */}
                                    {!isReadOnly && (
                                        <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-20">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredProducts.length === 0 ? (
                                    <tr><td colSpan={isReadOnly ? "6" : "8"} className="px-6 py-12 text-center text-gray-500 font-medium">No products found.</td></tr>
                                ) : (
                                    filteredProducts.map((product) => (
                                        <tr key={product.id} className={`hover:bg-gray-50 ${selectedProducts.includes(product.id) ? 'bg-indigo-50/30' : ''}`}>
                                            
                                            {/* 🟢 HIDE CHECKBOX CELL IF READ-ONLY */}
                                            {!isReadOnly && (
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <input type="checkbox" className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer" checked={selectedProducts.includes(product.id)} onChange={() => handleSelectOne(product.id)} />
                                                </td>
                                            )}

                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{product.supplier?.name || 'Unknown'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">{product.name}</td>
                                            <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={product.details}>{product.details}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{product.unit || <span className="text-gray-400 italic">N/A</span>}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">₱{parseFloat(product.price).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-bold ring-1 ring-inset ${
                                                    product.status === 'Disabled' 
                                                        ? 'bg-gray-100 text-gray-600 ring-gray-500/20' 
                                                        : 'bg-green-50 text-green-700 ring-green-600/20'
                                                }`}>
                                                    {product.status === 'Disabled' ? 'Disabled' : 'Active'}
                                                </span>
                                            </td>
                                            
                                            {/* 🟢 HIDE ACTIONS CELL IF READ-ONLY */}
                                            {!isReadOnly && (
                                                <td className="px-6 py-4 whitespace-nowrap text-center relative">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === product.id ? null : product.id); }}
                                                        disabled={isBatchSelection}
                                                        className={`inline-flex items-center justify-center rounded-md p-1 transition-all ${isBatchSelection ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200 focus:outline-none'}`}
                                                    >
                                                        <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                                                    </button>

                                                    {!isBatchSelection && activeDropdown === product.id && (
                                                        <div onClick={(e) => e.stopPropagation()} className="absolute right-8 top-10 z-50 w-32 overflow-hidden rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
                                                            <button className="block w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-gray-100 font-medium" onClick={() => { setActiveDropdown(null); openProductModal(product); }}>Edit</button>
                                                            <button 
                                                                className="block w-full px-4 py-2 text-left text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors" 
                                                                onClick={(e) => {
                                                                    e.preventDefault(); e.stopPropagation(); confirmToggleProductStatus(product);
                                                                }}
                                                            >
                                                                {product.status === 'Disabled' ? 'Enable' : 'Disable'}
                                                            </button>
                                                            <button className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-gray-100 font-medium" onClick={() => confirmDeleteProduct(product)}>Delete</button>
                                                        </div>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* 1. MANAGE SUPPLIERS MODAL */}
            <Modal show={isSupplierModalOpen} onClose={closeSupplierModal}>
                <div className="p-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 border-b border-gray-100 pb-4">
                        <h2 className="text-lg font-bold text-gray-900">Manage Suppliers</h2>
                        <div className="flex items-center gap-2">
                            {/* 🟢 NEW EXPORT BUTTON ADDED HERE */}
                            <a 
                                href={route('prpo.suppliers.export')} 
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 transition-colors shadow-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                Export Excel
                            </a>

                            <a 
                                href={route('prpo.suppliers.template')} 
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md hover:bg-indigo-100 transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                                Template
                            </a>
                            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-500 cursor-pointer shadow-sm transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                                Import CSV
                                <input type="file" className="hidden" accept=".csv" onChange={handleImport} />
                            </label>
                        </div>
                    </div>

                    <form onSubmit={submitSupplier} className="mb-6 rounded-md bg-gray-50 p-4 border border-gray-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div className="sm:col-span-2">
                                <InputLabel htmlFor="sup_name" value={editingSupplier ? "Update Supplier Name" : "New Supplier Name"} />
                                <TextInput id="sup_name" className="mt-1 block w-full" value={supData.name} onChange={(e) => setSupData('name', e.target.value)} required placeholder="e.g. MedCorp Inc." />
                                <InputError message={supErrors.name} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="contact_person" value="Contact Person" />
                                <TextInput id="contact_person" className="mt-1 block w-full" value={supData.contact_person} onChange={(e) => setSupData('contact_person', e.target.value)} placeholder="e.g. Jane Doe" />
                                <InputError message={supErrors.contact_person} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="contact_number" value="Contact Number" />
                                <TextInput 
                                    id="contact_number" 
                                    className="mt-1 block w-full" 
                                    value={supData.contact_number} 
                                    onChange={(e) => {
                                        const numericValue = e.target.value.replace(/\D/g, '');
                                        setSupData('contact_number', numericValue);
                                    }} 
                                    placeholder="e.g. 09171234567" 
                                    maxLength="15" 
                                />
                                <InputError message={supErrors.contact_number} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="address" value="Address" />
                                <TextInput id="address" className="mt-1 block w-full" value={supData.address} onChange={(e) => setSupData('address', e.target.value)} placeholder="e.g. 123 Main St, City" />
                                <InputError message={supErrors.address} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="tin" value="TIN" />
                                <TextInput 
                                    id="tin" 
                                    className="mt-1 block w-full" 
                                    value={supData.tin} 
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/\D/g, '');
                                        val = val.substring(0, 12);
                                        const formattedTIN = val.match(/.{1,3}/g)?.join('-') || '';
                                        setSupData('tin', formattedTIN);
                                    }} 
                                    placeholder="e.g. 123-456-789-000" 
                                    maxLength="15" 
                                />
                                <InputError message={supErrors.tin} className="mt-2" />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            {editingSupplier && (
                                <SecondaryButton type="button" onClick={() => { setEditingSupplier(null); resetSup(); }}>Cancel</SecondaryButton>
                            )}
                            <PrimaryButton disabled={supProcessing}>
                                {editingSupplier ? 'Update' : 'Add'}
                            </PrimaryButton>
                        </div>
                    </form>

                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Existing Suppliers</h3>
                    
                    {/* 🟢 NEW CHECKBOX & ACTION BAR ADDED HERE */}
                    <div className="flex items-center justify-between gap-4 mb-4 bg-white p-3 rounded shadow-sm border border-gray-200">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="selectAllSuppliers"
                                    className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer"
                                    checked={filteredSuppliers.length > 0 && selectedSupplierIds.length === filteredSuppliers.length}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setSelectedSupplierIds(filteredSuppliers.map(s => s.id));
                                        } else {
                                            setSelectedSupplierIds([]);
                                        }
                                    }}
                                />
                                <label htmlFor="selectAllSuppliers" className="text-sm font-medium text-gray-700 cursor-pointer">Select All</label>
                            </div>

                            {selectedSupplierIds.length > 0 && (
                                <button
                                    type="button"
                                    onClick={handleBulkSupplierDelete}
                                    className="bg-red-600 text-white px-3 py-1.5 text-xs rounded shadow-sm hover:bg-red-700 transition font-semibold"
                                >
                                    Delete Selected ({selectedSupplierIds.length})
                                </button>
                            )}
                        </div>

                        <div className="w-1/2 min-w-[200px]">
                            <TextInput
                                type="text"
                                placeholder="Search suppliers by name, contact, or TIN..."
                                value={supplierSearchQuery}
                                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                                className="block w-full text-sm border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 rounded-md shadow-sm"
                            />
                        </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-md border border-gray-200">
                        <ul className="divide-y divide-gray-200">
                            {filteredSuppliers.map((sup) => (
                                <li key={sup.id} className={`flex items-center justify-between p-3 transition-colors ${sup.status === 'Disabled' ? 'bg-gray-100/50' : 'hover:bg-gray-50'}`}>
                                    
                                    <div className="flex items-center gap-3">
                                        {/* 🟢 INDIVIDUAL CHECKBOX FOR SUPPLIER */}
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500 cursor-pointer"
                                            checked={selectedSupplierIds.includes(sup.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedSupplierIds([...selectedSupplierIds, sup.id]);
                                                } else {
                                                    setSelectedSupplierIds(selectedSupplierIds.filter(id => id !== sup.id));
                                                }
                                            }}
                                        />
                                        
                                        <div className="flex flex-col">
                                            <span className={`text-sm font-semibold ${sup.status === 'Disabled' ? 'text-gray-400' : 'text-gray-800'}`}>
                                                {sup.name}
                                                {sup.status === 'Disabled' && (
                                                    <span className="ml-2 text-[10px] uppercase font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                                                        Disabled
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex gap-3 items-center">
                                        <button 
                                            type="button"
                                            onClick={() => confirmToggleSupplierStatus(sup)} 
                                            className={`text-xs font-bold ${sup.status === 'Disabled' ? 'text-green-600 hover:text-green-800' : 'text-gray-500 hover:text-gray-800'}`}
                                        >
                                            {sup.status === 'Disabled' ? 'Enable' : 'Disable'}
                                        </button>
                                        <button type="button" onClick={() => editSupplierAction(sup)} className="text-xs font-medium text-blue-600 hover:text-blue-900">Edit</button>
                                        <button type="button" onClick={() => confirmDeleteSupplier(sup)} className="text-xs font-medium text-red-600 hover:text-red-900">Delete</button>
                                    </div>
                                </li>
                            ))}
                            {filteredSuppliers.length === 0 && (
                                <li className="p-4 text-sm text-gray-500 text-center">
                                    {supplierSearchQuery ? 'No suppliers match your search.' : 'No suppliers found.'}
                                </li>
                            )}
                        </ul>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeSupplierModal}>Close</SecondaryButton>
                    </div>
                </div>
            </Modal>

            {/* 2. ADD/EDIT PRODUCT MODAL */}
            <Modal show={isProductModalOpen} onClose={closeProductModal}>
                <form onSubmit={submitProduct} className="p-6">
                    <h2 className="text-lg font-medium text-gray-900 mb-6">
                        {editingProduct ? 'Edit Product' : 'Add New Product'}
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <InputLabel htmlFor="supplier_id" value="Supplier" />
                            <select
                                id="supplier_id"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                value={prodData.supplier_id}
                                onChange={(e) => setProdData('supplier_id', e.target.value)}
                                required
                            >
                                <option value="" disabled>Select a supplier...</option>
                                {suppliers.map((sup) => <option key={`opt-${sup.id}`} value={sup.id}>{sup.name}</option>)}
                            </select>
                            <InputError message={prodErrors.supplier_id} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="name" value="Product Name" />
                            <TextInput id="name" className="mt-1 block w-full" value={prodData.name} onChange={(e) => setProdData('name', e.target.value)} required placeholder="e.g. Paracetamol 500mg" />
                            <InputError message={prodErrors.name} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="details" value="Details / Description" />
                            <textarea
                                id="details"
                                rows="3"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                value={prodData.details}
                                onChange={(e) => setProdData('details', e.target.value)}
                                placeholder="Packaging size, usage instructions, etc."
                            />
                            <InputError message={prodErrors.details} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="unit" value="Unit of Measurement" />
                            <input
                                type="text"
                                id="unit"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                placeholder="e.g., PCS, ML, BOX, KG"
                                value={prodData.unit}
                                onChange={(e) => setProdData('unit', e.target.value.toUpperCase())}
                                required
                            />
                            <InputError message={prodErrors.unit} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="price" value="Price (₱)" />
                            <TextInput id="price" type="number" step="0.01" min="0" className="mt-1 block w-full" value={prodData.price} onChange={(e) => setProdData('price', e.target.value)} required placeholder="0.00" />
                            <InputError message={prodErrors.price} className="mt-2" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeProductModal}>Cancel</SecondaryButton>
                        <PrimaryButton className="ms-3" disabled={prodProcessing}>
                            {editingProduct ? 'Save Changes' : 'Create Product'}
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* 3. GLOBAL CONFIRM MODAL */}
            <ConfirmModal
                show={confirmDialog.isOpen}
                onClose={closeConfirmModal}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                confirmColor={confirmDialog.confirmColor}
                onConfirm={confirmDialog.onConfirm}
            />

        </SidebarLayout>
    );
}