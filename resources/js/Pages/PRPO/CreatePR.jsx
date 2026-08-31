import { getPRPOLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, useForm } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

// =====================================================================
// CUSTOM SEARCHABLE DROPDOWN COMPONENT
// =====================================================================
const SearchableDropdown = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const selectedOption = options.find(opt => String(opt.id) === String(value));

    useEffect(() => {
        if (!isOpen) {
            setSearchTerm(selectedOption ? selectedOption.name : '');
        }
    }, [isOpen, selectedOption]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(selectedOption ? selectedOption.name : ''); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption]);

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={placeholder}
                value={isOpen ? searchTerm : (selectedOption ? selectedOption.name : '')}
                onChange={(e) => {
                    const newVal = e.target.value;
                    setSearchTerm(newVal);
                    setIsOpen(true);
                    
                    if (selectedOption && newVal !== selectedOption.name) {
                        onChange('');
                    }
                }}
                onFocus={() => {
                    setIsOpen(true);
                    setSearchTerm(selectedOption ? selectedOption.name : '');
                }}
            />
            
            {isOpen && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-xs shadow-lg ring-1 ring-black ring-opacity-5">
                    {filteredOptions.length === 0 ? (
                        <li className="px-3 py-2 text-gray-500">No results found</li>
                    ) : (
                        filteredOptions.map(opt => (
                            <li
                                key={opt.id}
                                className="cursor-pointer px-3 py-2 hover:bg-indigo-600 hover:text-white transition-colors truncate"
                                onMouseDown={(e) => {
                                    e.preventDefault(); 
                                    onChange(opt.id);
                                    setIsOpen(false);
                                    setSearchTerm(opt.name);
                                }}
                            >
                                {opt.name}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

// =====================================================================
// CUSTOM MULTI-SELECT COMPONENT (For CC)
// =====================================================================
const CCMultiSelect  = ({ options, value, onChange, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef(null);

    const selectedOption = options.find(opt => String(opt.id) === String(value));

    useEffect(() => {
        if (selectedOption) {
            setSearchTerm(selectedOption.name);
        } else {
            setSearchTerm('');
        }
    }, [value, selectedOption]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(selectedOption ? selectedOption.name : ''); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [selectedOption]);

    const filteredOptions = options.filter(opt =>
        opt.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div ref={wrapperRef} className="relative w-full">
            <input
                type="text"
                className="block w-full rounded-md border-gray-300 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                placeholder={placeholder}
                value={searchTerm} 
                onChange={(e) => {
                    const newVal = e.target.value;
                    setSearchTerm(newVal);
                    setIsOpen(true);
                    
                    if (selectedOption && newVal !== selectedOption.name) {
                        onChange('');
                    }
                }}
                onFocus={() => {
                    setIsOpen(true);
                    setSearchTerm(selectedOption ? selectedOption.name : '');
                }}
            />
            
            {isOpen && (
                <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5">
                    {filteredOptions.length === 0 ? (
                        <li className="px-3 py-2 text-gray-500">No results found</li>
                    ) : (
                        filteredOptions.map(opt => (
                            <li
                                key={opt.id}
                                className="cursor-pointer px-3 py-2 hover:bg-indigo-600 hover:text-white transition-colors truncate"
                                onMouseDown={(e) => {
                                    e.preventDefault(); 
                                    setSearchTerm(opt.name); 
                                    onChange(opt.id);        
                                    setIsOpen(false);        
                                }}
                            >
                                {opt.name}
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
};

// =====================================================================
// MAIN PAGE COMPONENT
// =====================================================================
export default function CreatePR({ auth, suppliers, products, branches = [], departments = [],  userBranches = [], employees = []}) {
    const today = new Date().toISOString().split('T')[0];

    const userRole = auth.user.role?.name?.toLowerCase() || '';

    const isUnrestricted = userRole === 'admin' || userRole.includes('director') || userRole.includes('procurement');
    const isAssistant = userRole.includes('assistant');
 
   const availableBranches = isUnrestricted 
        ? branches 
        : branches.filter(b => userBranches.includes(b.name));

    const { data, setData, post, processing, errors } = useForm({
        branch: '', 
        department: '', 
        date_prepared: today,
        date_needed: '',
        request_type: '',
        priority: '',
        budget_status: '',
        budget_ref: '',
        purpose_of_request: '',
        impact_if_not_procured: '',
        cc_user_id: '',
        items: [
            { 
                product_id: '', 
                specifications: '', 
                unit: '', 
                qty_requested: '', 
                qty_on_hand: '', 
                reorder_level: '', 
                supplier_id: '', 
                est_unit_cost: '', 
                total_cost: 0 
            }
        ],
    });

    const branchEmployees = employees.filter(emp => {
        if (!data.branch) return false;
        return emp.branches?.some(b => b.name === data.branch);
    });

    useEffect(() => {
        if (!isUnrestricted && availableBranches.length === 1 && !data.branch) {
            setData('branch', availableBranches[0].name);
        }
    }, [availableBranches, isUnrestricted]);

    const addItemRow = () => {
        setData('items', [...data.items, { 
            product_id: '', specifications: '', unit: '', qty_requested: '', qty_on_hand: '', reorder_level: '', supplier_id: '', est_unit_cost: '', total_cost: 0 
        }]);
    };

    const removeItemRow = (index) => {
        const newItems = [...data.items];
        newItems.splice(index, 1);
        setData('items', newItems);
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...data.items]; 
        newItems[index][field] = value;

        // 1. Product Change Logic
        if (field === 'product_id') {
            const selectedProduct = products.find(p => String(p.id) === String(value));
            
            if (selectedProduct) {
                newItems[index].supplier_id = selectedProduct.supplier_id || '';
                newItems[index].unit = selectedProduct.unit || '';
                newItems[index].est_unit_cost = selectedProduct.price || 0; 
                
                const qty = parseFloat(newItems[index].qty_requested) || 0;
                newItems[index].total_cost = qty * parseFloat(newItems[index].est_unit_cost);
            } else {
                newItems[index].supplier_id = '';
                newItems[index].unit = '';
                newItems[index].est_unit_cost = 0;
                newItems[index].total_cost = 0;
            }
        }

        // 2. Quantity Change Logic (Dynamic Math)
        if (field === 'qty_requested') {
            const qty = parseFloat(value) || 0;
            const cost = parseFloat(newItems[index].est_unit_cost) || 0;
            newItems[index].total_cost = qty * cost;
        }

        setData('items', newItems); 
    };

    const submit = (e) => {
        e.preventDefault();
        post(route('prpo.purchase-requests.store'));
    };

    const sidebarLinks = getPRPOLinks(auth);

    return (
        <SidebarLayout activeModule="PR/PO Module" sidebarLinks={sidebarLinks}>
            <Head title="Create Purchase Request" />

            <div className="mx-auto max-w-7xl pb-12">
                <div className="mb-6 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Purchase Requisition Form</h2>
                        <p className="mt-1 text-sm text-gray-500">Fill out the details below to submit a new PR.</p>
                    </div>
                </div>

                <form onSubmit={submit} className="space-y-8">
                    
                    {/* --- 1. PR HEADER DETAILS --- */}
                    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6 lg:p-8">
                        <h3 className="text-lg font-bold leading-7 text-gray-900 mb-6 border-b border-gray-200 pb-3">1. Requisition Details</h3>
                        
                        {/* Perfect 3-column grid for the 9 inputs */}
                        <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-3">
                            
                            {/* ROW 1 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Branch <span className="text-red-500">*</span></label>
                                <select 
                                    value={data.branch} 
                                    onChange={e => setData('branch', e.target.value)} 
                                    disabled={!isUnrestricted && availableBranches.length === 1} 
                                    className={`block w-full rounded-md shadow-sm sm:text-sm ${!isUnrestricted && availableBranches.length === 1 ? 'bg-gray-100 cursor-not-allowed text-gray-500' : ''} ${errors.branch ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`} 
                                    required
                                >
                                    <option value="" disabled>Select Branch...</option>
                                    {availableBranches.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                                </select>
                                {errors.branch && <p className="mt-2 text-sm text-red-600">{errors.branch}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Department <span className="text-red-500">*</span></label>
                                <select value={data.department} onChange={e => setData('department', e.target.value)} className={`block w-full rounded-md shadow-sm sm:text-sm ${errors.department ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'}`} required>
                                    <option value="" disabled>Select Department...</option>
                                    {departments.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
                                </select>
                                {errors.department && <p className="mt-2 text-sm text-red-600">{errors.department}</p>}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date Prepared</label>
                                <input type="date" value={data.date_prepared} onChange={e => setData('date_prepared', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm bg-gray-50 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm text-gray-600 cursor-not-allowed" readOnly />
                            </div>

                            {/* ROW 2 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Request Type</label>
                                <select value={data.request_type} onChange={e => setData('request_type', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                                    <option value="">Select Type...</option>
                                    <option value="Capex">Capex</option>
                                    <option value="Opex">Opex</option>
                                    <option value="Inventory">Inventory</option>
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                                <select value={data.priority} onChange={e => setData('priority', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                                    <option value="">Select Priority...</option>
                                    <option value="Low">Low</option>
                                    <option value="Normal">Normal</option>
                                    <option value="High">High</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date Needed</label>
                                <input type="date" value={data.date_needed} onChange={e => setData('date_needed', e.target.value)} min={today} className={`block w-full rounded-md shadow-sm sm:text-sm ${errors.date_needed ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'}`} />
                                {errors.date_needed && <p className="mt-2 text-sm text-red-600">{errors.date_needed}</p>}
                            </div>

                            {/* ROW 3 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Status</label>
                                <select value={data.budget_status} onChange={e => setData('budget_status', e.target.value)} className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                                    <option value="">Select Status...</option>
                                    <option value="Budgeted">Budgeted</option>
                                    <option value="Unbudgeted">Unbudgeted</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Budget Ref.</label>
                                <input type="text" value={data.budget_ref} onChange={e => setData('budget_ref', e.target.value)} className={`block w-full rounded-md shadow-sm sm:text-sm ${errors.budget_ref ? 'border-red-300 focus:border-red-500' : 'border-gray-300 focus:border-indigo-500'}`} placeholder="Enter Ref..." />
                                {errors.budget_ref && <p className="mt-2 text-sm text-red-600">{errors.budget_ref}</p>}
                            </div>

                            <div>
                                <div className="flex justify-between">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">CC (Carbon Copy)</label>
                                </div>
                                <CCMultiSelect 
                                    options={branchEmployees}
                                    value={data.cc_user_id}
                                    onChange={(val) => setData('cc_user_id', val)}
                                    placeholder={!data.branch ? "Select branch first..." : "Search employee..."}
                                />
                                {errors.cc_user_id && <p className="mt-2 text-sm text-red-600">{errors.cc_user_id}</p>}
                                <p className="mt-1 text-[11px] text-gray-500">Gets status notifications.</p>
                            </div>

                            {/* WIDE TEXT AREAS */}
                            <div className="sm:col-span-3 mt-2 border-t border-gray-100 pt-6">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose of Request</label>
                                <textarea rows={2} value={data.purpose_of_request} onChange={e => setData('purpose_of_request', e.target.value)} placeholder="Provide the general justification for this request..." className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                            </div>

                            <div className="sm:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Impact if Not Procured</label>
                                <textarea rows={2} value={data.impact_if_not_procured} onChange={e => setData('impact_if_not_procured', e.target.value)} placeholder="What happens if these items are not purchased?" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" />
                            </div>
                        </div>
                    </div>

                    {/* --- 2. DYNAMIC ITEM DETAILS TABLE --- */}
                    <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl p-6 lg:p-8">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 border-b border-gray-200 pb-3 gap-4">
                            <h3 className="text-lg font-bold leading-7 text-gray-900">2. Item Details</h3>
                            <button type="button" onClick={addItemRow} className="text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 px-4 py-2 rounded-md transition-colors shadow-sm flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                Add Item Row
                            </button>
                        </div>
                        
                        <div className="overflow-x-auto rounded-lg border border-gray-200 pb-32">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50 text-gray-700">
                                    <tr>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[30px]">No.</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[250px]">Product Name</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[90px]">Description</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[80px]">Unit</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[40px]">Requested Quantity</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[40px]">Stock Quantity</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[40px]">Reorder</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[230px]">Supplier Name</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[100px]">Unit Price</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[130px]">Total Cost</th>
                                        <th className="px-3 py-3 text-center font-semibold min-w-[5px]"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 bg-white">
                                    {data.items.map((item, index) => {
                                        
                                        // DYNAMIC FILTERING LOGIC
                                        const availableProducts = item.supplier_id 
                                            ? products.filter(p => String(p.supplier_id) === String(item.supplier_id))
                                            : products;

                                        const availableSuppliers = item.product_id
                                            ? suppliers.filter(s => {
                                                const linkedProduct = products.find(p => String(p.id) === String(item.product_id));
                                                return linkedProduct && String(linkedProduct.supplier_id) === String(s.id);
                                              })
                                            : suppliers;

                                        return (
                                            <tr key={index} className="hover:bg-gray-50/50 font-semibold">
                                                <td className="whitespace-nowrap px-3 py-2 text-center text-gray-500 font-medium">{index + 1}</td>
                                                
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <SearchableDropdown 
                                                        options={availableProducts}
                                                        value={item.product_id}
                                                        onChange={(val) => handleItemChange(index, 'product_id', val)}
                                                        placeholder="Search Product..."
                                                    />
                                                </td>

                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <input type="text" value={item.specifications} onChange={(e) => handleItemChange(index, 'specifications', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500" />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <input type="text" value={item.unit} readOnly placeholder="Auto" className="block w-full rounded-md border-gray-200 bg-gray-100 text-gray-500 text-xs shadow-sm cursor-not-allowed focus:ring-0"/>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <input type="number" min="0" value={item.qty_requested} onChange={(e) => handleItemChange(index, 'qty_requested', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500" required/>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <input type="number" min="0" value={item.qty_on_hand} onChange={(e) => handleItemChange(index, 'qty_on_hand', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500" required />
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <input type="number" min="0" value={item.reorder_level} onChange={(e) => handleItemChange(index, 'reorder_level', e.target.value)} className="block w-full rounded-md border-gray-300 text-xs shadow-sm focus:border-indigo-500 focus:ring-indigo-500" required />
                                                </td>
                                                
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <SearchableDropdown 
                                                        options={availableSuppliers}
                                                        value={item.supplier_id}
                                                        onChange={(val) => handleItemChange(index, 'supplier_id', val)}
                                                        placeholder="Search Supplier..."
                                                    />
                                                </td>

                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                            <span className="text-gray-400 text-xs">₱</span>
                                                        </div>
                                                        <input
    type="number"
    value={item.est_unit_cost ?? ''}
    onChange={(e) =>
        handleItemChange(index, 'est_unit_cost', e.target.value)
    }
    onBlur={(e) => {
        const value = parseFloat(e.target.value);

        if (!isNaN(value)) {
            handleItemChange(
                index,
                'est_unit_cost',
                value.toFixed(2)
            );
        }
    }}
    placeholder="0.00"
    step="0.01"
    min="0"
    className="block w-full rounded-md border-gray-200 text-gray-500 pl-6 text-xs shadow-sm focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
/>
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2">
                                                    <div className="relative rounded-md shadow-sm">
                                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                                                            <span className="text-indigo-400 font-bold text-xs">₱</span>
                                                        </div>
                                                        <input type="number" value={item.total_cost} readOnly className="block w-full rounded-md border-indigo-100 bg-indigo-50 text-indigo-700 font-bold pl-6 text-xs shadow-sm cursor-not-allowed focus:ring-0" />
                                                    </div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 text-right">
                                                    {data.items.length > 1 && (
                                                        <button type="button" onClick={() => removeItemRow(index)} className="text-red-400 hover:text-red-600 bg-white hover:bg-red-50 border border-transparent hover:border-red-100 rounded p-1.5 transition-colors">
                                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-x-4 bg-gray-50 px-6 py-4 rounded-xl border border-gray-200">
                        <button type="button" onClick={() => window.history.back()} className="text-sm font-semibold leading-6 text-gray-700 hover:text-gray-900 bg-white border border-gray-300 px-6 py-2.5 rounded-md shadow-sm transition">Cancel</button>
                        <button type="submit" disabled={processing} className="rounded-md bg-indigo-600 px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition">
                            Submit Request
                        </button>
                    </div>
                </form>
            </div>
        </SidebarLayout>
    );
}