<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Department;
use App\Models\Position;
use App\Models\Branch;
use App\Models\Role;
use App\Exports\UsersExport;
use App\Exports\UsersTemplateExport;
use App\Imports\UsersImport;
use Maatwebsite\Excel\Facades\Excel;
use App\Notifications\AccountActivation;
use App\Notifications\AdminPasswordReset;
use Inertia\Inertia;

class EmployeeController extends Controller
{
    public function index()
    {
        $users = User::with(['department', 'position', 'branches'])->get();
        $positions = Position::all();
        $departments = Department::all();
        $branches = Branch::all();
        $roles = Role::all();

        return Inertia::render('Admin/EmployeeManagement', [
            'users' => $users,
            'departments' => $departments,
            'positions' => $positions,
            'branches' => $branches,
            'roles' => $roles
        ]);
    }

    // ----------------Store User, Position, Branch functions ----------------

    public function storeUser(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'string|min:8|',
            'role_id' => 'required|exists:roles,id',
            'department_id' => 'required|exists:departments,id',
            'position_id' => 'required|exists:positions,id',
            'branch_ids' => 'required|array',
            'branch_ids.*' => 'exists:branches,id',
        ]);
        
        try {
            // Check if the assigned role is an Admin
            $role = Role::find($request->role_id);
            $isAdmin = $role && (strtolower($role->name) === 'admin' || strtolower($role->name) === 'super admin');
            
            // Force device limit to max 2 if not an Admin
            $device_limit = $request->device_limit;
            if (!$isAdmin && $device_limit > 2) {
                $device_limit = 2;
            }

            $user = User::create([
                'name' => trim($request->name),
                'email' => trim($request->email),
                'password' => null,
                'role_id' => $request->role_id,
                'department_id' => $request->department_id,
                'position_id' => $request->position_id,
                'device_limit'=> $device_limit,
                'branch_id' => $request->branch_ids[0] ?? null,
                'is_rotating'=> count($request->branch_ids) > 1,
            ]);

            $user->branches()->attach($request->branch_ids);

            return redirect()->back()->with('success', 'Employee added successfully.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'An error occurred while adding the employee: ' . $e->getMessage());
        }
    }

    public function storePosition(Request $request)
    {
        try {
            $request->validate([
                'department_id' => 'required|exists:departments,id',
                'position_name' => 'required|string|max:255',
            ]);

            Position::create([
                'department_id' => $request->department_id,
                'name' => $request->position_name,
            ]);

            return redirect()->back()->with('success', 'Position added successfully.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'An error occurred while adding the position: ' . $e->getMessage());
        }
    }

    public function storeBranch(Request $request)
    {
        try {
            $request->validate([
                'name' => 'required|string|max:255',
            ]);

            Branch::create([
                'name' => $request->name,
            ]);

            return redirect()->back()->with('success', 'Branch added successfully.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'An error occurred while adding the branch: ' . $e->getMessage());
        }
    }

    public function storeDepartment(Request $request)
    {
        try {
            $request->validate([
                'name' => 'required|string|max:255|unique:departments,name',
            ]);
            
            Department::create([
                'name' => $request->name,
            ]);
            
            return back()->with('success', 'Department added successfully.');
        } catch(\Exception $e) {
            return back()->with('error', 'An error occured while adding the department: ' . $e->getMessage());
        }
    }

    public function storeRole(Request $request)
    {
        try {
            $request->validate([
                'name' => 'required|string|max:255|unique:roles,name',
            ]);

            Role::create([
                'name' => $request->name,
            ]);

            return back()->with('success', 'System role added successfully.');
        } catch(\Exception $e) {
            return back()->with('error', 'An error occured while adding the role: ' . $e->getMessage());
        }
    }

    // =====================================
    // SAFE DELETE METHODS (BULLETPROOF)
    // =====================================

    public function destroyRole(Role $role)
    {
        try {
            if (strtolower($role->name) === 'admin' || strtolower($role->name) === 'super admin') {
                return back()->with('error', 'Cannot delete core system roles.');
            }

            if (DB::table('users')->where('role_id', $role->id)->exists()) {
                return back()->with('error', 'Cannot delete this Role because it is assigned to existing or archived employees. Reassign them first.');
            }
            
            $role->delete();
            return back()->with('success', 'Role deleted successfully.');
        } catch (\Throwable $e) {
            return back()->with('error', 'Database restriction: Cannot delete this role. It is still tied to other records.');
        }
    }

    public function destroyDepartment(Department $department)
    {
        try {
            if (DB::table('users')->where('department_id', $department->id)->exists()) {
                return back()->with('error', 'Cannot delete this Department because it has employees assigned to it.');
            }
            
            if (DB::table('positions')->where('department_id', $department->id)->exists()) {
                return back()->with('error', 'Cannot delete this Department because it has positions attached to it. Delete the positions first.');
            }
            
            $department->delete();
            return back()->with('success', 'Department deleted successfully.');
        } catch (\Throwable $e) {
            return back()->with('error', 'Database restriction: Cannot delete this department.');
        }
    }

    public function destroyPosition(Position $position)
    {
        try {
            if (DB::table('users')->where('position_id', $position->id)->exists()) {
                return back()->with('error', 'Cannot delete this Position because it is assigned to existing or archived employees.');
            }
            
            $position->delete();
            return back()->with('success', 'Position deleted successfully.');
        } catch (\Throwable $e) {
            return back()->with('error', 'Database restriction: Cannot delete this position.');
        }
    }

    public function destroyBranch(Branch $branch)
    {
        try {
            if (DB::table('branch_user')->where('branch_id', $branch->id)->exists()) {
                return back()->with('error', 'Cannot delete this Branch because it is assigned to existing employees.');
            }
            
            DB::table('announcement_branch')->where('branch_id', $branch->id)->delete();
            
            $branch->delete();
            return back()->with('success', 'Branch deleted successfully.');
        } catch (\Throwable $e) {
            return back()->with('error', 'Database restriction: Cannot delete this branch.');
        }
    }

    // ----------------Edit, Device Reset, and User Delete functions ----------------

    public function updateUser(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $user->id,
            'role_id' => 'required|exists:roles,id',
            'department_id' => 'required|exists:departments,id',
            'position_id' => 'required|exists:positions,id',
            'device_limit' => 'nullable|integer|min:1',
            'branch_ids' => 'required|array|min:1',
            'branch_ids.*' => 'exists:branches,id',
        ]);

        try {
            // Check if the assigned role is an Admin
            $role = Role::find($request->role_id);
            $isAdmin = $role && (strtolower($role->name) === 'admin' || strtolower($role->name) === 'super admin');
            
            // Force device limit to max 2 if not an Admin
            $device_limit = $request->device_limit;
            if (!$isAdmin && $device_limit > 2) {
                $device_limit = 2;
            }

           $user->update([
                'name' => trim($request->name),
                'email' => trim($request->email),
                'role_id' => $request->role_id,
                'department_id' => $request->department_id,
                'position_id' => $request->position_id,
                'device_limit'=> $device_limit, 
                'branch_id' => $request->branch_ids[0], 
                'is_rotating'=> count($request->branch_ids) > 1,
            ]);

            $user->branches()->sync($request->branch_ids);

            return redirect()->back()->with('success', 'Employee updated successfully.');
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'An error occurred while updating the employee: ' . $e->getMessage());
        }
    }

    public function resetDevice(User $user)
    {
        try {
            $user->authorized_device_ids = null;
            $user->save();
            return redirect()->back()->with('success', "Device successfully reset for {$user->name}.");
        } catch (\Exception $e) {
            return redirect()->back()->with('error', 'Failed to reset device: ' . $e->getMessage());
        }
    }

    public function destroy(User $user)
    {
        Log::info("Delete route hit for user ID: {$user->id}");

        try {
            if (Auth::id() === $user->id) {
                Log::warning("Admin attempted to delete themselves. ID: {$user->id}");
                return back()->with('error', 'You cannot delete your own admin account!');
            }

            Log::info("Detaching branches for user ID: {$user->id}");
            $user->branches()->detach();

            Log::info("Attempting to delete user ID: {$user->id} from database");
            $user->delete();

            Log::info("Successfully deleted user ID: {$user->id}");
            return back()->with('success', "Employee {$user->name} has been permanently deleted.");
            
        } catch (\Exception $e) {
            Log::error("Failed to delete user ID {$user->id}. Error: " . $e->getMessage() . " in " . $e->getFile() . " on line " . $e->getLine());
            
            return back()->with('error', 'Failed to delete user: ' . $e->getMessage());
        }
    }

    // ---------------- Export & Import Functions ----------------

    public function export(Request $request)
    {
        return Excel::download(
            new UsersExport($request->search, $request->department, $request->branch), 
            'employees_export_' . now()->format('Ymd_His') . '.xlsx'
        );
    }

    public function downloadTemplate()
    {
        return Excel::download(new UsersTemplateExport, 'employee_import_template.xlsx');
    }

    public function import(Request $request)
    {
        $request->validate(['import_file' => 'required|mimes:xlsx,xls,csv|max:10240']);
        
        try {
            Excel::import(new UsersImport, $request->file('import_file'));
            
            return back()->with('success', 'Employees imported successfully.');
            
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to import. Please check your Excel format.');
        }
    }

    public function sendActivationLink(User $user)
    {
        // FIX: Check Status instead of checking if password exists
        if ($user->status !== 'Pending Setup') {
            return back()->with('error', 'This account is already active. Send a password reset link instead.');
        }

        /** @var \Illuminate\Auth\Passwords\PasswordBroker $broker */
        $broker = Password::broker();
        $token = $broker->createToken($user);
        
        $user->notify(new AccountActivation($token));

        return back()->with('success', 'Activation link sent to ' . $user->email);
    }

    public function sendResetLink(User $user)
    {
        /** @var \Illuminate\Auth\Passwords\PasswordBroker $broker */
        $broker = Password::broker();
        $token = $broker->createToken($user);
        
        $user->notify(new AdminPasswordReset($token));
        $user->status = 'Password Reset';
        $user->save();

        return back()->with('success', 'Password reset link sent to ' . $user->email);
    }

    public function toggleStatus(User $user)
    {
        try {
            if ($user->status === 'Disabled') {
                $user->status = 'Active';
                $message = "Access re-enabled for {$user->name}.";
            } else {
                $user->status = 'Disabled';
                $message = "Account disabled for {$user->name}.";
            }
            
            $user->save();
            
            return back()->with('success', $message);
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to change user status: ' . $e->getMessage());
        }
    }

    // =====================================
    // BULK ACTION METHODS
    // =====================================

    public function bulkDestroy(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:users,id'
        ]);

        try {
            $users = User::whereIn('id', $request->ids)->get();
            $deletedCount = 0;

            foreach ($users as $user) {
                // Prevent admin from deleting themselves in a bulk action
                if (Auth::id() === $user->id) {
                    Log::warning("Admin attempted to bulk-delete themselves. ID: {$user->id}");
                    continue; 
                }

                // Detach branches before deleting, matching your single delete logic
                $user->branches()->detach();
                $user->delete();
                $deletedCount++;
            }

            Log::info("Successfully bulk deleted {$deletedCount} users.");
            return back()->with('success', "{$deletedCount} selected employees have been permanently deleted.");
            
        } catch (\Exception $e) {
            Log::error("Failed during bulk delete. Error: " . $e->getMessage());
            return back()->with('error', 'Failed to delete selected users: ' . $e->getMessage());
        }
    }

    public function bulkToggleStatus(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:users,id'
        ]);

        try {
            $users = User::whereIn('id', $request->ids)->get();

            foreach ($users as $user) {
                $user->status = $user->status === 'Disabled' ? 'Active' : 'Disabled';
                $user->save();
            }

            return back()->with('success', 'Status toggled for ' . $users->count() . ' selected employees.');
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to toggle status: ' . $e->getMessage());
        }
    }

    public function bulkResetDevice(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:users,id'
        ]);

        try {
            // Nullify the authorized_device_ids column matching your single reset method
            User::whereIn('id', $request->ids)->update([
                'authorized_device_ids' => null 
            ]);

            return back()->with('success', "Devices successfully reset for " . count($request->ids) . " employees.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to reset devices: ' . $e->getMessage());
        }
    }

    public function bulkSendLinks(Request $request)
    {
        $request->validate([
            'ids' => 'required|array',
            'ids.*' => 'exists:users,id'
        ]);

        try {
            $users = User::whereIn('id', $request->ids)->get();
            $broker = Password::broker();
            $sentCount = 0;

            foreach ($users as $user) {
                $token = $broker->createToken($user);

                // FIX: Check Status instead of checking if password exists
                if ($user->status !== 'Pending Setup') {
                    $user->notify(new AdminPasswordReset($token));
                    $user->status = 'Password Reset';
                    $user->save();
                } else {
                    $user->notify(new AccountActivation($token));
                }
                
                $sentCount++;

                // Pause script for 1 second between emails to respect Mailtrap rate limits
                if ($sentCount < $users->count()) {
                    sleep(1); 
                }
            }

            return back()->with('success', "Activation/Reset links sent to {$sentCount} selected employees.");
        } catch (\Exception $e) {
            return back()->with('error', 'Failed to send bulk links: ' . $e->getMessage());
        }
    }
}