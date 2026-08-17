import React from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';

export default function Overview() {
    // sub-modules
    const attendanceLinks = [
        { label: 'Attendance Overview', href: route('attendance.overview'), active: route().current('attendance.overview') },
        { label: 'Setup Schedule', href: route('attendance.setup-schedule'), active: route().current('attendance.setup-schedule') },
        { label: 'Schedule View', href: route('attendance.schedule-view'), active: route().current('attendance.schedule-view') },
        { label: 'Calendar', href: route('attendance.calendar'), active: route().current('attendance.calendar') },
    ];

    return (
        <SidebarLayout
            activeModule="Attendance"
            sidebarLinks={attendanceLinks}
            header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Attendance Overview</h2>}
        >
            <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800">Attendance Module Groundwork</h3>
                <p className="mt-2 text-gray-600">Analytics goes here.</p>
            </div>
        </SidebarLayout>
    );
}