<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrgChartMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class OrgChartController extends Controller
{
    // The uploaded chart SVG has its own folder; member photos are stored in org_chart/
    private const CHART_DIR = 'org_chart_svg';

    private function getOrgChartSvgUrl(): ?string
    {
        $disk = Storage::disk('public');
        $filePath = $disk->files(self::CHART_DIR)[0] ?? null;

        // Charts uploaded before the folder split were saved next to the member photos
        if (!$filePath) {
            $filePath = collect($disk->files('org_chart'))
                ->first(fn ($path) => str_ends_with(strtolower($path), '.svg'));
        }

        if (!$filePath) {
            return null;
        }

        return 'storage/' . $filePath . '?v=' . $disk->lastModified($filePath);
    }

    // Helper to load the dynamic structure (100% clean, zero hardcoding)
    private function getStructure()
    {
        if (Storage::disk('local')->exists('org_chart_structure.json')) {
            return json_decode(Storage::disk('local')->get('org_chart_structure.json'), true);
        }

        // Return completely empty arrays if no structure has been saved yet
        return [
            'branches' => [],
            'positions' => [],
            'branchSettings' => [] // <-- NEW: Default empty settings
        ];
    }

    public function saveStructure(Request $request)
    {
        // Allowed to be empty arrays so you can delete everything if needed
        $request->validate([
            'branches' => 'present|array',
            'positions' => 'present|array',
            'branchSettings' => 'nullable|array', // <-- NEW: Validate the settings
        ]);

        Storage::disk('local')->put('org_chart_structure.json', json_encode([
            'branches' => $request->branches,
            'positions' => $request->positions,
            'branchSettings' => $request->branchSettings ?? [], // <-- NEW: Save the settings to JSON
        ]));

        return back()->with('success', 'Organization structure updated!');
    }

    // For the Admin to manage members
    public function index()
    {
        $members = OrgChartMember::orderBy('sort_order')->latest()->get();

        $orgChartSvg = $this->getOrgChartSvgUrl();

        return Inertia::render('Admin/OrgChart', [
            'members' => $members,
            'orgChartSvg' => $orgChartSvg,
            'structure' => $this->getStructure()
        ]);
    }

    // For the regular User to view the chart
    public function userIndex()
    {
        $members = OrgChartMember::orderBy('sort_order')->latest()->get();

        $orgChartSvg = $this->getOrgChartSvgUrl();

        return Inertia::render('OrgChart', [
            'members' => $members,
            'orgChartSvg' => $orgChartSvg,
            'structure' => $this->getStructure()
        ]);
    }

    public function storeAsset(Request $request)
    {
        $request->validate([
            'org_chart_file' => 'required|file|mimes:svg|max:768000',
        ]);

        if ($request->hasFile('org_chart_file')) {
            // 1. Replace only the previous chart file. Member photos live in org_chart/ and must never be touched here.
            $oldFiles = Storage::disk('public')->files(self::CHART_DIR);
            Storage::disk('public')->delete($oldFiles);

            // 2. Save the new file using its actual original uploaded name
            $file = $request->file('org_chart_file');
            $file->storeAs(self::CHART_DIR, $file->getClientOriginalName(), 'public');
        }

        return back()->with('success', 'Organizational Chart updated successfully!');
    }

    public function reorder(Request $request)
    {
        $request->validate([
            'orderedIds' => 'required|array',
        ]);

        foreach ($request->orderedIds as $index => $id) {
            OrgChartMember::where('id', $id)->update(['sort_order' => $index]);
        }

        return back();
    }

    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'position' => 'required|string|max:255',
            'branch' => 'required|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:768000',
        ]);

        $data = $request->only(['name', 'position', 'branch']);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('org_chart', 'public');
        }

        OrgChartMember::create($data);

        return back()->with('success', 'Member added to Organizational Chart successfully!');
    }

    public function update(Request $request, OrgChartMember $member)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'position' => 'required|string|max:255',
            'branch' => 'required|string|max:255',
            'image' => 'nullable|image|mimes:jpeg,png,jpg,webp|max:768000', // Image optional on update
        ]);

        $data = $request->only(['name', 'position', 'branch']);

        if ($request->hasFile('image')) {
            if ($member->image_path) {
                Storage::disk('public')->delete($member->image_path);
            }
            $data['image_path'] = $request->file('image')->store('org_chart', 'public');
        }

        $member->update($data);

        return back()->with('success', 'Member updated successfully.');
    }

    public function destroy(OrgChartMember $member)
    {
        if ($member->image_path) {
            Storage::disk('public')->delete($member->image_path);
        }

        $member->delete();

        return back()->with('success', 'Member removed successfully.');
    }
}
