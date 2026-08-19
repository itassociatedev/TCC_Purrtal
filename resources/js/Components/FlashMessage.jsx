// Global flash/toast UI component (shows success/error messages)
import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export default function FlashMessage() {
    // 1. Pull both flash and errors from Inertia props
    const { flash = {}, errors = {} } = usePage().props;

    const [toast, setToast] = useState({ message: '', type: '' });
    const [visible, setVisible] = useState(false);
    const timerRef = useRef(null);

    const getFirstErrorMessage = (errorObject) => {
        const firstValue = Object.values(errorObject)[0];
        if (!firstValue) return '';
        if (Array.isArray(firstValue)) {
            return firstValue.join(' ');
        }
        if (typeof firstValue === 'object' && firstValue !== null) {
            return Object.values(firstValue).flat().join(' ');
        }
        return String(firstValue);
    };

    useEffect(() => {
        let currentMessage = '';
        let currentType = '';

        // 2. Check for Flash Success/Error first
        if (flash?.success) {
            currentMessage = flash.success;
            currentType = 'success';
        } else if (flash?.error) {
            currentMessage = flash.error;
            currentType = 'error';
        } else if (Object.keys(errors).length > 0) {
            currentMessage = getFirstErrorMessage(errors);
            currentType = 'error';
        }

        if (currentMessage) {
            showToast(currentMessage, currentType);
        }

        // Custom Event Listener for manual triggers
        const handleCustomToast = (e) => {
            showToast(e.detail.message, e.detail.type);
        };

        window.addEventListener('flash-toast', handleCustomToast);
        return () => window.removeEventListener('flash-toast', handleCustomToast);

    }, [flash, errors]); // Watch both flash and errors

    // Helper to trigger the animation
    const showToast = (message, type) => {
        setToast({ message, type });
        setVisible(true);

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        timerRef.current = window.setTimeout(() => {
            setVisible(false);
        }, 4000);
    };

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
        };
    }, []);

    return (
        <div
            aria-live="assertive"
            className={`fixed bottom-10 right-10 z-[100] transform transition-all duration-500 ease-in-out ${
                visible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'
            }`}
        >
            {toast.message && (
                <div 
                    className={`flex items-center gap-3 rounded-lg px-6 py-4 shadow-2xl border-l-4 ${
                        toast.type === 'success' 
                            ? 'bg-white text-green-800 border-green-500' 
                            : 'bg-white text-red-800 border-red-500'
                    }`}
                >
                    <div className={`${toast.type === 'success' ? 'bg-green-100' : 'bg-red-100'} p-1.5 rounded-full`}>
                        {toast.type === 'success' ? (
                            <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="h-5 w-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="3">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>
                    
                    <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase tracking-wider opacity-60">
                            {toast.type === 'success' ? 'Success' : 'Notice'}
                        </span>
                        <span className="text-sm font-semibold text-gray-800">{toast.message}</span>
                    </div>
                </div>
            )}
        </div>
    );
}