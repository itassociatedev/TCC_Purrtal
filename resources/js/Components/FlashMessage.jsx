import { usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';

export default function FlashMessage() {
    const { flash = {}, errors = {} } = usePage().props;

    // Added an 'id' to track unique notifications
    const [toast, setToast] = useState({ message: '', type: '', id: 0 });
    const [visible, setVisible] = useState(false);
    const [progress, setProgress] = useState(100);

    const timerRef = useRef(null);
    const progressTimerRef = useRef(null);
    const toastRef = useRef(null);

    const getFirstErrorMessage = (errorObject) => {
        const firstValue = Object.values(errorObject)[0];
        if (!firstValue) return '';
        if (Array.isArray(firstValue)) return firstValue.join(' ');
        if (typeof firstValue === 'object' && firstValue !== null) return Object.values(firstValue).flat().join(' ');
        return String(firstValue);
    };

    const showToast = (message, type) => {
        // Assign a unique timestamp ID to force React to remount the timer bar
        setToast({ message, type, id: Date.now() });
        setVisible(true);
        setProgress(100);

        if (timerRef.current) clearTimeout(timerRef.current);
        if (progressTimerRef.current) clearTimeout(progressTimerRef.current);

        // Bumped to 100ms to guarantee the browser paints the 100% width before shrinking
        progressTimerRef.current = setTimeout(() => {
            setProgress(0);
        }, 100);

        // Close after 4 seconds
        timerRef.current = setTimeout(() => {
            setVisible(false);
        }, 4000);
    };

    useEffect(() => {
        let currentMessage = '';
        let currentType = '';

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

        const handleCustomToast = (e) => showToast(e.detail.message, e.detail.type);
        window.addEventListener('flash-toast', handleCustomToast);

        return () => {
            window.removeEventListener('flash-toast', handleCustomToast);
            if (timerRef.current) clearTimeout(timerRef.current);
            if (progressTimerRef.current) clearTimeout(progressTimerRef.current);
        };
    }, [flash, errors]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (visible && toastRef.current && !toastRef.current.contains(event.target)) {
                setVisible(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [visible]);

    const isSuccess = toast.type === 'success';

    return (

        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center pointer-events-none">

            <div
                ref={toastRef}
                aria-live="assertive"
                className={`transform transition-all duration-500 ease-in-out pointer-events-auto ${
                    visible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'
                }`}
            >
                <div className={`relative overflow-hidden bg-white border border-gray-200 border-l-4 rounded-md shadow-2xl pr-10 pl-4 py-4 min-w-[350px] max-w-md flex items-start gap-3 ${isSuccess ? 'border-l-green-500' : 'border-l-red-500'}`}>

                    <div className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full mt-0.5 ${isSuccess ? 'bg-green-100' : 'bg-red-100'}`}>
                        {isSuccess ? (
                            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                        ) : (
                            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        )}
                    </div>

                    <div className="flex-1">
                        <p className={`text-xs font-bold uppercase tracking-wide ${isSuccess ? 'text-green-700' : 'text-red-700'}`}>
                            {isSuccess ? 'SUCCESS' : 'ERROR'}
                        </p>
                        <p className="text-sm font-medium text-gray-900 mt-0.5 leading-snug">
                            {toast.message}
                        </p>
                    </div>

                    <button
                        onClick={() => setVisible(false)}
                        className="absolute top-4 right-3 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* ⏱️ Animated Timer Bar with forced remount Key */}
                    <div
                        key={toast.id}
                        className={`absolute bottom-0 left-0 h-1 transition-all ease-linear duration-[4000ms] ${
                            progress === 100 ? 'bg-green-500' : 'bg-red-500'
                        }`}
                        style={{
                            width: `${progress}%`,
                            // This creates a smooth color shift from green (4s) to red (0s) over 4 seconds
                            transitionProperty: 'width, background-color',
                            transitionDuration: '4000ms, 4000ms'
                        }}
                    ></div>
                </div>
            </div>
        </div>
    );
}
