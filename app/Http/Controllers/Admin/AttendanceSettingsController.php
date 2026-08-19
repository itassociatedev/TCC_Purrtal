<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use App\Models\AttendanceSetting;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AttendanceSettingsController extends Controller
{
    public function index()
    {
        // 🔐 Ensure only Admins can access these system settings
        if (auth()->user()->role_id !== 1 && strtolower(trim(auth()->user()->role->name)) !== 'admin') {
            abort(403, 'Unauthorized access to Admin Settings.');
        }

        $shifts = Shift::orderBy('start_time')->get();
        
        // Format settings into a clean key-value pair for React
        $rawSettings = AttendanceSetting::all();
        $settings = $rawSettings->pluck('setting_value', 'setting_key')->toArray();

        return Inertia::render('Admin/AttendanceSettings', [
            'shifts' => $shifts,
            'settings' => $settings
        ]);
    }

    public function storeShift(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'start_time' => 'required',
            'end_time' => 'required',
            'shift_type' => 'required|string|in:Day Shift,Straight Duty,Graveyard Shift',
        ]);

        Shift::create([
            'name' => $request->name,
            'start_time' => $request->start_time,
            'end_time' => $request->end_time,
            'shift_type' => $request->shift_type,
            'is_active' => true,
        ]);

        return redirect()->back()->with('success', 'Shift added successfully.');
    }

    public function toggleShift(Shift $shift)
    {
        $shift->update(['is_active' => !$shift->is_active]);
        return redirect()->back()->with('success', 'Shift status updated.');
    }

    public function updateCutoffs(Request $request)
    {
        $request->validate([
            'cutoff_1_start' => 'required|numeric|min:1|max:31',
            'cutoff_1_end' => 'required|numeric|min:1|max:31',
            'cutoff_2_start' => 'required|numeric|min:1|max:31',
            'cutoff_2_end' => 'required|numeric|min:1|max:31',
        ]);

        foreach ($request->only(['cutoff_1_start', 'cutoff_1_end', 'cutoff_2_start', 'cutoff_2_end']) as $key => $value) {
            AttendanceSetting::where('setting_key', $key)->update(['setting_value' => $value]);
        }

        return redirect()->back()->with('success', 'Cut-off periods updated successfully.');
    }
}