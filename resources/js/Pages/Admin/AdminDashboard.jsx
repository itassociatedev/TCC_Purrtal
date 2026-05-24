import { getAdminLinks } from "@/Config/navigation";
import SidebarLayout from "@/Layouts/SidebarLayout";
import { Head } from "@inertiajs/react";

// Accept the new props passed from our Laravel route, setting defaults to 0 just in case
export default function AdminDashboard({ auth, totalActiveEmployees = 0, totalBranches = 0, activeSessions = 0 }) {

    const adminLinks = getAdminLinks(auth);

    return (
        <SidebarLayout
            activeModule="Admin"
            sidebarLinks={adminLinks}
            header={
                <h2 className="text-xl font-semibold leading-tight text-gray-800">
                    Admin Dashboard
                </h2>
            }
        >
            <Head title="Admin Dashboard" />

            <div className="py-12">
                <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                    {/* Welcome Card */}
                    <div className="mb-6 overflow-hidden bg-white shadow-sm sm:rounded-lg border-l-4 border-red-500">
                        <div className="p-6 text-gray-900">
                            <h3 className="text-lg font-bold">Welcome, System Administrator</h3>
                            <p className="mt-1 text-sm text-gray-600">
                                You have full access to all modules and employee records.
                            </p>
                        </div>
                    </div>

                    {/* Admin stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                            <div className="text-gray-500 text-sm font-medium">Total Employees</div>
                            {/* Dynamically render the total active employees */}
                            <div className="mt-2 text-3xl font-bold text-gray-900">{totalActiveEmployees}</div>
                        </div>
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                            <div className="text-gray-500 text-sm font-medium">Active Branches</div>
                            {/* Dynamically render the total branches */}
                            <div className="mt-2 text-3xl font-bold text-gray-900">{totalBranches}</div>
                        </div>
                        <div className="bg-white overflow-hidden shadow-sm sm:rounded-lg p-6">
                            <div className="text-gray-500 text-sm font-medium">
                                Active Users <br />
                            </div>
                            
                            {/* Dynamic text color based on activeSessions count */}
                            <div className={`mt-2 text-3xl font-bold flex items-center gap-2 ${activeSessions > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                {/* Dynamic dot indicator */}
                                <span className={`h-3 w-3 rounded-full inline-block ${activeSessions > 0 ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                                {activeSessions}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </SidebarLayout>
    );
}