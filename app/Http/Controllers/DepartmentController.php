<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Department; // Ensure your Department model is imported

class DepartmentController extends Controller
{
    // 🟢 Function to Add a New Department
    public function store(Request $request)
    {
        // 1. Validate the input
        $request->validate([
            'name' => 'required|string|max:255|unique:departments,name',
        ]);

        // 2. Save to the database
        Department::create([
            'name' => $request->name
        ]);

        // 3. Return back to the page
        return back()->with('success', 'Department added successfully.');
    }

    // 🟢 Function to Delete a Department
    public function destroy($id)
    {
        // Find the department by ID or by Name
        $department = Department::where('id', $id)->orWhere('name', $id)->firstOrFail();
        
        // Delete it
        $department->delete();

        // Return back to the page
        return back()->with('success', 'Department deleted successfully.');
    }
}