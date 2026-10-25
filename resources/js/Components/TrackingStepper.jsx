export default function TrackingStepper({ currentStatus, type = 'PR', branch, pr = {} }) {
    let prWorkflow = [
        { key: "submitted", label: "Purchase Request Submitted" },
        { key: "pending_inv_tl", label: "Inventory Team Leader Review" },
        { key: "pending_ops_manager", label: "Purchase Request Approval and Generation: Operations Manager" },
        { key: "pending_procurement", label: "Purchase Request Review: Procurement Assistant" },
        { key: "pending_procurement_tl", label: "Purchase Order Generation: Procurement Team Leader" },
        { key: "po_generated", label: "Purchase Order Generated" },
        { key: "pending_evp_final", label: "Executive Vice President Final Approval" },
        { key: "approved", label: "Purchase Order Approved" },
    ];

    const poWorkflow = [...prWorkflow];

    let workflow = type === "PR" ? prWorkflow : poWorkflow;

    let skippedInvTL = false;

    if (type === "PR") {
        const isCurrentlyAtInvTL = currentStatus === "pending_inv_tl";
        const hasInvTLSignature = pr && pr.reviewed_by_id;

        if (!isCurrentlyAtInvTL && !hasInvTLSignature) {
            workflow = workflow.filter((step) => step.key !== "pending_inv_tl");
            skippedInvTL = true;
        }
    }

    const isRejected = ['rejected', 'cancelled'].includes(currentStatus);

    let activeStatus = currentStatus;
    if (activeStatus === 'pending_approval') activeStatus = 'pending_evp_final';
    if (activeStatus === 'drafted') activeStatus = 'po_generated';
    if (activeStatus === 'pr_generated') activeStatus = 'pending_procurement';

    let currentIndex = workflow.findIndex(step => step.key === activeStatus);

    if (currentStatus === 'approved') {
        currentIndex = 99;
    }

    return (
        <div>
            <h4 className="text-center text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">
                {type === "PR" ? "Purchase Request Workflow" : "Purchase Order Workflow"}
            </h4>

            <div className="flex flex-wrap items-center justify-center gap-2 max-w-5xl mx-auto mt-6">
                {workflow.map((step, index) => {
                    let dotColor = "bg-gray-200 text-gray-500";
                    let textColor = "text-gray-400";
                    let ringColor = "bg-gray-50 border-gray-200";

                    if (!isRejected) {
                        if (index < currentIndex) {
                            dotColor = "bg-green-500 text-white font-bold shadow-sm";
                            textColor = "text-gray-700";
                            ringColor = "bg-green-50 border-green-200";
                        } else if (index === currentIndex) {
                            textColor = "text-gray-900";
                            ringColor = "bg-white border-indigo-300 ring-1 ring-indigo-100";
                            if (step.key === "approved") {
                                dotColor = "bg-green-500 text-white font-bold shadow-sm";
                            } else {
                                dotColor = "bg-amber-400 text-white font-bold animate-pulse shadow-sm";
                            }
                        }
                    } else {
                        if (index < currentIndex) {
                            dotColor = "bg-gray-400 text-white shadow-sm";
                            textColor = "text-gray-500";
                            ringColor = "bg-gray-50 border-gray-200";
                        } else if (index === currentIndex) {
                            dotColor = "bg-red-500 text-white font-bold shadow-sm";
                            textColor = "text-red-700 font-extrabold";
                            ringColor = "bg-red-50 border-red-300 ring-1 ring-red-100";
                        }
                    }

                    const isFinishLine = step.key === "approved";

                    return (
                        <div key={step.key} className="flex items-center gap-2">
                            <span
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border shadow-sm transition-colors ${
                                    isFinishLine && (index < currentIndex || index === currentIndex) && !isRejected
                                        ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300 shadow-md"
                                        : ringColor
                                }`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] shrink-0 ${dotColor}`}>
                                    {isRejected && index === currentIndex ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" /></svg>
                                    ) : index < currentIndex && !isRejected ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                                    ) : (
                                        <span>{index + 1}</span>
                                    )}
                                </div>

                                <div className="flex flex-col text-left">
                                    <span className={`text-xs ${isFinishLine && !isRejected && index <= currentIndex ? "font-extrabold text-emerald-900" : "font-medium " + textColor}`}>
                                        {isRejected && index === currentIndex ? (type === "PR" ? "Rejected" : "Cancelled") : step.label}
                                    </span>

                                    {step.key === "approved" && (currentIndex >= workflow.length - 1 || currentStatus === 'approved') && !isRejected ? (
                                        <span className="text-[10px] italic font-bold text-violet-700 mt-0.5 leading-tight border-emerald-200">
                                            ✓ Ready to Purchase
                                        </span>
                                    ) : null}

                                    {pr?.is_evp_override && step.key === "pending_ops_manager" ? (
                                        <span className="text-[10px] italic text-purple-600 font-bold mt-0.5 leading-tight">
                                            Authorized by Executive Vice President as Operations Manager Fallback
                                        </span>
                                    ) : null}
                                </div>
                            </span>
                            {index < workflow.length - 1 && (
                                <div className={`flex items-center justify-center p-1.5 rounded-md font-bold transition-colors duration-300 ${
                                    index < currentIndex && !isRejected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"
                                }`}>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                                    </svg>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {skippedInvTL && (
                <div className="mt-5 flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold shadow-sm">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Inventory TL Review skipped: No active Inventory Team Leader currently assigned to {branch || 'this branch'}.
                    </span>
                </div>
            )}
        </div>
    );
}
