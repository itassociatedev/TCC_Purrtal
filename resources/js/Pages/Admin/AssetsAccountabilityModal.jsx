import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

const valueOf = value => (value && typeof value === 'object' ? value.name : value) || '';
const normalize = value => String(value ?? '').trim().toLowerCase();
const leaderPriority = user => {
    const position = normalize(valueOf(user?.position));
    if (/team leader|\btl\b/.test(position)) return 0;
    if (/supervisor/.test(position)) return 1;
    if (/manager|\bhead\b/.test(position)) return 2;
    return 3;
};
const preferredLeader = users => [...users].sort((a, b) => leaderPriority(a) - leaderPriority(b))[0];

const userBranches = user => [
    valueOf(user?.branch),
    user?.branch_name,
    ...(Array.isArray(user?.branches) ? user.branches.map(valueOf) : []),
].map(normalize).filter(Boolean);

const matchesTeam = (user, branch, department) => {
    const branchName = normalize(branch);
    const departmentName = normalize(department);
    const userDepartment = normalize(valueOf(user?.department));

    return (!departmentName || userDepartment === departmentName)
        && (!branchName || userBranches(user).includes(branchName));
};

const membersForTeam = (users, branch, department) => users.filter(user => matchesTeam(user, branch, department));

export default function AssetsAccountabilityModal({ show, onClose, asset, users = [], leaderUserIds = [], onSubmit }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [showUserList, setShowUserList] = useState(true);
    const [branch, setBranch] = useState(valueOf(asset?.branch));
    const [department, setDepartment] = useState(valueOf(asset?.department));
    const form = useForm({ type: 'personal', user_ids: [], team_leader_id: null });

    useEffect(() => {
        if (!show) return;

        const nextBranch = valueOf(asset?.branch);
        const nextDepartment = valueOf(asset?.department);
        const isShared = asset?.accountability_type === 'shared';
        const existingIds = asset?.accountableUsers?.map(user => Number(user.id))
            || (asset?.user_id ? [Number(asset.user_id)] : []);
        const hasTeamScope = Boolean(normalize(nextBranch) || normalize(nextDepartment));
        const scopedUsers = hasTeamScope
            ? membersForTeam(users, nextBranch, nextDepartment)
            : users.filter(user => existingIds.includes(Number(user.id)));
        const scopedIds = scopedUsers.map(user => Number(user.id));
        const userIds = isShared
            ? [...new Set([...scopedIds, ...existingIds.filter(id => scopedIds.includes(id))])]
            : existingIds;
        const leaderIds = new Set(leaderUserIds.map(Number));
        const orgLeader = preferredLeader(scopedUsers.filter(user => leaderIds.has(Number(user.id))));
        const existingLeader = asset?.accountableUsers?.find(user => user.pivot?.is_team_leader);
        const leaderId = isShared
            ? (existingLeader && leaderIds.has(Number(existingLeader.id)) && userIds.includes(Number(existingLeader.id))
                ? Number(existingLeader.id)
                : Number(orgLeader?.id || '') || null)
            : (Number(existingLeader?.id || userIds[0] || '') || null);

        form.setData({ type: isShared ? 'shared' : 'personal', user_ids: userIds, team_leader_id: leaderId });
        setBranch(nextBranch);
        setDepartment(nextDepartment);
        setSearch('');
        setShowUserList(true);
    }, [show, asset?.id]);

    const selectedUsers = useMemo(
        () => (form.data.user_ids || []).map(id => users.find(user => Number(user.id) === Number(id))).filter(Boolean),
        [form.data.user_ids, users],
    );

    const leaderCandidates = useMemo(() => {
        const scopedUsers = selectedUsers.filter(user => matchesTeam(user, branch, department));
        const selectedLeaders = scopedUsers.filter(user => leaderUserIds.map(Number).includes(Number(user.id)));
        const candidates = selectedLeaders.length ? selectedLeaders : scopedUsers;
        return [...candidates].sort((a, b) => leaderPriority(a) - leaderPriority(b));
    }, [branch, department, leaderUserIds, selectedUsers]);

    const filteredUsers = useMemo(() => users.filter(user => {
        const text = `${user?.name || ''} ${valueOf(user?.position)} ${valueOf(user?.department)} ${userBranches(user).join(' ')}`;
        return text.toLowerCase().includes(search.toLowerCase());
    }), [users, search]);

    const replaceWithScopedTeam = (nextBranch = branch, nextDepartment = department) => {
        const hasTeamScope = Boolean(normalize(nextBranch) || normalize(nextDepartment));
        if (!hasTeamScope) {
            const selected = (form.data.user_ids || []).map(Number);
            form.setData({
                ...form.data,
                type: 'shared',
                team_leader_id: selected.includes(Number(form.data.team_leader_id)) ? form.data.team_leader_id : null,
            });
            return;
        }

        const team = membersForTeam(users, nextBranch, nextDepartment);
        const leaderIds = new Set(leaderUserIds.map(Number));
        const scopedLeader = preferredLeader(team.filter(user => leaderIds.has(Number(user.id))));
        const ids = team.map(user => Number(user.id));

        form.setData({
            ...form.data,
            type: 'shared',
            user_ids: ids,
            team_leader_id: Number(scopedLeader?.id || '') || null,
        });
    };

    const toggleUser = userId => {
        const id = Number(userId);
        const currentIds = (form.data.user_ids || []).map(Number);
        if (form.data.type === 'personal') {
            const selected = currentIds.includes(id) ? [] : [id];
            form.setData({ user_ids: selected, team_leader_id: selected[0] || null });
            return;
        }

        const nextIds = currentIds.includes(id)
            ? currentIds.filter(value => value !== id)
            : [...currentIds, id];
        form.setData({
            user_ids: nextIds,
            team_leader_id: Number(form.data.team_leader_id) === id && !nextIds.includes(id)
                ? null
                : form.data.team_leader_id,
        });
    };

    const handleSubmit = event => {
        event.preventDefault();
        setIsSubmitting(true);
        form.post(route('admin.assets.accountability', asset.id), {
            preserveScroll: true,
            onSuccess: () => {
                setIsSubmitting(false);
                onSubmit?.();
                onClose();
            },
            onError: () => setIsSubmitting(false),
        });
    };

    return (
        <Modal show={show} onClose={onClose} maxWidth="lg">
            <form onSubmit={handleSubmit}>
                <div className="max-h-[90vh] overflow-y-auto p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Asset Accountability</h2>
                            <p className="text-xs text-gray-500">{asset?.asset_tag || asset?.name}</p>
                        </div>
                        <SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Accountability Type</label>
                            <div className="flex flex-wrap gap-5">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={form.data.type === 'personal'}
                                        onChange={() => {
                                            const selected = Number(form.data.team_leader_id || form.data.user_ids?.[0] || '') || null;
                                            form.setData({ type: 'personal', user_ids: selected ? [selected] : [], team_leader_id: selected });
                                        }}
                                    />
                                    Personal (one employee)
                                </label>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="radio"
                                        checked={form.data.type === 'shared'}
                                        onChange={() => replaceWithScopedTeam()}
                                    />
                                    Shared (multiple employees)
                                </label>
                            </div>
                        </div>

                        {form.data.type === 'shared' && (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600">Branch for auto-selection</label>
                                    <TextInput
                                        className="mt-1 w-full"
                                        value={branch}
                                        onChange={event => setBranch(event.target.value)}
                                        onBlur={() => replaceWithScopedTeam(branch, department)}
                                        placeholder="Branch"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600">Department for auto-selection</label>
                                    <TextInput
                                        className="mt-1 w-full"
                                        value={department}
                                        onChange={event => setDepartment(event.target.value)}
                                        onBlur={() => replaceWithScopedTeam(branch, department)}
                                        placeholder="Department"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 sm:col-span-2">Changing the branch or department replaces the selected team with matching employees.</p>
                            </div>
                        )}

                        <div>
                            <label className="mb-2 block text-sm font-medium text-gray-700">Team Leader</label>
                            {form.data.type === 'personal' ? (
                                <p className="text-xs text-gray-500">The selected personal assignee is the accountable employee.</p>
                            ) : (
                                <select
                                    value={form.data.team_leader_id || ''}
                                    onChange={event => form.setData('team_leader_id', event.target.value || null)}
                                    className="w-full rounded-md border-gray-300"
                                >
                                    <option value="">Select team leader</option>
                                    {leaderCandidates.map(user => (
                                        <option key={user.id} value={user.id}>{user.name} - {valueOf(user.position) || 'No Position'}</option>
                                    ))}
                                </select>
                            )}
                            {form.errors.team_leader_id && <p className="mt-1 text-xs text-red-600">{form.errors.team_leader_id}</p>}
                        </div>

                        <div>
                            <div className="mb-2 flex items-center justify-between">
                                <label className="block text-sm font-medium text-gray-700">Accountable Employees</label>
                                <div className="flex gap-2">
                                    <button type="button" className="text-xs text-indigo-700 underline" onClick={() => setShowUserList(value => !value)}>
                                        {showUserList ? 'Hide list' : 'Show list'}
                                    </button>
                                    <button
                                        type="button"
                                        className="text-xs text-red-700 underline"
                                        onClick={() => form.setData({ user_ids: [], team_leader_id: null })}
                                    >
                                        Clear selected
                                    </button>
                                </div>
                            </div>
                            <div className="mb-2 flex flex-wrap gap-2">
                                {selectedUsers.length ? selectedUsers.map(user => (
                                    <span key={user.id} className="rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700">
                                        {user.name}{Number(user.id) === Number(form.data.team_leader_id) ? ' • leader' : ''}
                                    </span>
                                )) : <span className="text-xs text-gray-500">No employee selected.</span>}
                            </div>

                            {showUserList && (
                                <>
                                    <div className="flex gap-2">
                                        <TextInput
                                            value={search}
                                            onChange={event => setSearch(event.target.value)}
                                            onKeyDown={event => event.key === 'Escape' && setShowUserList(false)}
                                            className="flex-1"
                                            placeholder="Search by name, position, branch, or department..."
                                        />
                                        <SecondaryButton type="button" onClick={() => { setSearch(''); setShowUserList(false); }}>Dismiss</SecondaryButton>
                                    </div>
                                    <div className="mt-2 max-h-60 overflow-y-auto rounded-md border">
                                        {filteredUsers.length === 0 ? (
                                            <p className="p-4 text-sm text-gray-500">No employees found.</p>
                                        ) : filteredUsers.map(user => (
                                            <label key={user.id} className="flex items-center border-b p-3 hover:bg-gray-50">
                                                <input
                                                    type="checkbox"
                                                    checked={(form.data.user_ids || []).map(Number).includes(Number(user.id))}
                                                    onChange={() => toggleUser(user.id)}
                                                    className="mr-3"
                                                />
                                                <span className="text-sm">
                                                    {user.name} - {valueOf(user.position) || 'No Position'}
                                                    {user.department ? ` (${valueOf(user.department)})` : ''}
                                                </span>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                            {form.errors.user_ids && <p className="mt-1 text-xs text-red-600">{form.errors.user_ids}</p>}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton>
                        <PrimaryButton disabled={isSubmitting || form.processing}>
                            {isSubmitting || form.processing ? 'Saving...' : 'Save Accountability'}
                        </PrimaryButton>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
