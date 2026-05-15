import ConfirmModal from '@/Components/ConfirmModal';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getAdminLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import AnnouncementComments from '@/Components/AnnouncementComments';

export default function Announcements({ auth, announcements = [], branches = [], priorities = [] }) {
    const adminLinks = getAdminLinks(auth);
    const { system } = usePage().props;

    const FRAME_RATIO_CLASS = 'aspect-[16/9] w-full max-w-[720px]';
    const DEFAULT_ZOOM = 1;
    const MIN_ZOOM = 0.6;
    const MAX_ZOOM = 2.2;
    const ZOOM_STEP = 0.1;

    // --- FILTER STATES ---
    const [titleSearch, setTitleSearch] = useState('');
    const [selectedPriorityId, setSelectedPriorityId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedFilterBranch, setSelectedFilterBranch] = useState('');

    const startDatePickerRef = useRef(null);
    const endDatePickerRef = useRef(null);

    const addImagePreviewRef = useRef(null);
    const editImagePreviewRef = useRef(null);

    const [addImagePreview, setAddImagePreview] = useState(null);
    const [editImagePreview, setEditImagePreview] = useState(null);

    const [editingItem, setEditingItem] = useState(null);

    const [addCropState, setAddCropState] = useState({
        dragging: false,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
    });

    const [editCropState, setEditCropState] = useState({
        dragging: false,
        startX: 0,
        startY: 0,
        originX: 0,
        originY: 0,
    });

    // --- DATE HELPERS (MM/DD/YYYY display, YYYY-MM-DD picker value) ---
    const formatDateInput = (value) => {
        const digits = value.replace(/\D/g, '').slice(0, 8);

        if (digits.length <= 2) return digits;
        if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
        return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    };

    const isoToMMDDYYYY = (iso) => {
        if (!iso) return '';
        const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return '';
        const [, yyyy, mm, dd] = match;
        return `${mm}/${dd}/${yyyy}`;
    };

    const mmddyyyyToISO = (value) => {
        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return '';

        const [, mm, dd, yyyy] = match;
        const month = Number(mm);
        const day = Number(dd);
        const year = Number(yyyy);

        if (
            Number.isNaN(month) ||
            Number.isNaN(day) ||
            Number.isNaN(year) ||
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > 31
        ) {
            return '';
        }

        const date = new Date(year, month - 1, day);

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return '';
        }

        const safeMonth = String(month).padStart(2, '0');
        const safeDay = String(day).padStart(2, '0');

        return `${year}-${safeMonth}-${safeDay}`;
    };

    const parseMMDDYYYY = (value, endOfDay = false) => {
        if (!value) return null;

        const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (!match) return null;

        const [, mm, dd, yyyy] = match;
        const month = Number(mm);
        const day = Number(dd);
        const year = Number(yyyy);

        if (
            Number.isNaN(month) ||
            Number.isNaN(day) ||
            Number.isNaN(year) ||
            month < 1 ||
            month > 12 ||
            day < 1 ||
            day > 31
        ) {
            return null;
        }

        const date = new Date(year, month - 1, day);

        if (
            date.getFullYear() !== year ||
            date.getMonth() !== month - 1 ||
            date.getDate() !== day
        ) {
            return null;
        }

        if (endOfDay) {
            date.setHours(23, 59, 59, 999);
        } else {
            date.setHours(0, 0, 0, 0);
        }

        return date;
    };

    const openNativePicker = (ref) => {
        if (!ref?.current) return;

        if (typeof ref.current.showPicker === 'function') {
            ref.current.showPicker();
        } else {
            ref.current.focus();
            ref.current.click();
        }
    };

    // --- SAFE COLOR CONVERTER ---
    const normalizeHexColor = (hexColor) => {
        const fallback = '#4F46E5';
        let hex = (hexColor || fallback).replace('#', '');

        if (hex.length === 3) {
            hex = hex.split('').map((c) => c + c).join('');
        }

        if (hex.length !== 6) {
            hex = fallback.replace('#', '');
        }

        return `#${hex}`;
    };

    const getGlassStyle = (hexColor) => {
        const normalized = normalizeHexColor(hexColor);
        const hex = normalized.replace('#', '');

        const r = parseInt(hex.substring(0, 2), 16) || 79;
        const g = parseInt(hex.substring(2, 4), 16) || 70;
        const b = parseInt(hex.substring(4, 6), 16) || 229;

        return {
            backgroundColor: `rgba(${r}, ${g}, ${b}, 0.18)`,
            color: normalized,
            borderColor: `rgba(${r}, ${g}, ${b}, 0.28)`,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
        };
    };

    const getSolidBadgeStyle = (hexColor) => {
        const normalized = normalizeHexColor(hexColor);

        return {
            backgroundColor: normalized,
            color: '#ffffff',
            borderColor: normalized,
        };
    };

    const getImageSource = (item, previewImage) => {
        if (previewImage) return previewImage;
        if (item?.image_path) return `/storage/${item.image_path}`;
        return null;
    };

    const resetCrop = (setDataFn) => {
        setDataFn('image_zoom', DEFAULT_ZOOM);
        setDataFn('image_offset_x', 0);
        setDataFn('image_offset_y', 0);
    };

    const startCropDrag = (e, data, setStateFn) => {
        e.preventDefault();

        setStateFn({
            dragging: true,
            startX: e.clientX,
            startY: e.clientY,
            originX: data.image_offset_x || 0,
            originY: data.image_offset_y || 0,
        });
    };

    const handleCropMove = (e, state, setDataFn) => {
        if (!state.dragging) return;

        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;

        setDataFn('image_offset_x', state.originX + dx);
        setDataFn('image_offset_y', state.originY + dy);
    };

    const stopCropDrag = (setStateFn) => {
        setStateFn((prev) => ({ ...prev, dragging: false }));
    };

    const zoomImageIn = (data, setDataFn) => {
        const nextZoom = Math.min(MAX_ZOOM, (data.image_zoom || DEFAULT_ZOOM) + ZOOM_STEP);
        setDataFn('image_zoom', Number(nextZoom.toFixed(2)));
    };

    const zoomImageOut = (data, setDataFn) => {
        const nextZoom = Math.max(MIN_ZOOM, (data.image_zoom || DEFAULT_ZOOM) - ZOOM_STEP);
        setDataFn('image_zoom', Number(nextZoom.toFixed(2)));
    };

    // --- FILTERED ANNOUNCEMENTS ---
    const filteredAnnouncements = useMemo(() => {
        const source = Array.isArray(announcements) ? announcements : [];

        return source.filter((item) => {
            const matchesTitle =
                !titleSearch ||
                (item.title || '')
                    .toLowerCase()
                    .includes(titleSearch.toLowerCase().trim());

            const matchesPriority =
                !selectedPriorityId ||
                String(item.priority_level_id) === String(selectedPriorityId);

            const matchesBranch = !selectedFilterBranch || (item.branches && item.branches.some(b => String(b.id) === String(selectedFilterBranch)));

            let matchesDate = true;

            if (startDate || endDate) {
                const createdAt = item.created_at ? new Date(item.created_at) : null;

                if (!createdAt || Number.isNaN(createdAt.getTime())) {
                    matchesDate = false;
                } else {
                    const itemDate = new Date(createdAt);
                    itemDate.setHours(0, 0, 0, 0);

                    if (startDate) {
                        const start = parseMMDDYYYY(startDate, false);
                        if (!start || itemDate < start) matchesDate = false;
                    }

                    if (endDate) {
                        const end = parseMMDDYYYY(endDate, true);
                        if (!end || createdAt > end) matchesDate = false;
                    }
                }
            }

            return matchesTitle && matchesPriority && matchesDate && matchesBranch;
        });
    }, [announcements, titleSearch, selectedPriorityId, startDate, endDate]);

    // --- MANUAL CAROUSEL PAGINATION ---
    const cardsPerPage = 6;
    const chunkedAnnouncements = [];
    for (let i = 0; i < filteredAnnouncements.length; i += cardsPerPage) {
        chunkedAnnouncements.push(filteredAnnouncements.slice(i, i + cardsPerPage));
    }

    const carouselRef = useRef(null);
    const [activeSlide, setActiveSlide] = useState(0);

    const getCarouselMetrics = () => {
        if (!carouselRef.current) return null;

        const firstPage = carouselRef.current.querySelector('[data-carousel-page="true"]');
        if (!firstPage) return null;

        const pageWidth = firstPage.getBoundingClientRect().width;
        const styles = window.getComputedStyle(carouselRef.current);
        const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0;

        return {
            pageWidth,
            gap,
            fullStep: pageWidth + gap,
        };
    };

    const handleScroll = () => {
        const metrics = getCarouselMetrics();
        if (!metrics || !carouselRef.current) return;

        const current = Math.round(carouselRef.current.scrollLeft / metrics.fullStep);
        const safeIndex = Math.max(0, Math.min(current, chunkedAnnouncements.length - 1));
        setActiveSlide(safeIndex);
    };

    const goToSlide = (index) => {
        if (!carouselRef.current) return;

        const metrics = getCarouselMetrics();
        if (!metrics) return;

        const safeIndex = Math.max(0, Math.min(index, chunkedAnnouncements.length - 1));

        carouselRef.current.scrollTo({
            left: safeIndex * metrics.fullStep,
            behavior: 'smooth',
        });

        setActiveSlide(safeIndex);
    };

    const scrollLeft = () => {
        goToSlide(activeSlide === 0 ? chunkedAnnouncements.length - 1 : activeSlide - 1);
    };

    const scrollRight = () => {
        goToSlide(
            activeSlide === chunkedAnnouncements.length - 1 ? 0 : activeSlide + 1
        );
    };

    // --- GLOBAL CONFIRMATION MODAL ---
    const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', confirmText: '', confirmColor: '', onConfirm: () => {} });
    const closeConfirmModal = () => setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

    const confirmDelete = (announcement) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Announcement',
            message: `Are you sure you want to delete "${announcement.title}"? \n\nThis will remove it from all branch dashboards immediately.`,
            confirmText: 'Delete',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.announcements.destroy', announcement.id), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    // --- CHECKBOX HELPER ---
    const handleBranchToggle = (branchId, currentIds, setData) => {
        if (currentIds.includes(branchId)) {
            setData('branch_ids', currentIds.filter(id => id !== branchId));
        } else {
            setData('branch_ids', [...currentIds, branchId]);
        }
    };

    // --- PRIORITIES CRUD LOGIC ---
    const [isManagePrioritiesModalOpen, setIsManagePrioritiesModalOpen] = useState(false);
    const [editingPriorityId, setEditingPriorityId] = useState(null);

    const {
        data: priorityData,
        setData: setPriorityData,
        post: postPriority,
        put: putPriority,
        processing: priorityProcessing,
        reset: resetPriority,
        clearErrors: clearPriorityErrors
    } = useForm({
        name: '',
        color: '#4F46E5'
    });

    const openManagePriorities = () => {
        setIsManagePrioritiesModalOpen(true);
        resetPriority();
        setEditingPriorityId(null);
    };

    const closeManagePriorities = () => {
        setIsManagePrioritiesModalOpen(false);
        resetPriority();
        clearPriorityErrors();
        setEditingPriorityId(null);
    };

    const startEditPriority = (priority) => {
        setEditingPriorityId(priority.id);
        setPriorityData({
            name: priority.name,
            color: priority.color
        });
    };

    const cancelEditPriority = () => {
        setEditingPriorityId(null);
        resetPriority();
        clearPriorityErrors();
    };

    const submitSavePriority = (e) => {
        e.preventDefault();
        if (editingPriorityId) {
            putPriority(route('admin.announcements.priority.update', editingPriorityId), {
                preserveScroll: true,
                onSuccess: () => {
                    cancelEditPriority();
                }
            });
        } else {
            postPriority(route('admin.announcements.priority.store'), {
                preserveScroll: true,
                onSuccess: () => {
                    resetPriority();
                }
            });
        }
    };

    const confirmDeletePriority = (priority) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Priority',
            message: `Are you sure you want to delete the priority "${priority.name}"?`,
            confirmText: 'Delete Priority',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.announcements.priority.destroy', priority.id), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            }
        });
    };

    // --- ADD ANNOUNCEMENT LOGIC ---
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const {
        data: addData,
        setData: setAddData,
        post: postData,
        processing: addProcessing,
        errors: addErrors,
        clearErrors: clearAddErrors,
        reset: resetAdd
    } = useForm({
        title: '',
        author: '',
        content: '',
        priority_level_id: '',
        branch_ids: [],
        image: null,
        attachment: null,
        image_zoom: DEFAULT_ZOOM,
        image_offset_x: 0,
        image_offset_y: 0,
    });

    useEffect(() => {
        if (!addData.image) {
            setAddImagePreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(addData.image);
        setAddImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [addData.image]);

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        clearAddErrors();
        resetAdd();
        setAddImagePreview(null);
        setAddCropState({
            dragging: false,
            startX: 0,
            startY: 0,
            originX: 0,
            originY: 0,
        });
    };

    const submitAdd = (e) => {
        e.preventDefault();
        postData(route('admin.announcements.store'), {
            preserveScroll: true,
            onSuccess: () => closeAddModal()
        });
    };

    // --- EDIT ANNOUNCEMENT LOGIC ---
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const {
        data: editData,
        setData: setEditData,
        post: updateData,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
        reset: resetEdit
    } = useForm({
        _method: 'put',
        title: '',
        author: '',
        content: '',
        priority_level_id: '',
        branch_ids: [],
        image: null,
        attachment: null,
        image_zoom: DEFAULT_ZOOM,
        image_offset_x: 0,
        image_offset_y: 0,
    });

    useEffect(() => {
        if (!editData.image) {
            setEditImagePreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(editData.image);
        setEditImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [editData.image]);

    const openEditModal = (item) => {
        setEditingId(item.id);
        setEditingItem(item);
        setEditData({
            _method: 'put',
            title: item.title,
            author: item.author,
            content: item.content,
            priority_level_id: item.priority_level_id || '',
            branch_ids: item.branches.map(b => b.id),
            image: null,
            attachment: null,
            image_zoom: item.image_zoom ?? DEFAULT_ZOOM,
            image_offset_x: item.image_offset_x ?? 0,
            image_offset_y: item.image_offset_y ?? 0,
        });
        setIsEditModalOpen(true);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        clearEditErrors();
        resetEdit();
        setEditingId(null);
        setEditingItem(null);
        setEditImagePreview(null);
        setEditCropState({
            dragging: false,
            startX: 0,
            startY: 0,
            originX: 0,
            originY: 0,
        });
    };

    const submitEdit = (e) => {
        e.preventDefault();
        updateData(route('admin.announcements.update', editingId), {
            preserveScroll: true,
            onSuccess: () => closeEditModal()
        });
    };

    const renderImageCropper = (
        mode,
        data,
        setDataFn,
        previewSrc,
        cropState,
        setCropState,
        currentItem = null,
        errorMessage = null
    ) => {
        const imageSrc = getImageSource(currentItem, previewSrc);

        return (
            <div className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div>
                    <InputLabel
                        htmlFor={`${mode}_image`}
                        value={mode === 'edit' ? 'Replace Cover Photo (Leave empty to keep current image)' : 'Cover Photo (Image)'}
                    />
                    <input
                        id={`${mode}_image`}
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={(e) => {
                            setDataFn('image', e.target.files[0] || null);
                            setTimeout(() => resetCrop(setDataFn), 0);
                        }}
                    />
                    <InputError message={errorMessage} className="mt-2" />
                </div>

                {imageSrc ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <p className="text-sm font-medium text-gray-700">Cover Photo Preview</p>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => zoomImageOut(data, setDataFn)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={(data.image_zoom || DEFAULT_ZOOM) <= MIN_ZOOM}
                                >
                                    −
                                </button>

                                <button
                                    type="button"
                                    onClick={() => zoomImageIn(data, setDataFn)}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={(data.image_zoom || DEFAULT_ZOOM) >= MAX_ZOOM}
                                >
                                    +
                                </button>

                                <button
                                    type="button"
                                    onClick={() => resetCrop(setDataFn)}
                                    className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                                >
                                    Reset
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-center">
                            <div
                                className={`${FRAME_RATIO_CLASS} relative overflow-hidden rounded-lg border border-gray-200 bg-white`}
                                onMouseMove={(e) => handleCropMove(e, cropState, setDataFn)}
                                onMouseUp={() => stopCropDrag(setCropState)}
                                onMouseLeave={() => stopCropDrag(setCropState)}
                            >
                                <img
                                    src={imageSrc}
                                    alt="Cover Preview"
                                    draggable={false}
                                    onMouseDown={(e) => startCropDrag(e, data, setCropState)}
                                    className={`${cropState.dragging ? 'cursor-grabbing' : 'cursor-grab'} absolute left-1/2 top-1/2 select-none`}
                                    style={{
                                        transform: `translate(calc(-50% + ${data.image_offset_x || 0}px), calc(-50% + ${data.image_offset_y || 0}px)) scale(${data.image_zoom || DEFAULT_ZOOM})`,
                                        transformOrigin: 'center center',
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        pointerEvents: 'auto',
                                    }}
                                />
                            </div>
                        </div>

                        <p className="text-xs text-gray-500">
                            Drag the image to reposition it inside the frame. Use the minus and plus buttons to zoom out or in.
                        </p>
                    </>
                ) : (
                    <div className="rounded-md border border-dashed border-gray-300 bg-white p-6 text-center text-sm italic text-gray-400">
                        No image selected yet.
                    </div>
                )}
            </div>
        );
    };

    return (
        <SidebarLayout
            activeModule="Admin"
            sidebarLinks={adminLinks}
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Announcements</h2>}
        >
            <Head title="Announcements & Notices" />

            <style>{`
                .hide-scroll::-webkit-scrollbar {
                    display: none;
                }

                .hide-scroll {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }

                .smooth-snap {
                    scroll-snap-type: x mandatory;
                    -webkit-overflow-scrolling: touch;
                    overscroll-behavior-x: contain;
                }

                .announcement-card .announcement-badge {
                    background: var(--badge-solid-bg);
                    color: var(--badge-solid-text);
                    border-color: var(--badge-solid-border);
                    backdrop-filter: none;
                    -webkit-backdrop-filter: none;
                }

                .announcement-card:hover .announcement-badge {
                    background: var(--badge-glass-bg);
                    color: var(--badge-glass-text);
                    border-color: var(--badge-glass-border);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                }
            `}</style>

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="mb-6 flex items-center justify-between">
                        <p className="text-gray-600">Broadcast notices and updates to specific clinic branches.</p>
                        <button
                            onClick={() => setIsAddModalOpen(true)}
                            className="rounded-md bg-gray-800 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-gray-700"
                        >
                            + Post Announcement
                        </button>
                    </div>

                    <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <div>
                                <InputLabel htmlFor="filter_title" value="Search Title" />
                                <TextInput
                                    id="filter_title"
                                    className="mt-1 block w-full"
                                    value={titleSearch}
                                    onChange={(e) => setTitleSearch(e.target.value)}
                                    placeholder="Search by title..."
                                />
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_priority" value="Categories" />
                                <select
                                    id="filter_priority"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={selectedPriorityId}
                                    onChange={(e) => setSelectedPriorityId(e.target.value)}
                                >
                                    <option value="">All Categories</option>
                                    {priorities.map((priority) => (
                                        <option key={priority.id} value={priority.id}>
                                            {priority.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_branch" value="Target Branch" />
                                <select
                                    id="filter_branch"
                                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={selectedFilterBranch}
                                    onChange={(e) => setSelectedFilterBranch(e.target.value)}
                                >
                                    <option value="">All Branches</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_start_date_display" value="Start Date" />
                                <div className="relative mt-1">
                                    <input
                                        id="filter_start_date_display"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="MM/DD/YYYY"
                                        className="block w-full rounded-md border-gray-300 pr-11 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={startDate}
                                        onChange={(e) => setStartDate(formatDateInput(e.target.value))}
                                    />
                                    <input
                                        ref={startDatePickerRef}
                                        type="date"
                                        value={mmddyyyyToISO(startDate)}
                                        onChange={(e) => setStartDate(isoToMMDDYYYY(e.target.value))}
                                        className="pointer-events-none absolute right-0 top-0 h-full w-0 opacity-0"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openNativePicker(startDatePickerRef)}
                                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-gray-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15a.75.75 0 01.75.75v11.25a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V7.5a.75.75 0 01.75-.75z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <InputLabel htmlFor="filter_end_date_display" value="End Date" />
                                <div className="relative mt-1">
                                    <input
                                        id="filter_end_date_display"
                                        type="text"
                                        inputMode="numeric"
                                        maxLength={10}
                                        placeholder="MM/DD/YYYY"
                                        className="block w-full rounded-md border-gray-300 pr-11 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                        value={endDate}
                                        onChange={(e) => setEndDate(formatDateInput(e.target.value))}
                                    />
                                    <input
                                        ref={endDatePickerRef}
                                        type="date"
                                        value={mmddyyyyToISO(endDate)}
                                        onChange={(e) => setEndDate(isoToMMDDYYYY(e.target.value))}
                                        className="pointer-events-none absolute right-0 top-0 h-full w-0 opacity-0"
                                        tabIndex={-1}
                                        aria-hidden="true"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => openNativePicker(endDatePickerRef)}
                                        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-gray-500 hover:text-gray-700"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-5 w-5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3.75 8.25h16.5M4.5 6.75h15a.75.75 0 01.75.75v11.25a.75.75 0 01-.75.75h-15a.75.75 0 01-.75-.75V7.5a.75.75 0 01.75-.75z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <SecondaryButton
                                onClick={() => {
                                    setTitleSearch('');
                                    setSelectedPriorityId('');
                                    setSelectedFilterBranch('');
                                    setStartDate('');
                                    setEndDate('');
                                    goToSlide(0);
                                }}
                            >
                                Reset Filters
                            </SecondaryButton>
                        </div>
                    </div>

                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-600">
                            Showing {filteredAnnouncements.length} announcement{filteredAnnouncements.length !== 1 ? 's' : ''}
                        </p>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4">
                        {chunkedAnnouncements.length > 1 && (
                            <button
                                onClick={scrollLeft}
                                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-sm transition-all focus:outline-none hover:scale-105 hover:shadow-md lg:flex"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                                </svg>
                            </button>
                        )}

                        <div
                            ref={carouselRef}
                            onScroll={handleScroll}
                            className="hide-scroll smooth-snap flex w-full flex-1 gap-6 overflow-x-auto overflow-y-visible scroll-smooth bg-transparent px-0 py-1"
                        >
                            {chunkedAnnouncements.length === 0 ? (
                                <div className="w-full rounded-lg border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm">
                                    No announcements found.
                                </div>
                            ) : (
                                chunkedAnnouncements.map((pageItems, pageIndex) => (
                                    <div
                                        key={pageIndex}
                                        data-carousel-page="true"
                                        className="w-full shrink-0 snap-start border-0 bg-transparent shadow-none"
                                    >
                                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
                                            {pageItems.map((item) => {
                                                const priorityName = item.priority_level?.name || 'Notice';
                                                const badgeColor = item.priority_level?.color || '#4F46E5';
                                                const solidBadgeStyle = getSolidBadgeStyle(badgeColor);
                                                const glassBadgeStyle = getGlassStyle(badgeColor);

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="announcement-card relative flex h-[430px] flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
                                                        style={{
                                                            '--badge-solid-bg': solidBadgeStyle.backgroundColor,
                                                            '--badge-solid-text': solidBadgeStyle.color,
                                                            '--badge-solid-border': solidBadgeStyle.borderColor,
                                                            '--badge-glass-bg': glassBadgeStyle.backgroundColor,
                                                            '--badge-glass-text': glassBadgeStyle.color,
                                                            '--badge-glass-border': glassBadgeStyle.borderColor,
                                                        }}
                                                    >
                                                        <div className="absolute right-3 top-3 z-10">
                                                            <span
                                                                className="announcement-badge rounded border px-2 py-1 text-xs font-bold uppercase shadow-sm transition-all duration-200"
                                                            >
                                                                {priorityName}
                                                            </span>
                                                        </div>

                                                        <div className={`${FRAME_RATIO_CLASS} relative overflow-hidden border-b border-gray-100 bg-gray-100`}>
                                                            {item.image_path ? (
                                                                <img
                                                                    src={`/storage/${item.image_path}`}
                                                                    alt={item.title}
                                                                    className="absolute left-1/2 top-1/2"
                                                                    style={{
                                                                        transform: `translate(calc(-50% + ${item.image_offset_x ?? 0}px), calc(-50% + ${item.image_offset_y ?? 0}px)) scale(${item.image_zoom ?? DEFAULT_ZOOM})`,
                                                                        transformOrigin: 'center center',
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain',
                                                                    }}
                                                                />
                                                            ) : (
                                                                <div className="flex h-full items-center justify-center text-sm text-gray-400">
                                                                    No Cover Photo
                                                                </div>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-1 flex-col p-5">
                                                            <h3 className="pr-16 text-lg font-bold text-gray-900">{item.title}</h3>
                                                            <p className="mb-3 text-xs text-gray-500">
                                                                By {item.author} • {new Date(item.created_at).toLocaleDateString('en-US', {
                                                                    timeZone: system?.timezone || 'Asia/Manila',
                                                                    month: '2-digit',
                                                                    day: '2-digit',
                                                                    year: 'numeric',
                                                                })}
                                                            </p>

                                                            <div className="mb-4 flex flex-wrap gap-1">
                                                                {item.branches.map(branch => (
                                                                    <span
                                                                        key={branch.id}
                                                                        className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-semibold text-gray-600"
                                                                    >
                                                                        {branch.name}
                                                                    </span>
                                                                ))}
                                                            </div>

                                                            <p className="mb-4 flex-1 whitespace-pre-line text-sm text-gray-600 line-clamp-3">
                                                                {item.content}
                                                            </p>

                                                            {item.attachment_path && (
                                                                <div className="mb-4">
                                                                    <a
                                                                        href={`/storage/${item.attachment_path}`}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center gap-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
                                                                    >
                                                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                                                                        </svg>
                                                                        Download Attachment
                                                                    </a>
                                                                </div>
                                                            )}

                                                            <div className="mt-auto flex justify-end gap-3 border-t border-gray-100 pt-3">
                                                                <button
                                                                    onClick={() => openEditModal(item)}
                                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    onClick={() => confirmDelete(item)}
                                                                    className="text-sm font-medium text-red-600 hover:text-red-800"
                                                                >
                                                                    Delete
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {pageItems.length < cardsPerPage &&
                                                Array.from({ length: cardsPerPage - pageItems.length }).map((_, idx) => (
                                                    <div
                                                        key={`placeholder-${pageIndex}-${idx}`}
                                                        className="hidden h-[430px] rounded-lg border border-transparent bg-transparent lg:block"
                                                        aria-hidden="true"
                                                    />
                                                ))}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {chunkedAnnouncements.length > 1 && (
                            <button
                                onClick={scrollRight}
                                className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-black shadow-sm transition-all focus:outline-none hover:scale-105 hover:shadow-md lg:flex"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="h-5 w-5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {chunkedAnnouncements.length > 1 && (
                        <div className="mt-4 flex items-center justify-center gap-2">
                            {chunkedAnnouncements.map((_, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => goToSlide(idx)}
                                    className={`h-2.5 rounded-full transition-all duration-300 ${
                                        activeSlide === idx
                                            ? 'w-8 bg-indigo-600 shadow-sm'
                                            : 'w-2.5 bg-gray-300 hover:bg-gray-400'
                                    }`}
                                    aria-label={`Go to page ${idx + 1}`}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <Modal show={isAddModalOpen} onClose={closeAddModal} maxWidth="2xl">
                <form onSubmit={submitAdd} className="p-6">
                    <h2 className="mb-6 text-lg font-medium text-gray-900">Post New Announcement</h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <input type="hidden" name="image_zoom" value={addData.image_zoom} />
                        <input type="hidden" name="image_offset_x" value={addData.image_offset_x} />
                        <input type="hidden" name="image_offset_y" value={addData.image_offset_y} />

                        <div className="md:col-span-2">
                            <InputLabel htmlFor="add_title" value="Title" />
                            <TextInput
                                id="add_title"
                                className="mt-1 block w-full"
                                value={addData.title}
                                onChange={(e) => setAddData('title', e.target.value)}
                                required
                            />
                            <InputError message={addErrors.title} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="add_author" value="Author (Posted By)" />
                            <TextInput
                                id="add_author"
                                className="mt-1 block w-full"
                                value={addData.author}
                                onChange={(e) => setAddData('author', e.target.value)}
                                placeholder="e.g. HR Dept or Dr. Smith"
                                required
                            />
                            <InputError message={addErrors.author} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel htmlFor="add_priority" value="Category" />
                            <div className="mt-1 flex gap-2">
                                <select
                                    id="add_priority"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={addData.priority_level_id}
                                    onChange={(e) => setAddData('priority_level_id', e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select a category...</option>
                                    {priorities.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={openManagePriorities}
                                    className="whitespace-nowrap rounded-md bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                                >
                                    Manage Categories
                                </button>
                            </div>
                            <InputError message={addErrors.priority || addErrors.priority_level_id} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel value="Target Branches (Select at least one)" />
                            <div className="mt-2 flex flex-wrap gap-4 rounded-md border bg-gray-50 p-3">
                                {branches.map(branch => (
                                    <label key={branch.id} className="flex cursor-pointer items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
                                            checked={addData.branch_ids.includes(branch.id)}
                                            onChange={() => handleBranchToggle(branch.id, addData.branch_ids, setAddData)}
                                        />
                                        <span className="text-sm text-gray-700">{branch.name}</span>
                                    </label>
                                ))}
                            </div>
                            <InputError message={addErrors.branch_ids} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel htmlFor="add_content" value="Announcement Details" />
                            <textarea
                                id="add_content"
                                rows="4"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                value={addData.content}
                                onChange={(e) => setAddData('content', e.target.value)}
                                required
                            />
                            <InputError message={addErrors.content} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            {renderImageCropper(
                                'add',
                                addData,
                                setAddData,
                                addImagePreview,
                                addCropState,
                                setAddCropState,
                                null,
                                addErrors.image
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel value="File Attachment (PDF, Excel, Word)" />
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-green-700 hover:file:bg-green-100"
                                onChange={(e) => setAddData('attachment', e.target.files[0])}
                            />
                            <InputError message={addErrors.attachment} className="mt-2" />
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeAddModal}>Cancel</SecondaryButton>
                        <PrimaryButton className="ms-3" disabled={addProcessing}>
                            Post Announcement
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            <Modal show={isEditModalOpen} onClose={closeEditModal} maxWidth="2xl">
                <form onSubmit={submitEdit} className="p-6">
                    <h2 className="mb-6 text-lg font-medium text-gray-900">Edit Announcement</h2>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <input type="hidden" name="image_zoom" value={editData.image_zoom} />
                        <input type="hidden" name="image_offset_x" value={editData.image_offset_x} />
                        <input type="hidden" name="image_offset_y" value={editData.image_offset_y} />

                        <div className="md:col-span-2">
                            <InputLabel htmlFor="edit_title" value="Title" />
                            <TextInput
                                id="edit_title"
                                className="mt-1 block w-full"
                                value={editData.title}
                                onChange={(e) => setEditData('title', e.target.value)}
                                required
                            />
                            <InputError message={editErrors.title} className="mt-2" />
                        </div>

                        <div>
                            <InputLabel htmlFor="edit_author" value="Author" />
                            <TextInput
                                id="edit_author"
                                className="mt-1 block w-full"
                                value={editData.author}
                                onChange={(e) => setEditData('author', e.target.value)}
                                required
                            />
                            <InputError message={editErrors.author} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel htmlFor="edit_priority" value="Category" />
                            <div className="mt-1 flex gap-2">
                                <select
                                    id="edit_priority"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                    value={editData.priority_level_id}
                                    onChange={(e) => setEditData('priority_level_id', e.target.value)}
                                    required
                                >
                                    <option value="" disabled>Select a category...</option>
                                    {priorities.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>

                                <button
                                    type="button"
                                    onClick={openManagePriorities}
                                    className="whitespace-nowrap rounded-md bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                                >
                                    Manage Categories
                                </button>
                            </div>
                            <InputError message={editErrors.priority || editErrors.priority_level_id} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel value="Target Branches" />
                            <div className="mt-2 flex flex-wrap gap-4 rounded-md border bg-gray-50 p-3">
                                {branches.map(branch => (
                                    <label key={branch.id} className="flex cursor-pointer items-center space-x-2">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 shadow-sm focus:ring-indigo-500"
                                            checked={editData.branch_ids.includes(branch.id)}
                                            onChange={() => handleBranchToggle(branch.id, editData.branch_ids, setEditData)}
                                        />
                                        <span className="text-sm text-gray-700">{branch.name}</span>
                                    </label>
                                ))}
                            </div>
                            <InputError message={editErrors.branch_ids} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel htmlFor="edit_content" value="Announcement Details" />
                            <textarea
                                id="edit_content"
                                rows="4"
                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                                value={editData.content}
                                onChange={(e) => setEditData('content', e.target.value)}
                                required
                            />
                            <InputError message={editErrors.content} className="mt-2" />
                        </div>

                        <div className="md:col-span-2">
                            {renderImageCropper(
                                'edit',
                                editData,
                                setEditData,
                                editImagePreview,
                                editCropState,
                                setEditCropState,
                                editingItem,
                                editErrors.image
                            )}
                        </div>

                        <div className="md:col-span-2">
                            <InputLabel value="File Attachment (PDF, Excel, Word)" />
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-green-50 file:px-4 file:py-2 file:text-green-700 hover:file:bg-green-100"
                                onChange={(e) => setEditData('attachment', e.target.files[0])}
                            />
                            <InputError message={editErrors.attachment} className="mt-2" />
                        </div>
                    </div>

                    <div className="mt-8 border-t pt-4 mb-4">
                        <h3 className="text-lg font-bold text-gray-800 mb-2">Manage Comments</h3>
                        <AnnouncementComments announcement={editData} />
                    </div>

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeEditModal}>Cancel</SecondaryButton>
                        <PrimaryButton className="ms-3" disabled={editProcessing}>
                            Update Announcement
                        </PrimaryButton>
                    </div>
                </form>
            </Modal>

            {/* NEW: Manage Priorities CRUD Modal */}
            <Modal show={isManagePrioritiesModalOpen} onClose={closeManagePriorities} maxWidth="md">
                <div className="p-6">
                    <h2 className="mb-4 text-lg font-medium text-gray-900">Manage Categories</h2>

                    {/* List of existing priorities */}
                    <div className="mb-6 space-y-2 max-h-60 overflow-y-auto pr-2">
                        {priorities.map((p) => (
                            <div key={p.id} className="flex items-center justify-between rounded-md border p-3">
                                {editingPriorityId === p.id ? (
                                    <form onSubmit={submitSavePriority} className="flex w-full items-center gap-2">
                                        <TextInput
                                            className="block w-full text-sm"
                                            value={priorityData.name}
                                            onChange={(e) => setPriorityData('name', e.target.value)}
                                            required
                                        />
                                        <input
                                            type="color"
                                            className="h-8 w-12 cursor-pointer rounded-md border-gray-300 p-0 shadow-sm"
                                            value={priorityData.color}
                                            onChange={(e) => setPriorityData('color', e.target.value)}
                                            required
                                        />
                                        <button type="submit" className="text-sm font-semibold text-indigo-600 hover:text-indigo-800">Save</button>
                                        <button type="button" onClick={cancelEditPriority} className="text-sm font-semibold text-gray-500 hover:text-gray-700">Cancel</button>
                                    </form>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-3">
                                            <div className="h-4 w-4 rounded-full" style={{ backgroundColor: p.color }}></div>
                                            <span className="text-sm font-medium text-gray-800">{p.name}</span>
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="button" onClick={() => startEditPriority(p)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
                                            <button type="button" onClick={() => confirmDeletePriority(p)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        {priorities.length === 0 && <p className="text-sm text-gray-500 text-center">No priorities found.</p>}
                    </div>

                    {/* Add New Priority Form */}
                    {!editingPriorityId && (
                        <form onSubmit={submitSavePriority} className="mt-4 rounded-md bg-gray-50 p-4 border">
                            <h3 className="mb-3 text-sm font-medium text-gray-700">Add New Category</h3>
                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <TextInput
                                        className="block w-full text-sm"
                                        placeholder="Category Name (e.g. Urgent)"
                                        value={priorityData.name}
                                        onChange={(e) => setPriorityData('name', e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <input
                                        type="color"
                                        className="block h-10 w-12 cursor-pointer rounded-md border-gray-300 p-1 shadow-sm"
                                        value={priorityData.color}
                                        onChange={(e) => setPriorityData('color', e.target.value)}
                                        required
                                    />
                                </div>
                                <PrimaryButton disabled={priorityProcessing} className="px-4 py-2">Add</PrimaryButton>
                            </div>
                        </form>
                    )}

                    <div className="mt-6 flex justify-end">
                        <SecondaryButton onClick={closeManagePriorities}>Close</SecondaryButton>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                show={confirmDialog.isOpen}
                onClose={closeConfirmModal}
                title={confirmDialog.title}
                message={confirmDialog.message}
                confirmText={confirmDialog.confirmText}
                confirmColor={confirmDialog.confirmColor}
                onConfirm={confirmDialog.onConfirm}
            />
        </SidebarLayout>
    );
}