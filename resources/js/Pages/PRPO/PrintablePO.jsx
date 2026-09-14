import ApplicationLogo from '@/Components/ApplicationLogo';
import { Head } from '@inertiajs/react';

export default function PrintablePO({ po }) {

    const formatCurrency = (amount) => {
        return `₱${parseFloat(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

    // DYNAMIC CALCULATIONS BASED ON UP-TO-DATE PRODUCT PRICE
    const liveGrossAmount = po.items.reduce((sum, item) => {
        const currentPrice = item.product ? Number(item.product.price || 0) : Number(item.unit_price || 0);
        return sum + (Number(item.qty || 0) * currentPrice);
    }, 0);

    const discountAmount = Number(po.discount_total || 0);
    const liveNetOfDiscount = Math.max(0, liveGrossAmount - discountAmount);

    const hasVat = Number(po.vat_total || 0) > 0;
    const vatRate = hasVat ? 0.12 : 0;
    const liveVatTotal = liveNetOfDiscount * vatRate;
    const liveGrandTotal = liveNetOfDiscount + liveVatTotal;

    return (
        <div className="min-h-screen bg-gray-200 print:bg-white py-8 print:py-0 font-sans">
            <Head title={`Purchase Order #${po.po_number}`} />
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
                    Print Purchase Order / Save as PDF
                </button>
            </div>
            <div className="max-w-5xl mx-auto bg-white p-8 shadow-xl print:shadow-none print:p-0 border border-gray-300 print:border-none w-full flex flex-col justify-between min-h-[92vh] text-[10px] leading-[1.15] text-[#333]">
                <div>
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
                        <div className="w-[28%] border-l border-gray-300 pl-3">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">To Supplier:</span>
                            <span className="text-[11px] font-bold text-gray-900 uppercase">{po.supplier?.name}</span><br />
                            <span className="text-[10px] text-gray-600 block truncate">{po.supplier?.address || ''}</span>
                            <span className="text-[10px] text-gray-600 block">TIN: {po.supplier?.tin || 'N/A'}</span>
                        </div>
                        <div className="w-[27%] border-l border-gray-300 pl-3">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Shipping Details:</span>
                            <span className="text-[10px] font-bold text-gray-900 block">Ship To: <span className="font-normal">{po.ship_to || 'Main Clinic'}</span></span>
                            <span className="text-[10px] font-bold text-gray-900 block mt-0.5">Target Delivery: <span className="font-normal">{formatDate(po.delivery_date)}</span></span>
                            <span className="text-[10px] font-bold text-gray-900 block mt-0.5">Terms: <span className="font-normal">{po.payment_terms || '30 Days'}</span></span>
                        </div>
                        <div className="w-[20%] text-right flex flex-col justify-right">
                            <h2 className="text-[21px] font-bold text-indigo-600 leading-none m-0">PURCHASE ORDER</h2>
                            <div className="font-bold text-[12px] mt-1">PO ID: {po.po_number}</div>
                            <div className="text-[10px] font-semibold text-gray-600 mt-1">
                                Date: <span className="font-normal">{formatDate(po.po_date)}</span>
                            </div>
                        </div>
                    </div>
                    {po.purpose && (
                        <div className="mb-2 p-2 bg-gray-50 border border-gray-200 rounded-sm">
                            <span className="text-[9px] font-bold text-gray-500 uppercase block mb-0.5">Purpose / Remarks</span>
                            <p className="text-[10px] text-gray-800 italic m-0">{po.purpose}</p>
                        </div>
                    )}
                    <div>
                        <table className="w-full text-[10px] text-left mb-2 border-collapse">
                            <thead className="bg-gray-100 border-y border-gray-300">
                                <tr>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[10%]">Quantity</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[10%]">Unit</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-center w-[35%]">Product Name</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[15%]">Unit Price</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[15%]">Old Price</th>
                                    <th className="py-[3px] px-2 font-bold text-gray-800 text-right w-[15%]">Total Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {po.items.map((item, index) => {
                                    const currentPrice = item.product ? Number(item.product.price || 0) : Number(item.unit_price || 0);
                                    const oldPrice = Number(item.unit_price || 0);
                                    const qty = Number(item.qty || 0);
                                    const totalPrice = qty * currentPrice;

                                    return (
                                        <tr key={item.id} className="border-b border-gray-200 break-inside-avoid">
                                            <td className="py-[2px] px-2 text-center font-bold">{parseFloat(qty)}</td>
                                            <td className="py-[2px] px-2 text-center text-gray-500">{item.unit || '-'}</td>
                                            <td className="py-[2px] px-2 text-center">
                                                <strong className="text-gray-900 block">{item.product?.name || item.description}</strong>
                                                {item.specifications && (
                                                    <span className="text-[10px] text-gray-500 block mt-0.5">
                                                        {item.specifications}
                                                    </span>
                                                )}
                                                {item.notes && (
                                                    <span className="text-[9px] text-gray-500 block mt-0.5">Note: {item.notes}</span>
                                                )}
                                            </td>
                                            <td className="py-[2px] px-2 text-right font-bold text-blue-600">{formatCurrency(currentPrice)}</td>
                                            <td className="py-[2px] px-2 text-right text-gray-500">{formatCurrency(oldPrice)}</td>
                                            <td className="py-[2px] px-2 text-right font-bold text-gray-900">{formatCurrency(totalPrice)}</td>
                                        </tr>
                                    );
                                })}
                                <tr className="border-t-2 border-gray-800 break-inside-avoid">
                                    <td colSpan="5" className="py-2 px-2 text-right font-bold uppercase text-gray-700 text-[11px]">Gross Total:</td>
                                    <td className="py-2 px-2 text-right font-black text-[13px] text-gray-900 bg-gray-50">
                                        {formatCurrency(liveGrossAmount)}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
                <div>
                    <div className="flex justify-end mb-6">
                        <div className="w-[35%] text-[10px] space-y-1 bg-gray-50 p-3 border border-gray-200 rounded-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Gross Amount:</span>
                                <span className="font-medium text-gray-900">{formatCurrency(liveGrossAmount)}</span>
                            </div>
                            {discountAmount > 0 && (
                                <div className="flex justify-between text-indigo-600">
                                    <span>Less: Discount:</span>
                                    <span>-{formatCurrency(discountAmount)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-t border-gray-200 pt-1 font-semibold">
                                <span className="text-gray-700">Net of Discount:</span>
                                <span>{formatCurrency(liveNetOfDiscount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">VAT (12%):</span>
                                <span>{formatCurrency(liveVatTotal)}</span>
                            </div>
                            <div className="flex justify-between border-t-2 border-gray-800 pt-1 font-black text-[12px] text-gray-900">
                                <span>GRAND TOTAL:</span>
                                <span>{formatCurrency(liveGrandTotal)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="mt-auto pt-4 pb-2 break-inside-avoid w-full flex justify-between gap-12">
                        <div className="w-[30%]">
                            <div className="border-b border-gray-900 h-8 mb-1"></div>
                            <div className="text-[10px] text-gray-500 text-center leading-tight">Prepared By</div>
                            <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">{po.prepared_by?.name || 'Procurement'}</div>
                            <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">{po.prepared_by?.role?.name || 'Procurement Assistant'}</div>
                        </div>

                        <div className="w-[30%]">
                            <div className="border-b border-gray-900 h-8 mb-1"></div>
                            <div className="text-[10px] text-gray-500 text-center leading-tight">Reviewed By</div>
                            <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">{po.purchase_request?.reviewed_by?.name || 'PENDING'}</div>
                            <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">{po.purchase_request?.reviewed_by?.role?.name || ''}</div>
                        </div>

                        <div className="w-[30%]">
                            <div className="border-b border-gray-900 h-8 mb-1"></div>
        <div className="text-[10px] text-gray-500 text-center leading-tight">Approved By</div>
        {po.status === 'approved' && po.purchase_request?.approved_by ? (
            <>
                <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">
                    {po.purchase_request?.approved_by?.name || 'PENDING'}
                </div>
                <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">
                    {po.purchase_request?.approved_by?.role?.name || 'Executive Vice President'}
                </div>
            </>
        ) : (
            <>
                <div className="text-[11px] font-bold text-gray-900 uppercase text-center leading-tight">PENDING</div>
                <div className="text-[9px] font-semibold text-gray-600 text-center mt-0.5">Executive Vice President</div>
            </>
        )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
