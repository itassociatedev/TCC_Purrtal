<?php
// CRUD controller for company content pages and assets

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use App\Models\CompanyContent;
use App\Models\ContentType;

class CompanyContentController extends Controller
{
    public function index()
    {
        $contents = CompanyContent::all();
        $contentTypes = ContentType::all();

        return Inertia::render('Admin/CompanyContent', [
            'contents' => $contents,
            'contentTypes' => $contentTypes,
        ]);
    }

    public function store(Request $request)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('company_content')) {
            abort(403, 'You do not have permission to add company content.');
        }

        $request->validate([
            'type' => 'required|string|max:50',
            'title' => 'nullable|string|max:255',
            'content' => 'required|string',
            'content_html' => 'nullable|string', // Don't forget to allow the rich text!
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            // Add validation for the crop fields
            'image_zoom' => 'nullable|numeric',
            'image_offset_x' => 'nullable|numeric',
            'image_offset_y' => 'nullable|numeric',
        ]);

        try {
            // Include the crop fields in the data array
            $data = $request->only([
                'type', 'title', 'content', 'content_html', 
                'image_zoom', 'image_offset_x', 'image_offset_y'
            ]);

            if ($request->hasFile('image')) {
                $data['image_path'] = $request->file('image')->store('company_contents', 'public');
            }

            CompanyContent::create($data);

            return back()->with('success', 'Content added successfully!');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to add content: ' . $e->getMessage());
        }
    }

    
    public function update(Request $request, CompanyContent $companyContent)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('company_content')) {
            abort(403, 'You do not have permission to edit company content.');
        }

        $request->validate([
            'type' => 'required|string|max:50',
            'title' => 'nullable|string|max:255',
            'content' => 'required|string',
            'content_html' => 'nullable|string', // Don't forget to allow the rich text!
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:2048',
            // Add validation for the crop fields
            'image_zoom' => 'nullable|numeric',
            'image_offset_x' => 'nullable|numeric',
            'image_offset_y' => 'nullable|numeric',
        ]);

        try {
             // Include the crop fields in the data array
            $data = $request->only([
                'type', 'title', 'content', 'content_html', 
                'image_zoom', 'image_offset_x', 'image_offset_y'
            ]);

            if ($request->hasFile('image')) {
                if ($companyContent->image_path) {
                    Storage::disk('public')->delete($companyContent->image_path);
                }
                $data['image_path'] = $request->file('image')->store('company_contents', 'public');
            }

            $companyContent->update($data);

            return back()->with('success', 'Content updated successfully!');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update content: ' . $e->getMessage());
        }
    }

    
    public function destroy(CompanyContent $companyContent)
    {
        $user = Auth::user();
        if (!$user?->canDeleteModule('company_content')) {
            abort(403, 'You do not have permission to delete company content.');
        }

        try {
            // Delete the image file from the server
            if ($companyContent->image_path) {
                Storage::disk('public')->delete($companyContent->image_path);
            }

            // Delete the database row
            $companyContent->delete();

            return back()->with('success', 'Content deleted successfully.');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to delete content: ' . $e->getMessage());
        }
    }

    public function storeType(Request $request)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('company_content')) {
            abort(403, 'You do not have permission to manage company content types.');
        }

        $request->validate([
            'name' => 'required|string|max:50|unique:content_types,name',
        ]);

        ContentType::create($request->only('name'));

        return back()->with('success', 'New content type added!');
    }

    // ---> NEW METHOD FOR UPDATING A TYPE <---
    public function updateType(Request $request, ContentType $type)
    {
        $user = Auth::user();
        if (!$user?->canEditModule('company_content')) {
            abort(403, 'You do not have permission to manage company content types.');
        }

        $request->validate([
            // This ensures we can keep the same name if we don't change it, 
            // but blocks us from duplicating another existing type's name
            'name' => 'required|string|max:50|unique:content_types,name,' . $type->id,
        ]);

        try {
            $type->update([
                'name' => $request->name
            ]);

            return back()->with('success', 'Content type updated successfully!');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to update content type: ' . $e->getMessage());
        }
    }

    // ---> NEW METHOD FOR DELETING A TYPE <---
    public function destroyType(ContentType $type)
    {
        $user = Auth::user();
        if (!$user?->canDeleteModule('company_content')) {
            abort(403, 'You do not have permission to delete company content types.');
        }

        try {
            $type->delete();
            return back()->with('success', 'Content type deleted successfully.');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to delete content type: ' . $e->getMessage());
        }
    }
}