import ConfirmModal from '@/Components/ConfirmModal';
import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';
import { getAdminLinks, canEditModule, canDeleteModule } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, router, useForm } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';

export default function CompanyContent({ auth, contents = [], contentTypes = [] }) {
    const adminLinks = getAdminLinks(auth);
    const canManageContent = canEditModule(auth, 'company_content');
    const canDeleteContent = canDeleteModule(auth, 'company_content');

    const FRAME_RATIO_CLASS = 'aspect-[16/9] w-full';
    const DEFAULT_ZOOM = 1;
    const MIN_ZOOM = 0.3;
    const MAX_ZOOM = 4;
    const ZOOM_STEP = 0.1;

    const normalizedTypeOptions = useMemo(() => {
        return (contentTypes || [])
            .map((type) => {
                if (typeof type === 'string') {
                    return { id: type, name: type };
                }

                return {
                    id: type?.id ?? type?.name,
                    name: typeof type?.name === 'string' ? type.name.trim() : '',
                };
            })
            .filter((type) => type.name)
            .reduce((acc, current) => {
                if (!acc.some((item) => item.name.toLowerCase() === current.name.toLowerCase())) {
                    acc.push(current);
                }
                return acc;
            }, []);
    }, [contentTypes]);

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        title: '',
        message: '',
        confirmText: '',
        confirmColor: '',
        onConfirm: () => {},
    });

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const [isTypeOverlayOpen, setIsTypeOverlayOpen] = useState(false);
    const [typeOverlayMode, setTypeOverlayMode] = useState('create');
    const [typeModalTarget, setTypeModalTarget] = useState('add');
    const [editingId, setEditingId] = useState(null);
    const [editingTypeId, setEditingTypeId] = useState(null);
    const [editingItem, setEditingItem] = useState(null);

    const addEditorRef = useRef(null);
    const editEditorRef = useRef(null);

    const [addImagePreview, setAddImagePreview] = useState(null);
    const [editImagePreview, setEditImagePreview] = useState(null);

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

    const {
        data: addData,
        setData: setAddData,
        post: postContent,
        processing: addProcessing,
        errors: addErrors,
        clearErrors: clearAddErrors,
        reset: resetAdd,
    } = useForm({
        type: '',
        title: '',
        content: '',
        content_html: '',
        image: null,
        image_zoom: DEFAULT_ZOOM,
        image_offset_x: 0,
        image_offset_y: 0,
    });

    const {
        data: editData,
        setData: setEditData,
        post: updateContent,
        processing: editProcessing,
        errors: editErrors,
        clearErrors: clearEditErrors,
        reset: resetEdit,
    } = useForm({
        _method: 'put',
        type: '',
        title: '',
        content: '',
        content_html: '',
        image: null,
        image_zoom: DEFAULT_ZOOM,
        image_offset_x: 0,
        image_offset_y: 0,
    });

    const {
        data: typeCreateData,
        setData: setTypeCreateData,
        post: postType,
        processing: typeCreateProcessing,
        reset: resetTypeCreate,
        clearErrors: clearTypeCreateErrors,
        errors: typeCreateErrors,
    } = useForm({
        name: '',
    });

    const {
        data: typeEditData,
        setData: setTypeEditData,
        post: updateType,
        processing: typeEditProcessing,
        reset: resetTypeEdit,
        clearErrors: clearTypeEditErrors,
        errors: typeEditErrors,
    } = useForm({
        _method: 'put',
        name: '',
    });

    useEffect(() => {
        if (normalizedTypeOptions.length === 0) return;

        if (isAddModalOpen && !addData.type) {
            setAddData('type', normalizedTypeOptions[0].name);
        }
    }, [normalizedTypeOptions, isAddModalOpen]);

    useEffect(() => {
        if (!addData.image) {
            setAddImagePreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(addData.image);
        setAddImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [addData.image]);

    useEffect(() => {
        if (!editData.image) {
            setEditImagePreview(null);
            return;
        }

        const objectUrl = URL.createObjectURL(editData.image);
        setEditImagePreview(objectUrl);

        return () => URL.revokeObjectURL(objectUrl);
    }, [editData.image]);

    const getImageSource = (item, previewImage) => {
        if (previewImage) return previewImage;
        if (item?.image_path) return `/storage/${item.image_path}`;
        return null;
    };

    const forceEditorLTR = (editorRef) => {
        if (!editorRef.current) return;

        editorRef.current.setAttribute('dir', 'ltr');
        editorRef.current.style.direction = 'ltr';
        editorRef.current.style.textAlign = 'left';
        editorRef.current.style.unicodeBidi = 'plaintext';
        editorRef.current.style.whiteSpace = 'pre-wrap';
        editorRef.current.style.wordBreak = 'break-word';
    };

    const syncEditorToForm = (editorRef, setDataFn) => {
        if (!editorRef.current) return;

        const html = editorRef.current.innerHTML;
        const plain = editorRef.current.innerText;

        setDataFn('content_html', html);
        setDataFn('content', plain);
    };

    const setEditorHtml = (editorRef, html) => {
        if (!editorRef.current) return;

        editorRef.current.innerHTML = html || '';
        forceEditorLTR(editorRef);
    };

    const runEditorCommand = (editorRef, setDataFn, command, value = null) => {
        if (!editorRef.current) return;

        editorRef.current.focus();
        forceEditorLTR(editorRef);
        document.execCommand(command, false, value);
        syncEditorToForm(editorRef, setDataFn);
    };

    const handleEditorKeyDown = (e, editorRef, setDataFn) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (!isMod) return;

        const key = e.key.toLowerCase();

        if (key === 'b') {
            e.preventDefault();
            runEditorCommand(editorRef, setDataFn, 'bold');
            return;
        }

        if (key === 'i') {
            e.preventDefault();
            runEditorCommand(editorRef, setDataFn, 'italic');
            return;
        }

        if (key === 'u') {
            e.preventDefault();
            runEditorCommand(editorRef, setDataFn, 'underline');
            return;
        }
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

    const resetCrop = (setDataFn) => {
        setDataFn('image_zoom', DEFAULT_ZOOM);
        setDataFn('image_offset_x', 0);
        setDataFn('image_offset_y', 0);
    };

    const zoomImageIn = (data, setDataFn) => {
        const nextZoom = Math.min(MAX_ZOOM, (data.image_zoom || DEFAULT_ZOOM) + ZOOM_STEP);
        setDataFn('image_zoom', Number(nextZoom.toFixed(2)));
    };

    const zoomImageOut = (data, setDataFn) => {
        const nextZoom = Math.max(MIN_ZOOM, (data.image_zoom || DEFAULT_ZOOM) - ZOOM_STEP);
        setDataFn('image_zoom', Number(nextZoom.toFixed(2)));
    };

    const closeConfirmModal = () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    };

    const confirmDeleteContent = (content) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Content',
            message: `Are you sure you want to delete this ${content.type}? \n\nThe text and its image will be permanently removed.`,
            confirmText: 'Delete',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.company-content.destroy', [content.id]), {
                    preserveScroll: true,
                    onSuccess: () => closeConfirmModal(),
                });
            },
        });
    };

    const confirmDeleteType = (typeItem) => {
        setConfirmDialog({
            isOpen: true,
            title: 'Delete Content Type',
            message: `Are you sure you want to delete the content type "${typeItem.name}"?\n\nExisting content using this type may be affected.`,
            confirmText: 'Delete',
            confirmColor: 'bg-red-600 hover:bg-red-500',
            onConfirm: () => {
                router.delete(route('admin.company-content.type.destroy', [typeItem.id]), {
                    preserveScroll: true,
                    onSuccess: () => {
                        closeConfirmModal();

                        if (addData.type === typeItem.name) {
                            setAddData('type', '');
                        }

                        if (editData.type === typeItem.name) {
                            setEditData('type', '');
                        }
                    },
                });
            },
        });
    };

    const openAddModal = () => {
        clearAddErrors();
        setIsAddModalOpen(true);

        setTimeout(() => {
            setEditorHtml(addEditorRef, addData.content_html || '');
        }, 0);
    };

    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setIsTypeOverlayOpen(false);
        setTypeOverlayMode('create');
        setTypeModalTarget('add');
        clearAddErrors();
        clearTypeCreateErrors();
        clearTypeEditErrors();
        resetAdd();
        resetTypeCreate();
        resetTypeEdit();
        setEditingTypeId(null);
        setAddImagePreview(null);
        setAddCropState({
            dragging: false,
            startX: 0,
            startY: 0,
            originX: 0,
            originY: 0,
        });

        if (addEditorRef.current) {
            addEditorRef.current.innerHTML = '';
        }
    };

    const submitAdd = (e) => {
        e.preventDefault();
        syncEditorToForm(addEditorRef, setAddData);

        postContent(route('admin.company-content.store'), {
            preserveScroll: true,
            onSuccess: () => closeAddModal(),
        });
    };

    const openEditModal = (contentItem) => {
        setEditingId(contentItem.id);
        setEditingItem(contentItem);

        setEditData({
            _method: 'put',
            type: contentItem.type || '',
            title: contentItem.title || '',
            content: contentItem.content || '',
            content_html: contentItem.content_html || contentItem.content || '',
            image: null,
            image_zoom: contentItem.image_zoom ?? DEFAULT_ZOOM,
            image_offset_x: contentItem.image_offset_x ?? 0,
            image_offset_y: contentItem.image_offset_y ?? 0,
        });

        clearEditErrors();
        setIsEditModalOpen(true);

        setTimeout(() => {
            setEditorHtml(editEditorRef, contentItem.content_html || contentItem.content || '');
        }, 0);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setIsTypeOverlayOpen(false);
        setTypeOverlayMode('create');
        setTypeModalTarget('add');
        clearEditErrors();
        clearTypeCreateErrors();
        clearTypeEditErrors();
        resetEdit();
        resetTypeCreate();
        resetTypeEdit();
        setEditingId(null);
        setEditingTypeId(null);
        setEditingItem(null);
        setEditImagePreview(null);
        setEditCropState({
            dragging: false,
            startX: 0,
            startY: 0,
            originX: 0,
            originY: 0,
        });

        if (editEditorRef.current) {
            editEditorRef.current.innerHTML = '';
        }
    };

    const submitEdit = (e) => {
        e.preventDefault();
        syncEditorToForm(editEditorRef, setEditData);

        updateContent(route('admin.company-content.update', [editingId]), {
            preserveScroll: true,
            onSuccess: () => closeEditModal(),
        });
    };

    const openCreateTypeOverlay = (target = 'add') => {
        setTypeModalTarget(target);
        setTypeOverlayMode('create');
        setEditingTypeId(null);
        clearTypeCreateErrors();
        clearTypeEditErrors();
        resetTypeCreate();
        resetTypeEdit();
        setIsTypeOverlayOpen(true);
    };

    const openManageTypesOverlay = (target = 'add') => {
        setTypeModalTarget(target);
        setTypeOverlayMode('manage');
        setEditingTypeId(null);
        clearTypeCreateErrors();
        clearTypeEditErrors();
        resetTypeCreate();
        resetTypeEdit();
        setIsTypeOverlayOpen(true);
    };

    const openEditTypeOverlay = (typeItem, target = 'manage') => {
        setTypeModalTarget(target);
        setTypeOverlayMode('edit');
        setEditingTypeId(typeItem.id);
        clearTypeCreateErrors();
        clearTypeEditErrors();
        setTypeEditData({
            _method: 'put',
            name: typeItem.name,
        });
        setIsTypeOverlayOpen(true);
    };

    const closeTypeOverlay = () => {
        setIsTypeOverlayOpen(false);
        setTypeOverlayMode('create');
        setTypeModalTarget('add');
        setEditingTypeId(null);
        clearTypeCreateErrors();
        clearTypeEditErrors();
        resetTypeCreate();
        resetTypeEdit();
    };

    const applyTypeToTargetForm = (typeName) => {
        if (typeModalTarget === 'edit') {
            setEditData('type', typeName);
        } else {
            setAddData('type', typeName);
        }
    };

    const submitCreateType = (e) => {
        e.preventDefault();

        const trimmedName = typeCreateData.name.trim();
        setTypeCreateData('name', trimmedName);

        postType(route('admin.company-content.type.store'), {
            preserveScroll: true,
            onSuccess: () => {
                applyTypeToTargetForm(trimmedName);
                closeTypeOverlay();
            },
        });
    };

    const submitEditType = (e) => {
        e.preventDefault();

        const trimmedName = typeEditData.name.trim();
        setTypeEditData('name', trimmedName);

        updateType(route('admin.company-content.type.update', [editingTypeId]), {
            preserveScroll: true,
            onSuccess: () => {
                closeTypeOverlay();

                if (addData.type && normalizedTypeOptions.some((t) => t.id === editingTypeId)) {
                    const currentType = normalizedTypeOptions.find((t) => t.id === editingTypeId);
                    if (currentType && addData.type === currentType.name) {
                        setAddData('type', trimmedName);
                    }
                }

                if (editData.type && normalizedTypeOptions.some((t) => t.id === editingTypeId)) {
                    const currentType = normalizedTypeOptions.find((t) => t.id === editingTypeId);
                    if (currentType && editData.type === currentType.name) {
                        setEditData('type', trimmedName);
                    }
                }
            },
        });
    };

    const renderTypeOverlay = () => {
        if (!isTypeOverlayOpen) return null;

        return (
            <div
                className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4"
                onClick={closeTypeOverlay}
            >
                <div
                    className="w-full max-w-lg rounded-lg bg-white p-6 shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {typeOverlayMode === 'create' && (
                        <>
                            <h2 className="mb-4 text-lg font-medium text-gray-900">
                                Add Custom Content Type
                            </h2>

                            <form onSubmit={submitCreateType}>
                                <div>
                                    <InputLabel
                                        htmlFor="new_type_name"
                                        value="Type Name (e.g. Core Values)"
                                    />
                                    <TextInput
                                        id="new_type_name"
                                        className="mt-1 block w-full"
                                        value={typeCreateData.name}
                                        onChange={(e) => setTypeCreateData('name', e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <InputError message={typeCreateErrors.name} className="mt-2" />
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <SecondaryButton type="button" onClick={closeTypeOverlay}>
                                        Cancel
                                    </SecondaryButton>
                                    <PrimaryButton className="ms-3" disabled={typeCreateProcessing}>
                                        Save Type
                                    </PrimaryButton>
                                </div>
                            </form>
                        </>
                    )}

                    {typeOverlayMode === 'edit' && (
                        <>
                            <h2 className="mb-4 text-lg font-medium text-gray-900">
                                Edit Content Type
                            </h2>

                            <form onSubmit={submitEditType}>
                                <div>
                                    <InputLabel htmlFor="edit_type_name" value="Type Name" />
                                    <TextInput
                                        id="edit_type_name"
                                        className="mt-1 block w-full"
                                        value={typeEditData.name}
                                        onChange={(e) => setTypeEditData('name', e.target.value)}
                                        required
                                        autoFocus
                                    />
                                    <InputError message={typeEditErrors.name} className="mt-2" />
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <SecondaryButton type="button" onClick={closeTypeOverlay}>
                                        Cancel
                                    </SecondaryButton>
                                    <PrimaryButton className="ms-3" disabled={typeEditProcessing}>
                                        Update Type
                                    </PrimaryButton>
                                </div>
                            </form>
                        </>
                    )}

                    {typeOverlayMode === 'manage' && (
                        <>
                            <div className="mb-4 flex items-center justify-between">
                                <h2 className="text-lg font-medium text-gray-900">
                                    Manage Content Types
                                </h2>
                                <button
                                    type="button"
                                    onClick={() => openCreateTypeOverlay(typeModalTarget)}
                                    className="rounded-md bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                                >
                                    + Add Type
                                </button>
                            </div>

                            {normalizedTypeOptions.length === 0 ? (
                                <div className="rounded-md border border-gray-100 bg-gray-50 p-4 text-sm text-gray-500">
                                    No content types found yet.
                                </div>
                            ) : (
                                <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                                    {normalizedTypeOptions.map((typeItem) => (
                                        <div
                                            key={typeItem.id}
                                            className="flex items-center justify-between rounded-md border border-gray-200 px-4 py-3"
                                        >
                                            <span className="text-sm font-medium text-gray-800">
                                                {typeItem.name}
                                            </span>

                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditTypeOverlay(typeItem, typeModalTarget)}
                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                >
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => confirmDeleteType(typeItem)}
                                                    className="text-sm font-medium text-red-600 hover:text-red-800"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-6 flex justify-end">
                                <SecondaryButton type="button" onClick={closeTypeOverlay}>
                                    Close
                                </SecondaryButton>
                            </div>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderTypeControls = (value, onChange, target, errorMessage, selectId) => (
        <div>
            <InputLabel htmlFor={selectId} value="Content Type" />
            <div className="mt-1 flex gap-2">
                <select
                    id={selectId}
                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required
                >
                    <option value="" disabled>
                        Select content type
                    </option>
                    {normalizedTypeOptions.map((typeItem) => (
                        <option key={typeItem.id} value={typeItem.name}>
                            {typeItem.name}
                        </option>
                    ))}
                </select>

                <button
                    type="button"
                    onClick={() => openCreateTypeOverlay(target)}
                    className="whitespace-nowrap rounded-md bg-indigo-100 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-200"
                >
                    + Add Type
                </button>

                <button
                    type="button"
                    onClick={() => openManageTypesOverlay(target)}
                    className="whitespace-nowrap rounded-md bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200"
                >
                    Manage
                </button>
            </div>
            <InputError message={errorMessage} className="mt-2" />
        </div>
    );

    const ToolbarButton = ({ label, onCommand, title }) => (
        <button
            type="button"
            title={title}
            onMouseDown={(e) => {
                e.preventDefault();
                onCommand();
            }}
            className="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
            {label}
        </button>
    );

    const renderRichTextEditor = (id, editorRef, setDataFn, errorMessage) => (
        <div>
            <InputLabel htmlFor={id} value="Content Styling" />

            <div className="mt-1 rounded-lg border border-gray-300 bg-white">
                <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 p-3">
                    <ToolbarButton
                        label={<strong>B</strong>}
                        title="Bold"
                        onCommand={() => runEditorCommand(editorRef, setDataFn, 'bold')}
                    />
                    <ToolbarButton
                        label={<em>I</em>}
                        title="Italic"
                        onCommand={() => runEditorCommand(editorRef, setDataFn, 'italic')}
                    />
                    <ToolbarButton
                        label={<span className="underline">U</span>}
                        title="Underline"
                        onCommand={() => runEditorCommand(editorRef, setDataFn, 'underline')}
                    />
                    <ToolbarButton
                        label={<span className="line-through">ab</span>}
                        title="Strikethrough"
                        onCommand={() => runEditorCommand(editorRef, setDataFn, 'strikeThrough')}
                    />
                    <ToolbarButton
                        label={<span>x<sub>2</sub></span>}
                        title="Subscript"
                        onCommand={() => runEditorCommand(editorRef, setDataFn, 'subscript')}
                    />
                    <ToolbarButton
                        label={<span>x<sup>2</sup></span>}
                        title="Superscript"
                        onCommand={() => runEditorCommand(editorRef, setDataFn, 'superscript')}
                    />
                </div>

                <div
                    id={id}
                    ref={editorRef}
                    contentEditable
                    dir="ltr"
                    suppressContentEditableWarning
                    onInput={() => syncEditorToForm(editorRef, setDataFn)}
                    onKeyDown={(e) => handleEditorKeyDown(e, editorRef, setDataFn)}
                    className="min-h-[220px] w-full px-4 py-3 text-left text-sm text-gray-700 focus:outline-none"
                    style={{
                        direction: 'ltr',
                        unicodeBidi: 'plaintext',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                    }}
                />
            </div>

            <InputError message={errorMessage} className="mt-2" />
        </div>
    );

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
                        value={mode === 'edit' ? 'Replace Image (Leave empty to keep current image)' : 'Upload Image (Optional)'}
                    />
                    <input
                        id={`${mode}_image`}
                        type="file"
                        accept="image/*"
                        className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-indigo-700 hover:file:bg-indigo-100"
                        onChange={(e) => {
                            setDataFn('image', e.target.files[0] || null);
                            setTimeout(() => resetCrop(setDataFn), 0);
                        }}
                    />
                    <InputError message={errorMessage} className="mt-2" />
                </div>

                {imageSrc ? (
                    <>
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium text-gray-700">Image Crop Preview</p>

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

                        <div
                            className={`${FRAME_RATIO_CLASS} relative overflow-hidden rounded-lg border border-gray-200 bg-white`}
                            onMouseMove={(e) => handleCropMove(e, cropState, setDataFn)}
                            onMouseUp={() => stopCropDrag(setCropState)}
                            onMouseLeave={() => stopCropDrag(setCropState)}
                        >
                            <img
                                src={imageSrc}
                                alt="Crop Preview"
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

                        <p className="text-xs text-gray-500">
                            Drag to reposition. Use − and + to zoom.
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
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Company Content Management
                </h2>
            }
        >
            <Head title="Company Content" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    <div className="mb-6 flex items-center justify-between">
                        <p className="text-gray-600">
                            Manage the Mission, Vision, story posts, and company identity content.
                        </p>
                        {canManageContent && (
                            <button
                                type="button"
                                onClick={openAddModal}
                                className="rounded-md bg-gray-800 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white hover:bg-gray-700"
                            >
                                + Add Content
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {contents.length === 0 ? (
                            <div className="col-span-full rounded-lg bg-white p-6 text-center text-gray-500 shadow-sm">
                                No content found. Click &quot;+ Add Content&quot; to create your first company content entry.
                            </div>
                        ) : (
                            contents.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex flex-col overflow-hidden rounded-lg border border-gray-100 bg-white shadow-sm"
                                >
                                    <div className={`${FRAME_RATIO_CLASS} relative overflow-hidden bg-gray-100`}>
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
                                            <div className="flex h-full items-center justify-center text-gray-400 italic">
                                                No Image
                                            </div>
                                        )}

                                        <div className="absolute right-2 top-2 rounded bg-black/60 px-2 py-1 text-xs capitalize text-white">
                                            {item.type}
                                        </div>
                                    </div>

                                    <div className="flex flex-1 flex-col p-4">
                                        <h3 className="mb-2 text-lg font-bold text-gray-900">
                                            {item.title || 'Untitled'}
                                        </h3>

                                        <div
                                            className="mb-4 flex-1 prose prose-sm max-w-none break-words text-gray-600 line-clamp-4"
                                            dangerouslySetInnerHTML={{
                                                __html: item.content_html || item.content || '',
                                            }}
                                        />

                                        <div className="mt-auto flex justify-end gap-3 border-t pt-3">
                                            {canManageContent && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => openEditModal(item)}
                                                        className="text-sm font-medium text-blue-600 hover:text-blue-800"
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => canDeleteContent && confirmDeleteContent(item)}
                                                        disabled={!canDeleteContent}
                                                        className={`text-sm font-medium ${canDeleteContent ? 'text-red-600 hover:text-red-800' : 'text-red-300 cursor-not-allowed'}`}
                                                        title={canDeleteContent ? 'Delete content' : 'Full permission required to delete content'}
                                                    >
                                                        Delete
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <Modal show={isAddModalOpen} onClose={closeAddModal} maxWidth="2xl">
                <div className="relative">
                    <form onSubmit={submitAdd} className="p-6">
                        <h2 className="mb-6 text-lg font-medium text-gray-900">Add New Content</h2>

                        <div className="space-y-5">
                            {renderTypeControls(
                                addData.type,
                                (value) => setAddData('type', value),
                                'add',
                                addErrors.type,
                                'add_type'
                            )}

                            <div>
                                <InputLabel htmlFor="add_title" value="Display Title" />
                                <TextInput
                                    id="add_title"
                                    className="mt-1 block w-full"
                                    value={addData.title}
                                    onChange={(e) => setAddData('title', e.target.value)}
                                    placeholder="e.g. The Cat Clinic and Kiki’s Story"
                                />
                                <InputError message={addErrors.title} className="mt-2" />
                            </div>

                            {renderRichTextEditor(
                                'add_content_editor',
                                addEditorRef,
                                setAddData,
                                addErrors.content || addErrors.content_html
                            )}

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

                        <div className="mt-6 flex justify-end">
                            <SecondaryButton type="button" onClick={closeAddModal}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton className="ms-3" disabled={addProcessing}>
                                Save Content
                            </PrimaryButton>
                        </div>
                    </form>

                    {renderTypeOverlay()}
                </div>
            </Modal>

            <Modal show={isEditModalOpen} onClose={closeEditModal} maxWidth="2xl">
                <div className="relative">
                    <form onSubmit={submitEdit} className="p-6">
                        <h2 className="mb-6 text-lg font-medium text-gray-900">Edit Content</h2>

                        <div className="space-y-5">
                            {renderTypeControls(
                                editData.type,
                                (value) => setEditData('type', value),
                                'edit',
                                editErrors.type,
                                'edit_type'
                            )}

                            <div>
                                <InputLabel htmlFor="edit_title" value="Display Title" />
                                <TextInput
                                    id="edit_title"
                                    className="mt-1 block w-full"
                                    value={editData.title}
                                    onChange={(e) => setEditData('title', e.target.value)}
                                />
                                <InputError message={editErrors.title} className="mt-2" />
                            </div>

                            {renderRichTextEditor(
                                'edit_content_editor',
                                editEditorRef,
                                setEditData,
                                editErrors.content || editErrors.content_html
                            )}

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

                        <div className="mt-6 flex justify-end">
                            <SecondaryButton type="button" onClick={closeEditModal}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton className="ms-3" disabled={editProcessing}>
                                Update Content
                            </PrimaryButton>
                        </div>
                    </form>

                    {renderTypeOverlay()}
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