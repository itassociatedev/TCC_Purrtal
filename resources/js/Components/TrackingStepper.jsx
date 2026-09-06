export default function TrackingStepper({ currentStatus, type = 'PR', branch, pr = {} }) {
    // 1. Define the full 4-tier workflow steps for PR
    const prWorkflow = [
        { key: "submitted", label: "Requested" },
        { key: "pending_inv_tl", label: "Inventory TL Review" },
        { key: "pending_ops_manager", label: "Operations Manager Approval" },
        { key: "pending_procurement_tl", label: "Procurement TL Approval" },
        { key: "pending_procurement", label: "Ready for PO Generation" },
    ];
    
    

    const poWorkflow = [
        { key: "drafted", label: "Procurement Team Leader Review" },
        { key: "pending_evp_final", label: "Executive Vice President Final Approval" },
        { key: "approved", label: "Purchase Order Approved & Finalized" },
    ];
    const isEVPOmOverride = Boolean(pr.is_evp_override);

    let workflow = type === "PR" ? prWorkflow : poWorkflow;

    // 2. Dynamically remove the 'pending_inv_tl' step if the branch is Greenhills
    if (type === "PR" && branch === "Greenhills") {
        workflow = workflow.filter((step) => step.key !== "pending_inv_tl");
    }

    // 3. Identify where we are in the workflow
    const isRejected = ['rejected', 'cancelled'].includes(currentStatus);
let currentIndex = workflow.findIndex(step => step.key === currentStatus);

// 🚩 3. Status Edge Cases (This is the safety net that keeps the colors!)
if (type === 'PR' && ['approved', 'po_generated'].includes(currentStatus)) {
    // If the PR is fully approved or POs are generated, force all steps to solid green
    currentIndex = 99; 
} else if (type === 'PR' && branch === 'Greenhills' && currentStatus === 'pending_inv_tl') {
    currentIndex = 0; 
}

    return (
        <div>
            <h4 className="text-center text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">
                {type === "PR"
                    ? "Purchase Request Workflow"
                    : "Purchase Order Workflow"}
            </h4>

            {/* <div className="flex flex-wrap gap-2 text-center text-sm font-bold pb-5"> */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-fit mx-auto mt-6">
                {workflow.map((step, index) => {
                    let dotColor = "bg-gray-300";
                    let textColor = "text-gray-400";

                    if (!isRejected) {
                        if (index < currentIndex) {
                            dotColor = "bg-green-500";
                            textColor = "text-gray-700";
                        } else if (index === currentIndex) {
                            textColor = "text-gray-900";
                            if (step.key === "approved") {
                                dotColor = "bg-green-500";
                            } else {
                                dotColor = "bg-amber-400 animate-pulse";
                            }
                        }
                    }

                    return (
                        <span
                            key={step.key}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-colors ${
    !isRejected && index < currentIndex
        ? "bg-green-50 border-green-200"
        : !isRejected && index === currentIndex
            ? "bg-white border-indigo-300 ring-1 ring-indigo-100"
            : "bg-gray-50 border-gray-200"
}`}>
                            <span
                                className={`h-3 w-3 rounded-full shrink-0 ${dotColor}`}
                            ></span>
                            {/* 🚩 Text is wrapped in a flex-col so the EVP marker stacks neatly below */}
                            <div className="flex flex-col">
                                <span className={textColor}>{step.label}</span>
                                {/* 🟢 THE FIX: Correct Database Column & Target the Text */}
                                {pr?.is_evp_override && step.key === "pending_ops_manager" ? (
                                    <span className="text-[10px] italic text-purple-600 font-bold mt-0.5 leading-tight">
                                        Authorized by the Executive Vice President as Operations Manager fallback.
                                    </span>
                                ) : null}
                            </div>
                        </span>
                    );
                })}
                {isRejected && (
                    <span className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200 text-red-700 shadow-sm">
                        <span className="h-3 w-3 rounded-full shrink-0 bg-red-600 animate-pulse"></span>
                        {type === "PR" ? "Rejected" : "Cancelled"}
                    </span>
                )}
            </div>
        </div>
    );
}