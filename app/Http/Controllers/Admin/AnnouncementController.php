<?php
// Admin announcements management and notification dispatch

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Announcement;
use App\Notifications\AnnouncementAlert;
use App\Models\Branch;
use App\Models\PriorityLevel;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AnnouncementController extends Controller
{
    public function index()
    {
        $announcements = Announcement::with(['branches', 'priorityLevel', 'comments.user'])->latest()->get();

        $branches = Branch::all();

        $priorities = PriorityLevel::all();

        return Inertia::render('Admin/Announcements', [
            'announcements' => $announcements,
            'branches' => $branches,
            'priorities' => $priorities,
        ]);
    }

    // ✅ FIXED: Renamed this back to "store" instead of "update" on function
    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('announcements')) {
            abort(403, 'You do not have permission to post announcements.');
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'author' => 'required|string|max:255',
            'content' => 'required|string',
            'priority_level_id' => 'required|exists:priority_levels,id',
            'branch_ids' => 'required|array|min:1',
            'branch_ids.*' => 'exists:branches,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',

            // ✅ Added zoom fields to store method
            'image_zoom' => 'nullable|numeric',
            'image_offset_x' => 'nullable|numeric',
            'image_offset_y' => 'nullable|numeric',
        ]);

        // Handle Cover Photo Upload
        if ($request->hasFile('image')) {
            $validated['image_path'] = $request->file('image')->store('announcements/images', 'public');
        }

        // Handle Document Attachment Upload
        if ($request->hasFile('attachment')) {
            $validated['attachment_path'] = $request->file('attachment')->store('announcements/attachments', 'public');
        }

        $announcement = Announcement::create($validated);
        
        // Attach the branches via pivot table
        $announcement->branches()->sync($request->branch_ids);

        // SMART NOTIFICATION ROUTING
        $targetBranchIds = $request->branch_ids;

        $targetUsers = User::whereIn('branch_id', $targetBranchIds)
            ->orWhereExists(function ($query) use ($targetBranchIds) {
                $query->select(DB::raw(1))
                      ->from('branch_user')
                      ->whereColumn('branch_user.user_id', 'users.id')
                      ->whereIn('branch_user.branch_id', $targetBranchIds);
            })->get();

        if ($targetUsers->isNotEmpty()) {
           Notification::send($targetUsers, new AnnouncementAlert($announcement->title, $announcement->author));
        }

        return back()->with('success', 'Announcement posted successfully.');
    }

    public function update(Request $request, Announcement $announcement)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('announcements')) {
            abort(403, 'You do not have permission to edit announcements.');
        }

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'author' => 'required|string|max:255',
            'content' => 'required|string',
            'priority_level_id' => 'required|exists:priority_levels,id',
            'branch_ids' => 'required|array|min:1',
            'branch_ids.*' => 'exists:branches,id',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,webp|max:5120',
            'attachment' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',

            // ✅ FIXED: Added zoom fields to update method as well
            'image_zoom' => 'nullable|numeric',
            'image_offset_x' => 'nullable|numeric',
            'image_offset_y' => 'nullable|numeric',
        ]);

        // Handle Cover Photo Update
        if ($request->hasFile('image')) {
            // Delete the old image if it exists
            if ($announcement->image_path) {
                Storage::disk('public')->delete($announcement->image_path);
            }
            $validated['image_path'] = $request->file('image')->store('announcements/images', 'public');
        }

        // Handle Document Attachment Update
        if ($request->hasFile('attachment')) {
            // Delete the old attachment if it exists
            if ($announcement->attachment_path) {
                Storage::disk('public')->delete($announcement->attachment_path);
            }
            $validated['attachment_path'] = $request->file('attachment')->store('announcements/attachments', 'public');
        }

        $announcement->update($validated);
        $announcement->branches()->sync($request->branch_ids);

        return back()->with('success', 'Announcement updated successfully.');
    }

    public function destroy(Announcement $announcement)
    {
        $user = Auth::user();
        if (!$user?->canDeleteModule('announcements')) {
            abort(403, 'You do not have permission to delete announcements.');
        }

        try{
            if($announcement->image_path){
                Storage::disk('public')->delete($announcement->image_path);
            }

            $announcement->delete();

            return back()->with('success', 'Announcement deleted successfully.');
        }catch(\Exception $e){
            return back()->withErrors(['error' => 'Failed to delete announcement: ' . $e->getMessage()]);
        }
    }

    public function storePriority(Request $request)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('announcements')) {
            abort(403, 'You do not have permission to manage announcement priorities.');
        }

        $request->validate([
            'name' => 'required|string|max:50|unique:priority_levels,name',
            'color' => 'required|string|max:7',
        ]);

        PriorityLevel::create($request->only(['name', 'color']));

        return back()->with('success', 'New Category added!');
    }

    // --- NEW METHODS ---

    public function updatePriority(Request $request, PriorityLevel $priority)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('announcements')) {
            abort(403, 'You do not have permission to manage announcement priorities.');
        }

        $request->validate([
            'name' => 'required|string|max:50|unique:priority_levels,name,' . $priority->id,
            'color' => 'required|string|max:7',
        ]);

        $priority->update($request->only(['name', 'color']));

        return back()->with('success', 'Category updated successfully!');
    }

    public function destroyPriority(PriorityLevel $priority)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('announcements')) {
            abort(403, 'You do not have permission to delete announcement priorities.');
        }

        try {
            $priority->delete();
            return back()->with('success', 'Category deleted successfully!');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to delete priority: ' . $e->getMessage()]);
        }
    }
}