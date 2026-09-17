import { Fragment, useEffect, useRef } from 'react';
import { Dialog, Transition } from '@headlessui/react';

// We added 3xl, 4xl, 5xl, 6xl, and 7xl here!
const maxWidthClasses = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
    '5xl': 'sm:max-w-5xl',
    '6xl': 'sm:max-w-6xl',
    '7xl': 'sm:max-w-7xl',
};

export default function Modal({
    children,
    show = false,
    maxWidth = '2xl',
    closeable = true,
    onClose = () => {},
}) {
    const panelRef = useRef(null);
    const touchStartY = useRef(0);

    useEffect(() => {
        if (show) {
            document.documentElement.classList.add('overflow-hidden');
            document.body.classList.add('overflow-hidden');
            document.documentElement.style.overscrollBehavior = 'none';
            document.body.style.overscrollBehavior = 'none';
        } else {
            document.documentElement.classList.remove('overflow-hidden');
            document.body.classList.remove('overflow-hidden');
            document.documentElement.style.overscrollBehavior = '';
            document.body.style.overscrollBehavior = '';
        }

        return () => {
            document.documentElement.classList.remove('overflow-hidden');
            document.body.classList.remove('overflow-hidden');
            document.documentElement.style.overscrollBehavior = '';
            document.body.style.overscrollBehavior = '';
        };
    }, [show]);

    useEffect(() => {
        const el = panelRef.current;
        if (!el || !show) return;

        const handleWheel = (e) => {
            const { scrollTop, scrollHeight, clientHeight } = el;
            const deltaY = e.deltaY;
            const atTop = scrollTop <= 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

            const canScroll = scrollHeight > clientHeight;

            if (!canScroll) {
                e.preventDefault();
                return;
            }

            if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
                e.preventDefault();
            }
        };

        const handleTouchStart = (e) => {
            touchStartY.current = e.touches[0].clientY;
        };

        const handleTouchMove = (e) => {
            const currentY = e.touches[0].clientY;
            const deltaY = touchStartY.current - currentY;

            const { scrollTop, scrollHeight, clientHeight } = el;
            const atTop = scrollTop <= 0;
            const atBottom = scrollTop + clientHeight >= scrollHeight - 1;

            const canScroll = scrollHeight > clientHeight;

            if (!canScroll) {
                e.preventDefault();
                return;
            }

            if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
                e.preventDefault();
            }
        };

        el.addEventListener('wheel', handleWheel, { passive: false });
        el.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.addEventListener('touchmove', handleTouchMove, { passive: false });

        return () => {
            el.removeEventListener('wheel', handleWheel);
            el.removeEventListener('touchstart', handleTouchStart);
            el.removeEventListener('touchmove', handleTouchMove);
        };
    }, [show]);

    const handleClose = () => {
        if (closeable) {
            onClose();
        }
    };

    return (
        <Transition appear show={show} as={Fragment}>
            <Dialog as="div" className="fixed inset-0 z-50" onClose={handleClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-hidden">
                    <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel
                                ref={panelRef}
                                className={`relative w-full ${
                                    maxWidthClasses[maxWidth] || maxWidthClasses['2xl']
                                } max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-none rounded-2xl bg-white text-left shadow-xl transition-all sm:max-h-[calc(100vh-4rem)]`}
                                style={{
                                    overscrollBehavior: 'none',
                                    WebkitOverflowScrolling: 'touch',
                                }}
                            >
                                {children}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
