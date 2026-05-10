export default function TrackingStepper({ currentStatus, type = 'PR', branch }) {
    // 1. Define the base workflow steps
    const prWorkflow = [
        { key: 'pending_inv_tl', label: 'Inv. TL Approval' },
        { key: 'pending_ops_manager', label: 'Ops Manager Approval' },
        { key: 'approved', label: 'Approved (PO Ready)' }
    ];

    const poWorkflow = [
        { key: 'drafted', label: 'Procurement Draft' },
        { key: 'pending_approval', label: 'DCSO Approval' },
        { key: 'approved', label: 'PO Finalized' }
    ];

    // 2. Select the base workflow
    let workflow = type === 'PR' ? prWorkflow : poWorkflow;

    // 🟢 NEW: Dynamically remove the 'pending_inv_tl' step if the branch is Greenhills
    if (type === 'PR' && branch === 'Greenhills') {
        workflow = workflow.filter(step => step.key !== 'pending_inv_tl');
    }
    
    // 3. Identify where we are in the workflow
    const isRejected = ['rejected', 'cancelled'].includes(currentStatus);
    const currentIndex = workflow.findIndex(step => step.key === currentStatus);

    return (
        <div>
            <h4 className="text-xs font-bold text-gray-500 uppercase border-b pb-2 mb-3">
                {type === 'PR' ? 'Purchase Request Workflow' : 'Purchase Order Workflow'}
            </h4>
            
            <div className="flex flex-wrap gap-2 text-sm font-bold">
                {workflow.map((step, index) => {
                    // Default to gray (future step or cancelled)
                    let dotColor = 'bg-gray-300'; 
                    let textColor = 'text-gray-400';
                    
                    if (!isRejected) {
                        if (index < currentIndex) {
                            // Past steps (or automatically skipped steps) are solid green
                            dotColor = 'bg-green-500';
                            textColor = 'text-gray-800';
                        } else if (index === currentIndex) {
                            textColor = 'text-gray-900';
                            // If it's an end-state, make it solid green. Otherwise, pulsing amber.
                            if (step.key === 'approved') {
                                dotColor = 'bg-green-500';
                            } else {
                                dotColor = 'bg-amber-400 animate-pulse';
                            }
                        }
                    }

                    return (
                        <span key={step.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg border shadow-sm transition-colors ${index === currentIndex && !isRejected ? 'bg-white border-gray-300 ring-1 ring-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                            <span className={`h-3 w-3 rounded-full ${dotColor}`}></span> 
                            <span className={textColor}>{step.label}</span>
                        </span>
                    );
                })}

                {/* If the request was rejected/cancelled, append a red pill at the end */}
                {isRejected && (
                    <span className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-lg border border-red-200 text-red-700 shadow-sm">
                        <span className="h-3 w-3 rounded-full bg-red-600 animate-pulse"></span> 
                        {type === 'PR' ? 'Rejected' : 'Cancelled'}
                    </span>
                )}
            </div>
        </div>
    );
}