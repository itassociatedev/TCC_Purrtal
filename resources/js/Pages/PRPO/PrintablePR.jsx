import ApplicationLogo from '@/Components/ApplicationLogo';
import { Head } from '@inertiajs/react';

export default function PrintablePR({ pr, branchOM }) {
    const targetBranches = ["makati", "greenhills", "alabang"];
    const isTargetBranch = pr.branch && targetBranches.includes(pr.branch.trim().toLowerCase());
    const isCurrentlyAtInvTL = pr.status === "pending_inv_tl";
    const hasInvTLSignature = pr.reviewed_by_name || pr.reviewed_by_id;

    const skippedInvTL = isTargetBranch && !isCurrentlyAtInvTL && !hasInvTLSignature;

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


            <div className="max-w-5xl mx-auto bg-white p-8 shadow-xl print:shadow-none print:p-0 border border-gray-300 print:border-none w-full flex flex-col justify-between min-h-[92vh] text-[10px] leading-[1.15] text-[#333]">
                <div>
                    <div className="flex items-center border-b-2 border-gray-900 pb-2 mb-3">

                        <div className="w-[25%] flex items-center gap-0 pr-2 pt-0.5">
                            <div className="w-16 h-16 flex-shrink-0">
                                <ApplicationLogo className="w-full h-full text-indigo-900" />
                            </div>
                            <div>
                                <h1 className="text-[25px] font-bold text-gray-900 leading-tight m-0 text-nowrap">The Cat Clinic</h1>

                            </div>
                        </div>
                        <div className="w-[30%] border-l border-gray-300 pl-3">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Prepared By:</span>
                            <span className="text-[11px] font-bold text-gray-900 uppercase">{pr.prepared_by_name || pr.user?.name}</span><br />
                            <span className="text-[10px] text-gray-600">For: {pr.department} - {pr.branch}</span>

                            {pr.cc_user && (
                                <div className="mt-1 pt-1 border-t border-gray-200 mr-4 flex items-start gap-1">
                                    <span className="text-[9px] font-bold text-gray-500 uppercase">CC:</span>
                                    <span className="text-[10px] font-bold text-gray-800 leading-tight">{pr.cc_user.name}</span>
                                </div>
                            )}
                        </div>
                        <div className="w-[25%] border-l border-gray-300 pl-3">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Budget Information:</span>
                            <span className="text-[11px] font-bold text-gray-900 block">Ref: <span className="font-normal">{pr.budget_ref}</span></span>
                            <span className="text-[11px] font-bold text-gray-900 block mt-0.5">Status: <span className="font-normal">{pr.budget_status || 'N/A'}</span></span>
                        </div>
                        <div className="w-[20%] text-right flex flex-col justify-center">
                            <h2 className="text-[18px] font-bold text-indigo-600 leading-none m-0 whitespace-nowrap">PURCHASE REQUEST</h2>
                            <div className="font-bold text-[12px] mt-1">{pr.pr_number}</div>
                            <div className="text-[10px] font-semibold text-gray-600 mt-1">
                                Prepared: <span className="font-normal">{formatDate(pr.date_prepared)}</span><br />
                                Needed: <span className="font-normal text-red-600">{formatDate(pr.date_needed)}</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <table className="w-full text-[10px] text-left mb-2 border-collapse">
                            <thead className="bg-gray-100 border-y border-gray-300">
                                <tr>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[8%]">Quantity</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[8%]">Unit</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[22%]">Product Name</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[23%] whitespace-nowrap">Supplier Name</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[13%]">Unit Price</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[13%]">Old Unit Price</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[13%]">Total Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pr.items.map((item, index) => {
                                    const currentPrice = Number(item.est_unit_cost || 0);

                                    const oldPrice = item.product ? Number(item.product.price || 0) : currentPrice;

                                    const qty = Number(item.qty_requested || 0);
                                    const totalPrice = qty * currentPrice;

                                    const isPriceChanged = currentPrice !== oldPrice;

                                    return (
                                        <tr key={item.id} className="border-b border-gray-200 break-inside-avoid">
                                            <td className="py-[2px] px-2 text-center font-bold">{parseFloat(qty)}</td>
                                            <td className="py-[2px] px-2 text-center text-gray-500">{item.unit || '-'}</td>
                                            <td className="py-[2px] px-2 text-center">
                                                <strong className="text-gray-900 block">{item.product?.name || item.product_name || `Product ID: ${item.product_id}`}</strong>
                                                {item.specifications && <span className="text-[10px] text-gray-500 block mt-0.5">{item.specifications}</span>}
                                            </td>
                                            <td className="py-[2px] px-2 text-center font-semibold text-black whitespace-nowrap">
                                                {item.supplier?.name || '-'}
                                            </td>
                                            <td className={`py-[2px] px-2 text-right font-bold ${isPriceChanged ? 'text-[red]' : 'text-black'}`}>
                                                {formatCurrency(currentPrice)}
                                            </td>
                                            <td className="py-[2px] px-2 text-right text-black">
                                                {formatCurrency(oldPrice)}
                                            </td>
                                            <td className="py-[2px] px-2 text-right font-bold text-blue-600">
                                                {formatCurrency(totalPrice)}
                                            </td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-gray-800 break-inside-avoid">
                                    <td colSpan="6" className="py-2 px-2 text-right font-bold uppercase text-gray-700 text-[11px]">Estimated Grand Total:</td>
                                    <td className="py-2 px-2 text-right font-black text-[13px] text-blue-600 bg-gray-50">
                                        {formatCurrency(pr.items.reduce((sum, item) => sum + (Number(item.qty_requested || 0) * Number(item.est_unit_cost || 0)), 0))}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className={`mt-auto pt-6 pb-2 break-inside-avoid w-full flex ${skippedInvTL ? 'justify-center gap-24' : 'justify-between gap-12'}`}>
                    <div className={skippedInvTL ? 'w-[40%]' : 'w-[30%]'}>
                        <div className="border-b border-gray-900 h-10 mb-3"></div>
                        <div className="text-[10px] text-gray-500 text-center leading-tight mb-1">Requested By</div>
                        <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-none">{pr.prepared_by_name || pr.user?.name}</div>
                        <div className="text-[9px] font-semibold text-gray-600 text-center leading-none mt-[2px]">{pr.prepared_by_role || pr.user?.role?.name || 'Employee'}</div>
                    </div>

                    {!skippedInvTL && (
                        <div className="w-[30%]">
                            <div className="border-b border-gray-900 h-10 mb-3"></div>
                            <div className="text-[10px] text-gray-500 text-center leading-tight mb-1">Reviewed By</div>
                            <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-none">{pr.reviewed_by_name || pr.reviewed_by?.name || 'PENDING'}</div>
                            <div className="text-[9px] font-semibold text-gray-600 text-center leading-none mt-[2px]">{pr.reviewed_by_role || pr.reviewed_by?.role?.name || ''}</div>
                        </div>
                    )}

                    <div className={skippedInvTL ? 'w-[40%]' : 'w-[30%]'}>
                        <div className="border-b border-gray-900 h-10 mb-3"></div>
                        <div className="text-[10px] text-gray-500 text-center leading-tight mb-1">Approved By</div>
                        <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-none">
                            {pr.approved_by_name || pr.approved_by?.name || 'PENDING'}
                        </div>
                        <div className="text-[9px] font-semibold text-gray-600 text-center leading-none mt-[2px]">
                            {pr.approved_by_role || pr.approved_by?.role?.name || ''}
                        </div>

                        {pr.is_evp_override && (
                            <div className="mt-3 text-center">
                                <div className="text-[7px] italic text-gray-500 leading-none">on Behalf of:</div>
                                <div className="text-[8.5px] font-bold text-gray-800 uppercase leading-none mt-[2px]">
                                    {branchOM || 'Operations Manager'}
                                </div>
                                <div className="text-[7px] font-medium text-gray-600 leading-none mt-[2px]">
                                    Operations Manager ({pr.branch})
                                </div>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
