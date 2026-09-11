import ApplicationLogo from '@/Components/ApplicationLogo';
import { Head } from '@inertiajs/react';

export default function PrintablePR({ pr }) {

    const formatCurrency = (amount) => {
        return `₱${parseFloat(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'TBD';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: '2-digit'
        });
    };

    return (
        <div className="min-h-screen bg-gray-200 print:bg-white py-8 print:py-0 font-sans">
            <Head title={`Purchase Request #${pr.id}`} />

            {/* FORCE LANDSCAPE WITH TIGHT MARGINS */}
            <style>
                {`
                    @media print {
                        @page {
                            size: landscape;
                            margin: 8mm;
                        }
                        body {
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                    }
                `}
            </style>

            {/* ACTION BUTTONS (Hidden when printing) */}
            <div className="max-w-5xl mx-auto mb-4 flex justify-between items-center print:hidden px-4">
                <button
                    onClick={() => window.close()}
                    className="text-gray-600 hover:text-gray-900 font-semibold flex items-center gap-2"
                >
                    <span>←</span> Back to Board
                </button>
                <button
                    onClick={() => window.print()}
                    className="bg-indigo-600 text-white px-6 py-2 rounded-md font-bold shadow-sm hover:bg-indigo-500"
                >
                    Print Purchase Request / Save as PDF
                </button>
            </div>

            {/* FULL HEIGHT CONTAINER WITH FLEX PINNING */}
            <div className="max-w-5xl mx-auto bg-white p-8 shadow-xl print:shadow-none print:p-0 border border-gray-300 print:border-none w-full flex flex-col justify-between min-h-[92vh] text-[10px] leading-[1.15] text-[#333]">

                {/* TOP CONTENT WRAPPER */}
                <div>
                    {/* MASTER HEADER */}
                    <div className="flex border-b-2 border-gray-900 pb-2 mb-3">

                        {/* Col 1: Logo & Clinic */}
                        <div className="w-[25%] flex items-start gap-2 pr-2 pt-0.5">
                            <div className="w-12 h-12 flex-shrink-0">
                                <ApplicationLogo className="w-full h-full text-indigo-900" />
                            </div>
                            <div>
                                <h1 className="text-[17px] font-bold text-gray-900 leading-tight m-0">The Cat Clinic</h1>
                                <div className="text-[10px] text-gray-600 mt-0.5">Makati City, Metro Manila</div>
                            </div>
                        </div>

                        {/* Col 2: Prepared By */}
                        <div className="w-[30%] border-l border-gray-300 pl-3">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Prepared By:</span>
                            <span className="text-[11px] font-bold text-gray-900 uppercase">{pr.user?.name}</span><br />
                            <span className="text-[10px] text-gray-600">{pr.department} - {pr.branch}</span>

                            {pr.cc_user && (
                                <div className="mt-1 pt-1 border-t border-gray-200 mr-4 flex items-start gap-1">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase">CC:</span>
                                    <span className="text-[10px] font-bold text-gray-800 leading-tight">{pr.cc_user.name}</span>
                                </div>
                            )}
                        </div>

                        {/* Col 3: Budget Info */}
                        <div className="w-[25%] border-l border-gray-300 pl-3">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Budget Information:</span>
                            <span className="text-[11px] font-bold text-gray-900 block">Ref: <span className="font-normal">{pr.budget_ref}</span></span>
                            <span className="text-[11px] font-bold text-gray-900 block mt-0.5">Status: <span className="font-normal">{pr.budget_status || 'N/A'}</span></span>
                        </div>

                        {/* Col 4: Title & Dates */}
                        <div className="w-[20%] text-right flex flex-col justify-center">
                            <h2 className="text-[18px] font-bold text-indigo-600 leading-none m-0 whitespace-nowrap">PURCHASE REQUEST</h2>
                            <div className="font-bold text-[12px] mt-1">PR #: {pr.pr_number}</div>
                            <div className="text-[10px] font-semibold text-gray-600 mt-1">
                                Prepared: <span className="font-normal">{formatDate(pr.date_prepared)}</span><br />
                                Needed: <span className="font-normal text-red-600">{formatDate(pr.date_needed)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Purpose of Request */}
                    {pr.purpose_of_request && (
                        <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded-sm">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Purpose of Request</span>
                            <p className="text-[10px] text-gray-800 italic m-0">{pr.purpose_of_request}</p>
                        </div>
                    )}

                    {/* Items Table */}
                    <div>
                        <table className="w-full text-[10px] text-left mb-2 border-collapse">
                            <thead className="bg-gray-100 border-y border-gray-300">
                                <tr>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 w-[3%] text-center">#</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 w-[45%]">Product & Supplier Name</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[12%]">Quantity</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[20%]">Estimated Unit Cost</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[20%]">Total Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pr.items.map((item, index) => (
                                    <tr key={item.id} className="border-b border-gray-200 break-inside-avoid">
                                        <td className="py-[2px] px-2 text-center text-gray-500">{index + 1}</td>

                                        <td className="py-[2px] px-2">
                                            <strong className="text-gray-900">{item.product?.name || `Product ID: ${item.product_id}`}</strong>
                                            {item.specifications && <span className="text-[10px] text-gray-500 ml-1 pl-1 border-l border-gray-400"> {item.specifications}</span>}
                                            {item.supplier?.name && <span className="text-[9px] text-indigo-600 ml-1 pl-1 border-l border-gray-400">Pref: {item.supplier.name}</span>}
                                        </td>

                                        <td className="py-[2px] px-2 text-center font-semibold">{item.qty_requested} <span className="text-[10px] text-gray-500">{item.unit}</span></td>
                                        <td className="py-[2px] px-2 text-right text-gray-600">{formatCurrency(item.est_unit_cost)}</td>
                                        <td className="py-[2px] px-2 text-right font-bold text-gray-900">{formatCurrency(item.total_cost)}</td>
                                    </tr>
                                ))}

                                {/* Grand Total Row */}
                                <tr className="border-t-2 border-gray-800 break-inside-avoid">
                                    <td colSpan="4" className="py-2 px-2 text-right font-bold uppercase text-gray-700 text-[11px]">Estimated Grand Total:</td>
                                    <td className="py-2 px-2 text-right font-black text-[13px] text-gray-900 bg-gray-50">
                                        {formatCurrency(pr.items.reduce((sum, item) => sum + Number(item.total_cost), 0))}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* SIGNATURES SECTION - PINNED TO THE BOTTOM */}
                <div className="mt-auto pt-6 pb-2 break-inside-avoid w-full flex justify-between gap-12">
                    <div className="w-[30%]">
                        <div className="border-b border-gray-900 h-8 mb-1"></div>
                        <div className="text-[10px] text-gray-500 text-center leading-tight">Requested By</div>
                        <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">{pr.user?.name}</div>
                        <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">{pr.user?.role?.name || 'Employee'}</div>
                    </div>

                    <div className="w-[30%]">
                        <div className="border-b border-gray-900 h-8 mb-1"></div>
                        <div className="text-[10px] text-gray-500 text-center leading-tight">Reviewed By</div>
                        <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">{pr.reviewed_by?.name || 'PENDING'}</div>
                        <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">{pr.reviewed_by?.role?.name || ''}</div>
                    </div>

                    <div className="w-[30%]">
                        <div className="border-b border-gray-900 h-8 mb-1"></div>
                        <div className="text-[10px] text-gray-500 text-center leading-tight">Approved By</div>
                        <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">{pr.approved_by?.name || 'PENDING'}</div>
                        <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">{pr.approved_by?.role?.name || ''}</div>
                    </div>
                </div>

            </div>
        </div>
    );
}
