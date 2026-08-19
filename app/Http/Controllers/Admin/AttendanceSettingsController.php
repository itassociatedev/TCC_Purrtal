<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Shift;
use App\Models\AttendanceSetting;
use Inertia\Inertia;
use Illuminate\Support\Facades\Auth;

class AttendanceSettingsController extends Controller
{
    public function index()
    {
        // 🟢 ACL MATRIX: VIEW (Allows Full, Edit, View)
        if (!Auth::user()->canViewModule('attendance_settings')) {
            abort(403, 'UNAUTHORIZED ACCESS TO ATTENDANCE SETTINGS.');
        }

        $shifts = Shift::orderBy('start_time')->get();
        $settings = AttendanceSetting::pluck('setting_value', 'setting_key')->toArray();

        return Inertia::render('Admin/AttendanceSettings', [
            'shifts' => $shifts,
            'settings' => $settings
        ]);
    }

    public function updateCutoffs(Request $request)
    {
        // 🟢 ACL MATRIX: EDIT (Allows Full, Edit)
        if (!Auth::user()->canEditModule('attendance_settings')) {
            abort(403, 'You do not have permission to edit settings.');
        }

        $request->validate([
            'cutoff_1_start' => 'required|numeric|min:1|max:31',
            'cutoff_1_end' => 'required|numeric|min:1|max:31',
            'cutoff_2_start' => 'required|numeric|min:1|max:31',
            'cutoff_2_end' => 'required|numeric|min:1|max:31',
        ]);

        foreach ($request->only(['cutoff_1_start', 'cutoff_1_end', 'cutoff_2_start', 'cutoff_2_end']) as $key => $value) {
            AttendanceSetting::updateOrCreate(['setting_key' => $key], ['setting_value' => $value]);
        }

        return redirect()->back()->with('success', 'Cut-off periods updated successfully.');
    }

    public function storeShift(Request $request)
    {
        // 🟢 ACL MATRIX: EDIT (Allows Full, Edit)
        if (!Auth::user()->canEditModule('attendance_settings')) abort(403);

        $request->validate([
            'name' => 'required|string|max:255',
            'start_time' => 'required',
            'end_time' => 'required',
            'shift_type' => 'required|string',
        ]);

        Shift::create([
            'name' => $request->name,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'shift_type' => $request->shift_type,
            'is_active' => true,
        ]);

        return redirect()->back()->with('success', 'New shift added successfully.');
    }

    public function toggleShift($id)
    {
        // 🟢 ACL MATRIX: EDIT (Allows Full, Edit)
        if (!Auth::user()->canEditModule('attendance_settings')) abort(403);

        $shift = Shift::findOrFail($id);
        $shift->update(['is_active' => !$shift->is_active]);

        return redirect()->back()->with('success', 'Shift status updated.');
    }

    public function updateShift(Request $request, $id)
    {
        // 🟢 ACL MATRIX: EDIT (Allows Full, Edit)
        if (!Auth::user()->canEditModule('attendance_settings')) abort(403);

        $request->validate([
            'name' => 'required|string|max:255',
            'start_time' => 'required',
            'end_time' => 'required',
            'shift_type' => 'required|string',
            'is_active' => 'required|boolean',
        ]);

        $shift = Shift::findOrFail($id);
        $shift->update($request->only('name', 'start_time', 'end_time', 'shift_type', 'is_active'));

        return redirect()->back()->with('success', 'Shift updated successfully.');
    }

    public function deleteShift($id)
    {
        // 🟢 ACL MATRIX: FULL (Allows Full ONLY)
        if (!Auth::user()->canDeleteModule('attendance_settings')) abort(403);

        $shift = Shift::findOrFail($id);
        $shift->delete();

        return redirect()->back()->with('success', 'Shift permanently deleted.');
    }
}