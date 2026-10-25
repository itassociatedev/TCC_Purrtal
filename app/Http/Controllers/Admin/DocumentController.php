<?php
// Document repository management (upload, tagging, access)

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Document;
use App\Models\DocumentCategory;
use App\Models\User;
use App\Models\Department;
use App\Models\Branch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Auth;
use App\Notifications\NewDocumentAlert;
use Inertia\Inertia;

class DocumentController extends Controller
{
    public function index(Request $request)
    {
        $categories = DocumentCategory::orderBy('name', 'asc')->get();

        $departments = Department::all(); 
        $branches = Branch::all(); 
        $activeCategory = $request->query('category', 'Overview');
        
        $user = Auth::user();

        // Check if the user is an admin or director (Adjust this if your permission logic differs)
        $isAdmin = in_array($user->role?->name, ['admin', 'hrbp']) || 
                   (is_array($user->permissions) && in_array('director of corporate services and operations', $user->permissions));

        // Load relations so we can display Department/Branch names on the frontend
        $query = Document::with(['department', 'branch']);

        if ($activeCategory !== 'Overview') {
            $query->where('category', $activeCategory);
        }

        // --- ROLE BASED VIEWING LOGIC ---
        // If the user is NOT an admin, only show documents meant for "All Branches" (null) 
        // OR documents that match their specific branch ID.
        if (!$isAdmin) {
            $query->where(function ($q) use ($user) {
                $q->whereNull('branch_id')
                  ->orWhere('branch_id', $user->branch_id);
            });
        }

        $documents = $query->latest()->get();

        return Inertia::render('DocumentRepo', [
            'documents' => $documents,
            'categories' => $categories,
            'departments' => $departments, 
            'branches' => $branches, 
            'activeCategory' => $activeCategory,
        ]);
    }

    public function store(Request $request){
        // 🔐 ACL CHECK: Verify user can edit documents module
        $user = Auth::user();
        if (!$user->canEditModule('documents')) {
            abort(403, 'You do not have permission to upload documents.');
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'department_id' => 'required|exists:departments,id', 
            'branch_id' => 'nullable|exists:branches,id',        
            'description' => 'nullable|string',
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:768000', 
        ]);

        $filePath = $request->file('file')->store('documents', 'public');

        try{
            // 1. Save the document with department and branch
            $document = Document::create([
                'title' => $request->input('title'),
                'category' => $request->input('category'),
                'department_id' => $request->input('department_id'), 
                'branch_id' => $request->input('branch_id'),         
                'description' => $request->input('description'),
                'file_path' => $filePath,
            ]);

            // 2. Filter users to notify based on branch
            $usersToNotify = User::when($document->branch_id, function($query) use ($document) {
                $query->where('branch_id', $document->branch_id);
            })->get();

            // 3. Send the in-app notification to the filtered users
            if ($usersToNotify->isNotEmpty()) {
                Notification::send($usersToNotify, new NewDocumentAlert($document->title, Auth::user()->name));
            }

            return redirect()->back()->with('success', 'Document uploaded successfully.');
        }catch(\Exception $e){
            return redirect()->back()->with('error', 'Failed to upload document: ' . $e->getMessage());
        }   
    }

    public function destroy(Document $document)
    {
        // 🔐 ACL CHECK: Verify user can delete documents module
        $user = Auth::user();
        if (!$user->canDeleteModule('documents')) {
            abort(403, 'You do not have permission to delete documents.');
        }

        try {
            if (Storage::disk('local')->exists($document->file_path)) {
                Storage::disk('local')->delete($document->file_path);
            } elseif (Storage::disk('public')->exists($document->file_path)) {
                Storage::disk('public')->delete($document->file_path);
            }

            $document->delete();

            return back()->with('success', 'Document deleted successfully.');
        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Failed to delete document: ' . $e->getMessage()]);
        }
    }

    public function storeCategory(Request $request)
    {
        // 🔐 ACL CHECK: Verify user can edit documents module
        $user = Auth::user();
        if (!$user->canEditModule('documents')) {
            abort(403, 'You do not have permission to manage document categories.');
        }

        $request->validate([
            'name' => 'required|string|max:50|unique:document_categories,name',
        ]);

        DocumentCategory::create($request->only('name'));

        return back()->with('success', 'New document category added!');
    }

    public function destroyCategory($id)
    {
        // 🔐 ACL CHECK: Verify user can delete documents module
        $user = Auth::user();
        if (!$user->canDeleteModule('documents')) {
            abort(403, 'You do not have permission to manage document categories.');
        }

        try {
            $category = DocumentCategory::findOrFail($id);

            // Safety Check: Prevent deleting categories that currently have documents assigned to them
            $documentCount = Document::where('category', $category->name)->count();
            
            if ($documentCount > 0) {
                return back()->with('error', 'Cannot delete this category because it contains ' . $documentCount . ' documents. Please move or delete the documents first.');
            }

            $category->delete();

            return back()->with('success', 'Category deleted successfully.');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to delete category: ' . $e->getMessage());
        }
    }
    public function updateCategory(Request $request, $id)
    {
        // 🔐 ACL CHECK: Verify user can edit documents module
        $user = Auth::user();
        if (!$user->canEditModule('documents')) {
            abort(403, 'You do not have permission to manage document categories.');
        }

        $request->validate([
            'name' => 'required|string|max:50|unique:document_categories,name,' . $id,
        ]);

        try {
            $category = DocumentCategory::findOrFail($id);
            $category->name = $request->name;
            $category->save();

            return back()->with('success', 'Category updated successfully.');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update category: ' . $e->getMessage());
        }
    }

    public function toggleDownloadable(Request $request, $id)
    {
        // 🔐 ACL CHECK: Verify user can edit documents module
        $user = Auth::user();
        if (!$user->canEditModule('documents')) {
            abort(403, 'You do not have permission to manage document categories.');
        }

        $request->validate([
            'is_downloadable' => 'required|boolean',
        ]);

        try {
            $category = DocumentCategory::findOrFail($id);
            $category->is_downloadable = $request->is_downloadable;
            $category->save();

            return back()->with('success', 'Category downloadable status updated.');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update category: ' . $e->getMessage());
        }
    }

    public function show($id, $filename = null)
    {
        $document = Document::findOrFail($id);

        if (Storage::disk('local')->exists($document->file_path)) {
            $path = Storage::disk('local')->path($document->file_path);
        } 
        elseif (Storage::disk('public')->exists($document->file_path)) {
            $path = Storage::disk('public')->path($document->file_path);
        } 
        else {
            abort(404, 'Document file could not be found in the secure vault.');
        }

        $headers = [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . $document->title . '.pdf"'
        ];
        return response()->file($path, $headers);
    }
    
    public function update(Request $request, Document $document)
    {
        // 🔐 ACL CHECK: Verify user can edit documents module
        $user = Auth::user();
        if (!$user->canEditModule('documents')) {
            abort(403, 'You do not have permission to edit documents.');
        }

        $request->validate([
            'title' => 'required|string|max:255',
            'category' => 'required|string|max:255',
            'department_id' => 'required|exists:departments,id',
            'branch_id' => 'nullable|exists:branches,id',
            'description' => 'nullable|string',
            'file' => 'nullable|file|mimes:pdf,doc,docx,xls,xlsx|max:10240', // 10MB max
        ]);

        $data = $request->only(['title', 'category', 'department_id', 'branch_id', 'description']);

        // If the user uploaded a new replacement file
        if ($request->hasFile('file')) {
            // Delete the old file from storage first to save space
            if ($document->file_path) {
                Storage::disk('public')->delete($document->file_path);
            }
            // Save the new file
            $data['file_path'] = $request->file('file')->store('documents', 'public');
        }

        $document->update($data);

        return back()->with('success', 'Document updated successfully.');
    }
}