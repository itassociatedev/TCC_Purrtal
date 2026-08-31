export default function TrackingStepper({
    currentStatus,
    type = "PR",
    branch,
    pr,
}) {
    // 1. Define the full 4-tier workflow steps for PR
    const prWorkflow = [
        { key: "submitted", label: "Purchase Request (Inventory Assistant)" },
        { key: "pending_inv_tl", label: "Initial Review (Inventory Team Leader)" },
        { key: "pending_ops_manager", label: "Approval (Branch Operations Manager)" },
        { key: "approved", label: "PO Ready (Procurement Team Leader)" },
    ];

    const poWorkflow = [
        { key: "drafted", label: "Procurement Draft" },
        { key: "pending_approval", label: "Executive Vice President Approval" },
        { key: "approved", label: "Purchase Order Finalized" },
    ];
    const isEVPOmOverride = Boolean(pr.is_evp_override);

    let workflow = type === "PR" ? prWorkflow : poWorkflow;

    // 2. Dynamically remove the 'pending_inv_tl' step if the branch is Greenhills
    if (type === "PR" && branch === "Greenhills") {
        workflow = workflow.filter((step) => step.key !== "pending_inv_tl");
    }

    // 3. Identify where we are in the workflow
    const isRejected = ["rejected", "cancelled"].includes(currentStatus);
    let currentIndex = workflow.findIndex((step) => step.key === currentStatus);

    // 4. Status Edge Cases
    if (type === "PR" && currentStatus === "po_generated") {
        currentIndex = 99;
    } else if (
        type === "PR" &&
        branch === "Greenhills" &&
        currentStatus === "pending_inv_tl"
    ) {
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
                            textColor = "text-gray-800";
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
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-colors ${index === currentIndex && !isRejected ? "bg-white border-indigo-300 ring-1 ring-indigo-100" : "bg-gray-50 border-gray-200"}`}
                        >
                            <span
                                className={`h-3 w-3 rounded-full shrink-0 ${dotColor}`}
                            ></span>

                            {/* 🚩 Text is wrapped in a flex-col so the EVP marker stacks neatly below */}
                            <div className="flex flex-col">
                                <span className={textColor}>{step.label}</span>

                                {/* The EVP Override Marker */}
                                {pr?.is_evp_override &&
                                    step.key === "pending_ops_manager" ? (
                                    <span className="text-[10px] italic text-purple-600 font-bold mt-0.5 leading-tight">
                                        Approved by the Executive Vice President as
                                        Operations Manager Fallback
                                    </span>
                                ) : null}
                            </div>
                            {isEVPOmOverride && (
    <span className="text-blue-600">
        
    </span>
)}
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