import { usePage, useForm } from '@inertiajs/react';
import { useState } from 'react';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';

export default function UpdateProfileInformation({ className = '' }) {
    // Grab the authenticated user from Inertia props
    const user = usePage().props.auth.user;

    // Safely extract relationships (falling back to 'Unassigned' if missing)
    const departmentName = user.department?.name || 'Unassigned';
    const positionName = user.position?.name || 'Unassigned';
    
    // Handle branches (if they have multiple in a pivot table, or a single branch_id)
    const branchNames = user.branches && user.branches.length > 0
        ? user.branches.map(b => b.name).join(', ')
        : (user.branch?.name || 'Unassigned');

    const form = useForm({
        name: user.name || '',
        email: user.email || '',
        image: null,
    });

    const [preview, setPreview] = useState(user.image_path ? `/storage/${user.image_path}` : null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        form.setData('image', file);
        if (file) {
            setPreview(URL.createObjectURL(file));
        } else {
            setPreview(user.image_path ? `/storage/${user.image_path}` : null);
        }
    };

    const submit = (e) => {
        e.preventDefault();
        form.patch(route('profile.update'), {
            forceFormData: true,
            onSuccess: () => {
                form.reset('image');
            }
        });
    };

    return (
     <section className="w-full">
    <header className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Profile Information</h2>
        <p className="mt-1 text-sm text-gray-600">
            Your current account details, department, and branch assignments.
        </p>
    </header>

    {/* Using w-full with no max-w limits so it fills the parent container perfectly */}
            <form onSubmit={submit} encType="multipart/form-data" className="w-full bg-white p-5 sm:p-8 shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
        
        {/* Responsive grid: 1 column on mobile, 2 columns on tablet/desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            
            <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                    Full Name
                </span>
                <TextInput value={form.data.name} onChange={e => form.setData('name', e.target.value)} className="mt-1" />
                <InputError message={form.errors.name} className="mt-1" />
            </div>

            <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                    Email Address
                </span>
                <TextInput value={form.data.email} onChange={e => form.setData('email', e.target.value)} className="mt-1" />
                <InputError message={form.errors.email} className="mt-1" />
            </div>

            <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                    Department
                </span>
                <span className="mt-1 text-base font-medium text-gray-900 break-words">
                    {user.department?.name || 'N/A'}
                </span>
            </div>

            <div className="flex flex-col">
                <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                    Position
                </span>
                <span className="mt-1 text-base font-medium text-gray-900 break-words">
                    {user.position?.name || 'N/A'}
                </span>
            </div>

            {/* md:col-span-2 forces this row to span across the entire card width on larger screens */}
            <div className="md:col-span-2 pt-6 border-t border-gray-100 flex flex-col">
                <span className="text-[11px] font-bold tracking-wider text-gray-500 uppercase">
                    Assigned Branches
                </span>
                <span className="mt-2 text-base font-medium text-gray-900 leading-relaxed">
                    {user.branches && user.branches.length > 0 
                        ? user.branches.map(b => b.name).join(', ') 
                        : 'No branches assigned'}
                </span>
            </div>

            {/* Avatar upload row */}
            <div className="md:col-span-2 pt-4 flex items-center gap-4">
                <div className="h-20 w-20 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
                    {preview ? (
                        <img src={preview} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-gray-500 font-bold">{user.name.charAt(0)}</span>
                    )}
                </div>

                <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700">Profile Photo</label>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="mt-2" />
                    <InputError message={form.errors.image} className="mt-1" />
                </div>
            </div>

            <div className="md:col-span-2 pt-6 border-t border-transparent flex justify-end">
                <PrimaryButton disabled={form.processing}>Save</PrimaryButton>
            </div>

            </div>
            </form>
    </section>
    );
}