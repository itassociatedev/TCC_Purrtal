import React, { useEffect, useMemo, useState } from 'react';
import { useForm } from '@inertiajs/react';
import Modal from '@/Components/Modal';
import PrimaryButton from '@/Components/PrimaryButton';
import SecondaryButton from '@/Components/SecondaryButton';
import TextInput from '@/Components/TextInput';

const valueOf = (value) => (value && typeof value === 'object' ? value.name : value) || '';

export default function AssetsAccountabilityModal({ show, onClose, asset, users = [], leaderUserIds = [], onSubmit }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [search, setSearch] = useState('');
    const [showUserList, setShowUserList] = useState(true);
    const [branch, setBranch] = useState(asset?.branch?.name || asset?.branch || '');
    const [department, setDepartment] = useState(asset?.department?.name || asset?.department || '');
    const form = useForm({
        type: asset?.accountability_type === 'shared' ? 'shared' : 'personal',
        user_ids: asset?.accountableUsers?.map(u => Number(u.id)) || (asset?.user_id ? [Number(asset.user_id)] : []),
        team_leader_id: asset?.accountableUsers?.find(u => u.pivot?.is_team_leader)?.id || null,
    });

    useEffect(() => {
        if (!show) return;
        const existing = asset?.accountableUsers?.map(u => Number(u.id)) || (asset?.user_id ? [Number(asset.user_id)] : []);
        form.setData({ type: asset?.accountability_type === 'shared' ? 'shared' : 'personal', user_ids: existing, team_leader_id: asset?.accountableUsers?.find(u => u.pivot?.is_team_leader)?.id || existing[0] || null });
        setBranch(valueOf(asset?.branch)); setDepartment(valueOf(asset?.department)); setSearch(''); setShowUserList(true);
    }, [show, asset?.id]);

    const filteredUsers = useMemo(() => users.filter(user => {
        const text = (user?.name || '') + ' ' + valueOf(user?.position) + ' ' + valueOf(user?.department) + ' ' + valueOf(user?.branch) + ' ' + (user?.branch_name || '');
        return text.toLowerCase().includes(search.toLowerCase());
    }), [users, search]);
    const selectedUsers = useMemo(() => (form.data.user_ids || []).map(id => users.find(user => Number(user.id) === Number(id))).filter(Boolean), [form.data.user_ids, users]);
    const leaderCandidates = useMemo(() => {
        const ids = new Set((leaderUserIds || []).map(Number));
        const candidates = users.filter(user => ids.has(Number(user.id)));
        return candidates.length ? candidates : selectedUsers;
    }, [leaderUserIds, users, selectedUsers]);

    useEffect(() => {
        if (!show || form.data.type !== 'shared' || (!branch && !department)) return;
        const b = branch.toLowerCase(), d = department.toLowerCase();
        const autoSelected = users.filter(user => {
            const userDepartment = valueOf(user?.department).toLowerCase();
            const userBranch = (valueOf(user?.branch) || user?.branch_name || user?.branches?.[0]?.name || '').toLowerCase();
            return (!d || userDepartment === d) && (!b || userBranch === b);
        }).map(user => Number(user.id));
        const merged = [...new Set([...(form.data.user_ids || []), ...autoSelected])];
        if (autoSelected.length && merged.length !== (form.data.user_ids || []).length) form.setData('user_ids', merged);
    }, [show, form.data.type, branch, department, users]);

    const toggleUser = (userId) => {
        const id = Number(userId), currentIds = (form.data.user_ids || []).map(Number);
        if (form.data.type === 'personal') {
            form.setData({ user_ids: currentIds.includes(id) ? [] : [id], team_leader_id: currentIds.includes(id) ? null : id }); return;
        }
        if (currentIds.includes(id) && (Number(form.data.team_leader_id) === id || leaderUserIds.map(Number).includes(id))) return;
        const next = currentIds.includes(id) ? currentIds.filter(value => value !== id) : [...currentIds, id];
        form.setData({ user_ids: next, team_leader_id: Number(form.data.team_leader_id) === id && !next.includes(id) ? null : form.data.team_leader_id });
    };
    const clearSelected = () => form.setData('user_ids', form.data.type === 'shared' && form.data.team_leader_id ? [Number(form.data.team_leader_id)] : []);
    const handleSubmit = (e) => {
        e.preventDefault(); setIsSubmitting(true);
        form.post(route('admin.assets.accountability', asset.id), { preserveScroll: true, onSuccess: () => { setIsSubmitting(false); onSubmit?.(); onClose(); }, onError: () => setIsSubmitting(false) });
    };

    return <Modal show={show} onClose={onClose} maxWidth="lg">
        <form onSubmit={handleSubmit}><div className="p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4"><div><h2 className="text-xl font-bold text-gray-900">Asset Accountability</h2><p className="text-xs text-gray-500">{asset?.asset_tag || asset?.name}</p></div><SecondaryButton type="button" onClick={onClose}>Close</SecondaryButton></div>
            <div className="space-y-4">
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Accountability Type</label><div className="flex flex-wrap gap-5"><label className="flex items-center gap-2"><input type="radio" checked={form.data.type === 'personal'} onChange={() => form.setData({ type: 'personal', user_ids: (form.data.user_ids || []).slice(0, 1), team_leader_id: null })} />Personal (one employee)</label><label className="flex items-center gap-2"><input type="radio" checked={form.data.type === 'shared'} onChange={() => form.setData('type', 'shared')} />Shared (multiple employees)</label></div></div>
                {form.data.type === 'shared' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs font-bold text-gray-600">Branch for auto-selection</label><TextInput className="w-full mt-1" value={branch} onChange={e => setBranch(e.target.value)} placeholder="Branch" /></div><div><label className="block text-xs font-bold text-gray-600">Department for auto-selection</label><TextInput className="w-full mt-1" value={department} onChange={e => setDepartment(e.target.value)} placeholder="Department" /></div></div>}
                <div><label className="block text-sm font-medium text-gray-700 mb-2">Team Leader</label>{form.data.type === 'personal' ? <p className="text-xs text-gray-500">The selected personal assignee is the accountable employee.</p> : <select value={form.data.team_leader_id || ''} onChange={e => form.setData('team_leader_id', e.target.value || null)} className="w-full rounded-md border-gray-300"><option value="">Select team leader</option>{leaderCandidates.map(user => <option key={user.id} value={user.id}>{user.name} - {valueOf(user.position) || 'No Position'}</option>)}</select>}{form.errors.team_leader_id && <p className="text-xs text-red-600 mt-1">{form.errors.team_leader_id}</p>}</div>
                <div><div className="flex justify-between items-center mb-2"><label className="block text-sm font-medium text-gray-700">Accountable Employees</label><div className="flex gap-2"><button type="button" className="text-xs text-indigo-700 underline" onClick={() => setShowUserList(value => !value)}>{showUserList ? 'Hide list' : 'Show list'}</button><button type="button" className="text-xs text-red-700 underline" onClick={clearSelected}>Clear selected</button></div></div><div className="flex flex-wrap gap-2 mb-2">{selectedUsers.length ? selectedUsers.map(user => <span key={user.id} className="px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs">{user.name}{Number(user.id) === Number(form.data.team_leader_id) ? ' • leader' : ''}</span>) : <span className="text-xs text-gray-500">No employee selected.</span>}</div>{showUserList && <><div className="flex gap-2"><TextInput value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Escape' && setShowUserList(false)} className="flex-1" placeholder="Search by name, position, branch, or department..." /><SecondaryButton type="button" onClick={() => { setSearch(''); setShowUserList(false); }}>Dismiss</SecondaryButton></div><div className="border rounded-md max-h-60 overflow-y-auto mt-2">{filteredUsers.length === 0 ? <p className="text-gray-500 p-4 text-sm">No employees found.</p> : filteredUsers.map(user => <label key={user.id} className="flex items-center p-3 border-b hover:bg-gray-50"><input type="checkbox" checked={(form.data.user_ids || []).map(Number).includes(Number(user.id))} onChange={() => toggleUser(user.id)} className="mr-3" /><span className="text-sm">{user.name} - {valueOf(user.position) || 'No Position'}{user.department ? ' (' + valueOf(user.department) + ')' : ''}</span></label>)}</div></>}{form.errors.user_ids && <p className="text-xs text-red-600 mt-1">{form.errors.user_ids}</p>}</div>
            </div>
            <div className="mt-6 flex justify-end gap-3"><SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton><PrimaryButton disabled={isSubmitting || form.processing}>{isSubmitting || form.processing ? 'Saving...' : 'Save Accountability'}</PrimaryButton></div>
        </div></form>
    </Modal>;
}
