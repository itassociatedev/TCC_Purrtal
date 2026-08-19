import InputError from '@/Components/InputError';
import InputLabel from '@/Components/InputLabel';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { getHRLinks } from '@/Config/navigation';
import SidebarLayout from '@/Layouts/SidebarLayout';
import { Head, useForm, usePage } from '@inertiajs/react';
import { useEffect } from 'react';
import { canCreateModule, canViewModule, moduleHasAccess } from '@/Config/navigation';

export default function ManpowerRequest({ auth, branches = [], departments = [], positions = [], managers = [] }) {
    const { system } = usePage().props;
    
    const hrLinks = getHRLinks(auth.user.role?.name || 'Employee', auth);
    const canCreateManpowerRequest = canCreateModule(auth, 'manpower_requests_form');
    const canViewManpowerRequestForm = canViewModule(auth, 'manpower_requests_form');

    if (!moduleHasAccess(auth, 'hr')) {
        return (
            <SidebarLayout user={auth.user} activeModule="HR" sidebarLinks={hrLinks}>
                <Head title="Access Denied" />
                <div className="py-12 max-w-4xl mx-auto sm:px-6 lg:px-8">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600">You do not have permission to view this section.</p>
                    </div>
                </div>
            </SidebarLayout>
        );
    }

    const userRole = auth.user.role?.name?.toLowerCase().trim() || '';
    const canSelectAllBranches = userRole === 'admin' || userRole === 'director of corporate services and operations';

    // Auto-calculate the minimum date (30 calendar days notice)
    const thirtyDaysFromNow = new Date(`${system?.serverDate || '1970-01-01'}T00:00:00`);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const minDateNeeded = thirtyDaysFromNow.toISOString().split('T')[0];

    // Initialize all form fields
    const { data, setData, post, processing, errors, reset } = useForm({
        branch_id: '',
        department_id: '',
        position_id: '',
        
        is_budgeted: '1', 
        unbudgeted_purpose: '',
        
        headcount: 1,
        date_needed: '',
        educational_background: '',
        years_experience: '',
        skills_required: '',
        
        employment_status: '',
        reliever_info: '',
        
        purpose: '', 
        is_new_position: '0',
        job_description: '',
        is_replacement: '0',
        replaced_employee_name: '',
        
        poc_name: auth.user.name,
        requesting_manager_id: '',
    });

    // Filter positions dynamically when a department is selected
    const availablePositions = positions.filter(pos => String(pos.department_id) === String(data.department_id));

    // 🟢 1. INTERN ELIGIBILITY LOGIC
    const internEligibleDepartments = [
        'Accounting',
        'Human Resources',
        'Information Technology',
        'Marketing',
        'Procurement',
        'Veterinary Technicians'
    ];

    const selectedDept = departments.find(d => String(d.id) === String(data.department_id));
    const isInternEligible = selectedDept ? internEligibleDepartments.includes(selectedDept.name) : false;

    useEffect(() => {
        // Auto-clear Employment Status if they select "Intern" and switch to an ineligible department
        if (data.employment_status === 'Intern' && !isInternEligible) {
            setData('employment_status', '');
        }
    }, [data.department_id, isInternEligible]);


    // Clear conditional child fields automatically if the parent selection changes
    useEffect(() => { if (data.is_budgeted === '1') setData('unbudgeted_purpose', ''); }, [data.is_budgeted]);
    useEffect(() => { if (data.employment_status !== 'Reliever') setData('reliever_info', ''); }, [data.employment_status]);
    useEffect(() => { if (data.is_new_position === '0') setData('job_description', ''); }, [data.is_new_position]);
    useEffect(() => { if (data.is_replacement === '0') setData('replaced_employee_name', ''); }, [data.is_replacement]);

    const submit = (e) => {
        e.preventDefault();
        if (!canCreateManpowerRequest) {
            return;
        }
        post(route('hr.manpower-requests.store'), {
            preserveScroll: true,
            onSuccess: () => reset(),
        });
    };

    return (
        <SidebarLayout user={auth.user} activeModule="HR" sidebarLinks={hrLinks}>
            <Head title="Manpower Request" />

            <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
                
                {/* Page Header */}
                <div className="mb-8">
                    <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Manpower Request Form</h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Submit a formal request for new personnel. Once submitted, this will be routed to your Manager, then HR, and finally the Director for approval.
                    </p>
                    {!canCreateManpowerRequest && canViewManpowerRequestForm && (
                        <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
                            You currently have read-only access to the Manpower Request Form. You may view the fields and available options, but you cannot submit a new request.
                        </div>
                    )}
                </div>

                <form onSubmit={submit} className="space-y-6">
                    <fieldset disabled={!canCreateManpowerRequest} className={!canCreateManpowerRequest ? 'opacity-80' : ''}>
                    {/* SECTION 1: ROLE & BUDGET */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">1. Role & Placement</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            {/* Branch */}
                            <div>
                                <InputLabel htmlFor="branch_id" value="Target Branch" />
                                <select 
                                    id="branch_id" 
                                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500" 
                                    value={data.branch_id} 
                                    onChange={e => setData('branch_id', e.target.value)}
                                >
                                    <option value="">Select Branch...</option>
                                    
                                    {/* 🟢 2. ADDED "ALL BRANCH" OPTION HERE */}
                                    {canSelectAllBranches && (
                                        <option value="all">All Branches</option> 
                                    )} 

                                    {branches && branches.length > 0 ? (
                                        branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)
                                    ) : (
                                        <option value="" disabled>No branches found in database</option>
                                    )}
                                </select>
                                <InputError message={errors.branch_id} className="mt-2" />
                            </div>

                            {/* Department */}
                            <div>
                                <InputLabel htmlFor="department_id" value="Department" />
                                <select id="department_id" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500" value={data.department_id} onChange={e => { setData('department_id', e.target.value); setData('position_id', ''); }}>
                                    <option value="">Select Department...</option>
                                    {departments && departments.length > 0 ? (
                                        departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                    ) : (
                                        <option value="" disabled>No departments found</option>
                                    )}
                                </select>
                                <InputError message={errors.department_id} className="mt-2" />
                            </div>

                            {/* Position */}
                            <div className="md:col-span-2">
                                <InputLabel htmlFor="position_id" value="Position Title" />
                                <select id="position_id" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-gray-100" value={data.position_id} onChange={e => setData('position_id', e.target.value)} disabled={!data.department_id}>
                                    <option value="">{data.department_id ? 'Select Position...' : 'Select Department First'}</option>
                                    {availablePositions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                                <InputError message={errors.position_id} className="mt-2" />
                            </div>

                            {/* Budget Status */}
                            <div className="md:col-span-2 p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <InputLabel value="Is this budgeted / within approved Plantilla?" />
                                <div className="mt-2 flex gap-6 mb-4">
                                    <label className="flex items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={data.is_budgeted === '1'} onChange={() => setData('is_budgeted', '1')} /> <span className="ml-2 text-sm font-medium">Yes</span></label>
                                    <label className="flex items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={data.is_budgeted === '0'} onChange={() => setData('is_budgeted', '0')} /> <span className="ml-2 text-sm font-medium">No</span></label>
                                </div>
                                
                                <InputLabel htmlFor="unbudgeted_purpose" value="If No, explicitly write the purpose:" className={data.is_budgeted === '1' ? 'opacity-50' : ''} />
                                <TextInput className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-400" value={data.unbudgeted_purpose} onChange={e => setData('unbudgeted_purpose', e.target.value)} disabled={data.is_budgeted === '1'} placeholder={data.is_budgeted === '0' ? "Explain why this unbudgeted request is necessary..." : ""} />
                                <InputError message={errors.unbudgeted_purpose} className="mt-2" />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: QUALIFICATIONS */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">2. Candidate Requirements</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                            
                            <div>
                                <InputLabel htmlFor="headcount" value="Headcount Requirement" />
                                <TextInput type="number" min="1" className="mt-1 block w-full" value={data.headcount} onChange={e => setData('headcount', e.target.value)} />
                                <InputError message={errors.headcount} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="date_needed" value="Date Needed (30 Days Minimum)" />
                                <TextInput type="date" min={minDateNeeded} className="mt-1 block w-full" value={data.date_needed} onChange={e => setData('date_needed', e.target.value)} />
                                <InputError message={errors.date_needed} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="educational_background" value="Educational Background" />
                                <TextInput placeholder="e.g. BS Vet Med, High School..." className="mt-1 block w-full" value={data.educational_background} onChange={e => setData('educational_background', e.target.value)} />
                                <InputError message={errors.educational_background} className="mt-2" />
                            </div>

                            <div>
                                <InputLabel htmlFor="years_experience" value="Years of Work Experience" />
                                <TextInput placeholder="e.g. 1-2 Years, Entry Level..." className="mt-1 block w-full" value={data.years_experience} onChange={e => setData('years_experience', e.target.value)} />
                                <InputError message={errors.years_experience} className="mt-2" />
                            </div>

                            <div className="md:col-span-2">
                                <InputLabel htmlFor="skills_required" value="Skills / Experience Required" />
                                <textarea rows="3" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500" value={data.skills_required} onChange={e => setData('skills_required', e.target.value)} placeholder="List mandatory certifications, technical skills, etc."></textarea>
                                <InputError message={errors.skills_required} className="mt-2" />
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3: PURPOSE & STATUS */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">3. Employment & Purpose</h3>
                        </div>
                        <div className="p-6 space-y-6">
                            
                            {/* Employment Status Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <InputLabel htmlFor="employment_status" value="Employment Status" />
                                    <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500" value={data.employment_status} onChange={e => setData('employment_status', e.target.value)}>
                                        <option value="">Select Status...</option>
                                        <option value="Full-time">Full-time Regular</option>
                                        <option value="Part-time">Part-time</option>
                                        <option value="Reliever">Reliever</option>
                                        <option value="Project-based">Project-based</option>
                                        
                                        {/* 🟢 3. DYNAMIC INTERN OPTION */}
                                        {isInternEligible && (
                                            <option value="Intern">Intern</option>
                                        )}
                                        
                                    </select>
                                    <InputError message={errors.employment_status} className="mt-2" />
                                </div>
                                <div>
                                    <InputLabel htmlFor="reliever_info" value="If Reliever, indicate name & timeline:" className={data.employment_status !== 'Reliever' ? 'opacity-50' : ''} />
                                    <TextInput placeholder="e.g. John Doe, May 1 to May 15" className="mt-1 block w-full disabled:bg-gray-100 disabled:text-gray-400" value={data.reliever_info} onChange={e => setData('reliever_info', e.target.value)} disabled={data.employment_status !== 'Reliever'} />
                                    <InputError message={errors.reliever_info} className="mt-2" />
                                </div>
                            </div>

                            {/* Main Purpose */}
                            <div>
                                <InputLabel htmlFor="purpose" value="General Purpose of Request" />
                                <textarea rows="2" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:border-indigo-500" value={data.purpose} onChange={e => setData('purpose', e.target.value)} placeholder="Provide a brief explanation for this manpower request..."></textarea>
                                <InputError message={errors.purpose} className="mt-2" />
                            </div>

                            {/* New Position vs Replacement Logic */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-5 bg-indigo-50/50 border border-indigo-100 rounded-lg">
                                <div>
                                    <InputLabel value="Is this a New Position?" />
                                    <div className="mt-2 flex gap-4 mb-3">
                                        <label className="flex items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={data.is_new_position === '1'} onChange={() => setData('is_new_position', '1')} /> <span className="ml-2 text-sm font-medium">Yes</span></label>
                                        <label className="flex items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={data.is_new_position === '0'} onChange={() => setData('is_new_position', '0')} /> <span className="ml-2 text-sm font-medium">No</span></label>
                                    </div>
                                    <InputLabel htmlFor="job_description" value="If Yes, include Job Description:" className={data.is_new_position === '0' ? 'opacity-50' : ''} />
                                    <textarea rows="3" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm disabled:bg-white/50 disabled:text-gray-400" value={data.job_description} onChange={e => setData('job_description', e.target.value)} disabled={data.is_new_position === '0'} placeholder={data.is_new_position === '1' ? "List main duties and responsibilities..." : ""}></textarea>
                                </div>

                                <div>
                                    <InputLabel value="Is this a Replacement?" />
                                    <div className="mt-2 flex gap-4 mb-3">
                                        <label className="flex items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={data.is_replacement === '1'} onChange={() => setData('is_replacement', '1')} /> <span className="ml-2 text-sm font-medium">Yes</span></label>
                                        <label className="flex items-center cursor-pointer"><input type="radio" className="text-indigo-600 focus:ring-indigo-500 w-4 h-4" checked={data.is_replacement === '0'} onChange={() => setData('is_replacement', '0')} /> <span className="ml-2 text-sm font-medium">No</span></label>
                                    </div>
                                    <InputLabel htmlFor="replaced_employee_name" value="If Yes, Name of previous staff:" className={data.is_replacement === '0' ? 'opacity-50' : ''} />
                                    <TextInput className="mt-1 block w-full disabled:bg-white/50 disabled:text-gray-400" value={data.replaced_employee_name} onChange={e => setData('replaced_employee_name', e.target.value)} disabled={data.is_replacement === '0'} placeholder={data.is_replacement === '1' ? "Employee Name" : ""} />
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* SECTION 4: ROUTING & SUBMISSION */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider">4. Workflow Routing</h3>
                        </div>
                        <div className="p-6">
                            <div className="mb-6">
                                <InputLabel value="Requesting Point of Contact (TL)" />
                                <TextInput className="mt-1 block w-full md:w-1/2 bg-gray-50 text-gray-500 border-gray-200 font-medium" value={data.poc_name} readOnly disabled />
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between pt-6 border-t border-gray-100 gap-4">
                                <div className="text-sm text-gray-600 bg-blue-50 text-blue-800 p-3 rounded-md border border-blue-100 w-full sm:w-auto">
                                    <span className="font-bold">Automated Routing:</span> This request will be automatically sent to your Department Head, followed by HR, and finally the Director.
                                </div>
                                <PrimaryButton className="px-8 py-3 shrink-0" disabled={!canCreateManpowerRequest || processing}>
                                    {processing ? 'Submitting Request...' : 'Submit to Workflow'}
                                </PrimaryButton>
                            </div>
                        </div>
                    </div>
                    </fieldset>

                </form>
            </div>
        </SidebarLayout>
    );
}