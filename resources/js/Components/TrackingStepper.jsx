export default function TrackingStepper({ currentStatus, type = 'PR', branch, pr = {} }) {
    let prWorkflow = [
        { key: "submitted", label: "Purchase Request Submitted" },
        { key: "pending_inv_tl", label: "Inventory TL Review" },
        { key: "pending_ops_manager", label: "PR Approval & Generation: OM" },
        { key: "pending_procurement", label: "PR Review: Proc Assistant" },
        { key: "pending_procurement_tl", label: "PO Generation: Procurement TL" },
        { key: "po_generated", label: "Purchase Order Generated" },
        { key: "pending_evp_final", label: "EVP Final Approval" },
        { key: "approved", label: "Purchase Order Approved" },
    ];

    const poWorkflow = [
        { key: "submitted", label: "Purchase Request Submitted" },
        { key: "pending_inv_tl", label: "Inventory TL Review" },
        { key: "pending_ops_manager", label: "PR Approval & Generation: OM" },
        { key: "pending_procurement", label: "PR Review: Proc Assistant" },
        { key: "pending_procurement_tl", label: "PO Generation: Procurement TL" },
        { key: "po_generated", label: "Purchase Order Generated" },
        { key: "pending_evp_final", label: "EVP Final Approval" },
        { key: "approved", label: "Purchase Order Approved" },
    ];

    let workflow = type === "PR" ? prWorkflow : poWorkflow;

    if (type === "PR" && branch === "Greenhills") {
        workflow = workflow.filter((step) => step.key !== "pending_inv_tl");
    }

    const isRejected = ['rejected', 'cancelled'].includes(currentStatus);

    let activeStatus = currentStatus;
    if (activeStatus === 'pending_approval') {
        activeStatus = 'pending_evp_final';
    }
    if (activeStatus === 'drafted') {
        activeStatus = 'po_generated';
    }
    if (activeStatus === 'pr_generated') {
        activeStatus = 'pending_procurement';
    }

    let currentIndex = workflow.findIndex(step => step.key === activeStatus);

    if (currentStatus === 'approved') {
        currentIndex = 99;
    } else if (type === 'PR' && branch === 'Greenhills' && currentStatus === 'pending_inv_tl') {
        currentIndex = 0;
    }

    return (
        <div>
            <h4 className="text-center text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">
                {type === "PR" ? "Purchase Request Workflow" : "Purchase Order Workflow"}
            </h4>

            <div className="flex flex-wrap items-center justify-center gap-2 max-w-5xl mx-auto mt-6">
                {workflow.map((step, index) => {
                    let dotColor = "bg-gray-300";
                    let textColor = "text-gray-400";
                    let ringColor = "bg-gray-50 border-gray-200";

                    if (!isRejected) {
                        if (index < currentIndex) {
                            dotColor = "bg-green-500";
                            textColor = "text-gray-700";
                            ringColor = "bg-green-50 border-green-200";
                        } else if (index === currentIndex) {
                            textColor = "text-gray-900";
                            ringColor = "bg-white border-indigo-300 ring-1 ring-indigo-100";
                            if (step.key === "approved") {
                                dotColor = "bg-green-500";
                            } else {
                                dotColor = "bg-amber-400 animate-pulse";
                            }
                        }
                    } else {
                        if (index < currentIndex) {
                            dotColor = "bg-gray-400";
                            textColor = "text-gray-500";
                            ringColor = "bg-gray-50 border-gray-200";
                        } else if (index === currentIndex) {
                            dotColor = "bg-red-500";
                            textColor = "text-red-700 font-extrabold";
                            ringColor = "bg-red-50 border-red-300 ring-1 ring-red-100";
                        }
                    }

                    const isFinishLine = step.key === "approved";

                    return (
                        <div key={step.key} className="flex items-center gap-2">
                            <span
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-colors ${
                                    isFinishLine && (index < currentIndex || index === currentIndex) && !isRejected
                                        ? "bg-emerald-100 border-emerald-400 ring-2 ring-emerald-300 shadow-md"
                                        : ringColor
                                }`}>
                                <span className={`h-3 w-3 rounded-full shrink-0 ${dotColor}`}></span>
                                <div className="flex flex-col">
                                    <span className={`text-xs ${isFinishLine && !isRejected ? "font-extrabold text-emerald-900" : "font-medium " + textColor}`}>
                                        {isRejected && index === currentIndex ? (type === "PR" ? "Rejected" : "Cancelled") : step.label}
                                    </span>

                                    {step.key === "approved" && (currentIndex >= workflow.length - 1 || currentStatus === 'approved') && !isRejected ? (
                                        <span className="text-[10px] italic font-bold text-violet-700 mt-0.5 leading-tight border-emerald-200">
                                            ✓ Ready to Purchase
                                        </span>
                                    ) : null}

                                    {pr?.is_evp_override && step.key === "pending_ops_manager" ? (
                                        <span className="text-[10px] italic text-purple-600 font-bold mt-0.5 leading-tight">
                                            Authorized by Executive VP as OM Fallback
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
        </div>
    );
}
