import React, { useState } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

export default function AssetsAccountabilityModal({ show, onClose, asset, users = [], onSubmit }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [search, setSearch] = useState('');

    const form = useForm({
        type: asset?.accountability_type === 'shared' ? 'shared' : 'personal',
        user_ids: asset?.accountableUsers?.map(u => u.id) || [],
        team_leader_id: asset?.accountableUsers?.find(u => u.pivot?.is_team_leader)?.id || null,
    });

    const filteredUsers = users.filter(u =>
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.position?.name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleSubmit = (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        form.post(route('.assets.accountability', asset.id), {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmitting(false);
                onSubmit?.();
                onClose();
            },
            onError: (errors) => {
                setIsSubmitting(false);
            },
        });
    };

    const toggleUser = (userId) => {
        const currentIds = form.data.user_ids || [];
        const newIds = currentIds.includes(userId)
            ? currentIds.filter(id => id !== userId)
            : [...currentIds, userId];
        form.setData('user_ids', newIds);
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={handleSubmit}>
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Asset Accountability</h2>
                        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Accountability Type</label>
                            <div className="space-y-2">
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="type"
                                        checked={form.data.type === 'personal'}
                                        onChange={() => form.setData('type', 'personal')}
                                        className="mr-2"
                                    />
                                    <span>Personal (One accountable person)</span>
                                </label>
                                <label className="flex items-center">
                                    <input
                                        type="radio"
                                        name="type"
                                        checked={form.data.type === 'shared'}
                                        onChange={() => form.setData('type', 'shared')}
                                        className="mr-2"
                                    />
                                    <span>Shared (Multiple accountable users)</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Team Leader
                            </label>
                            <select
                                value={form.data.team_leader_id || ''}
                                onChange={e => form.setData('team_leader_id', e.target.value || null)}
                                className="w-full rounded-md border-gray-300"
                            >
                                <option value="">No team leader</option>
                                {filteredUsers.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name} - {user.position?.name || 'No Position'}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Accountable Users</label>
                            <TextInput
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="mb-2"
                                placeholder="Search by name or position..."
                            />
                            <div className="border rounded-md max-h-60 overflow-y-auto">
                                {filteredUsers.length === 0 ? (
                                    <p className="text-gray-500 p-4">No users found.</p>
                                ) : (
                                    filteredUsers.map(user => (
                                        <label key={user.id} className="flex items-center p-3 border-b hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={form.data.user_ids?.includes(user.id) || false}
                                                onChange={() => toggleUser(user.id)}
                                                className="mr-3"
                                            />
                                            <span className="text-sm">
                                                {user.name} - {user.position?.name || 'No Position'}
                                                {user.department && ` (${user.department.name})`}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="text-xs text-gray-500">
                            <p><strong>Personal:</strong> One person accountable for the asset.</p>
                            <p><strong>Shared:</strong> Multiple users accountable, with one designated as team leader.</p>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
                        <PrimaryButton disabled={isSubmitting || form.processing}>
                            {isSubmitting || form.processing ? 'Saving...' : 'Save Accountability'}
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </Modal>
    );
}