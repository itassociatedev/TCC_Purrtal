import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';

export default function ConfirmModal({
    show = false,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    confirmText = 'Confirm',
    confirmColor = 'bg-red-600 hover:bg-red-500 focus:bg-red-500 active:bg-red-700'
}) {
    return (
        <Modal show={show} onClose={onClose} maxWidth="sm">
            <div className="p-6">
                <h2 className="text-lg font-bold text-gray-900">
                    {title}
                </h2>

                <p className="mt-3 text-sm text-gray-600 whitespace-pre-line">
                    {message}
                </p>

                <div className="mt-6 flex justify-end gap-3">
                    {/* Cancel Button */}
                    <button
                        type="button"
                        className="px-4 py-2 text-sm font-bold text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 uppercase tracking-wider shadow-sm transition-colors focus:outline-none"
                        onClick={onClose}
                    >
                        Close
                    </button>

                    {/* Confirm Button */}
                    <button
                        type="button"
                        className={`px-4 py-2 text-sm font-bold text-white rounded-md uppercase tracking-wider shadow-sm transition-colors focus:outline-none ${confirmColor}`}
                        onClick={onConfirm}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
