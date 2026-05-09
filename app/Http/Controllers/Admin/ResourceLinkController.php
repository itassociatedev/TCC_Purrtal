<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ResourceLink;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class ResourceLinkController extends Controller
{
    public function index()
    {
        // 🟢 Orders by the custom sort_order column for the admin view!
        $links = ResourceLink::orderBy('type', 'desc')
                             ->orderBy('sort_order', 'asc')
                             ->orderBy('created_at', 'desc')
                             ->get();
                             
        return Inertia::render('Admin/ResourceLinks', [
            'links' => $links
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'url' => 'required|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
            'description' => 'nullable|string',
            'type' => 'required|in:internal,external',
            'is_active' => 'boolean',
        ]);

        if ($request->hasFile('image')) {
            $path = $request->file('image')->store('resource_links', 'public');
            $validated['image_path'] = $path;
        }

        // 🟢 Automatically set the new item to the bottom of its list
        $validated['sort_order'] = ResourceLink::where('type', $request->type)->max('sort_order') + 1;

        unset($validated['image']);

        ResourceLink::create($validated);

        return redirect()->back()->with('success', 'Resource link added successfully.');
    }

    public function update(Request $request, ResourceLink $resourceLink)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'url' => 'required|string',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
            'description' => 'nullable|string',
            'type' => 'required|in:internal,external',
            'is_active' => 'boolean',
        ]);

        if ($request->hasFile('image')) {
            if ($resourceLink->image_path) {
                Storage::disk('public')->delete($resourceLink->image_path);
            }
            $path = $request->file('image')->store('resource_links', 'public');
            $validated['image_path'] = $path;
        }

        unset($validated['image']);
        $resourceLink->update($validated);

        return redirect()->back()->with('success', 'Resource link updated successfully.');
    }

    // 🟢 Handle the drag and drop saving!
    public function reorder(Request $request)
    {
        $request->validate([
            'items' => 'required|array',
            'items.*.id' => 'required|exists:resource_links,id',
            'items.*.sort_order' => 'required|integer',
        ]);

        // Bulk update the new order for all affected items
        foreach ($request->items as $item) {
            ResourceLink::where('id', $item['id'])->update(['sort_order' => $item['sort_order']]);
        }

        return redirect()->back();
    }

    public function destroy(ResourceLink $resourceLink)
    {
        if ($resourceLink->image_path) {
            Storage::disk('public')->delete($resourceLink->image_path);
        }
        $resourceLink->delete();
        return redirect()->back()->with('success', 'Resource link deleted successfully.');
    }
}