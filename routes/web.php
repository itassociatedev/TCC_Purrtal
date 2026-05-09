<?php

use App\Models\Announcement;
use App\Models\CompanyContent;
use App\Models\ResourceLink;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\Admin\EmployeeController;
use App\Http\Controllers\Admin\CompanyContentController;
use App\Http\Controllers\Admin\SystemLogController;
use App\Http\Controllers\Admin\ResourceLinkController;
use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\CheckDutyMealAccess;
use App\Http\Controllers\Admin\DocumentController;
use App\Http\Controllers\Admin\AnnouncementController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\Admin\DutyMealController;
use App\Http\Controllers\Admin\OrgChartController;
use App\Http\Controllers\HrRequestController;
use App\Http\Controllers\HR\ManpowerRequestController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\Auth\LinkExpired;
use App\Http\Controllers\SupplierController;
use App\Http\Controllers\PurchaseOrderController;
use App\Http\Controllers\PurchaseRequestController;
use App\Http\Controllers\Auth\SetupAccountController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\PRPOStatusController;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('Auth/Login', []);
});

Route::post('/forgot-password-notify', [AuthenticatedSessionController::class, 'requestPasswordReset'])
    ->name('password.request.admin');

Route::middleware(['auth', 'verified'])->group(function () {

    // --- HR MODULE (User Requests) ---
    Route::get('/hr-module', [HrRequestController::class, 'index'])->name('hr.index');
    Route::post('/hr-module/request', [HrRequestController::class, 'store'])->name('hr.store');
    
    // --- HR MODULE (Admin Management) --- 
    Route::get('/hr-module/admin', [HrRequestController::class, 'adminIndex'])->name('hr.admin.index');
    Route::patch('/hr-module/admin/{hrRequest}/status', [HrRequestController::class, 'updateStatus'])->name('hr.admin.update-status');

    // --- NEW: HR MODULE (Accounting Approvals) ---
    Route::get('/hr-module/accounting-approvals', [HrRequestController::class, 'accountingApprovals'])->name('hr.accounting.index');
    Route::patch('/hr-module/accounting-approvals/{hrRequest}/status', [HrRequestController::class, 'updateAccountingStatus'])->name('hr.accounting.update');

    // --- OVERVIEW DASHBOARD ---
    Route::get('/dashboard', function () {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));
        $isGlobalViewer = $userRole === 'admin' || str_contains($userRole, 'director');

        $query = App\Models\Announcement::with(['priorityLevel', 'branches'])->latest();

        if (!$isGlobalViewer) {
            $branchIds = [$user->branch_id];
            
            $rotating = Illuminate\Support\Facades\DB::table('branch_user')
                ->where('user_id', $user->id)
                ->pluck('branch_id')
                ->toArray();
            
            $allowedBranchIds = array_values(array_unique(array_filter(array_merge($branchIds, $rotating))));

            \Illuminate\Support\Facades\Log::info('OVERVIEW RENDERED - Security Check:', [
                'user' => $user->name,
                'role' => $userRole,
                'allowed_branches' => $allowedBranchIds
            ]);

            if (empty($allowedBranchIds)) {
                $query->where('id', 0); 
            } else {
                $query->whereHas('branches', function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branches.id', $allowedBranchIds); 
                });
            }
        }

        return Inertia::render('Overview', [
            'announcements' => $query->get(),
            'contents' => CompanyContent::all()
        ]);
    })->name('dashboard'); 


    // --- ANNOUNCEMENTS BOARD ---
    Route::get('/dashboard/announcements', function () {
        $user = Auth::user();
        $userRole = strtolower(trim($user->role->name ?? ''));
        $isGlobalViewer = $userRole === 'admin' || str_contains($userRole, 'director');

        $query = App\Models\Announcement::with(['priorityLevel', 'branches'])->latest();

        if (!$isGlobalViewer) {
            $branchIds = [$user->branch_id];
            $rotating = Illuminate\Support\Facades\DB::table('branch_user')->where('user_id', $user->id)->pluck('branch_id')->toArray();
            $allowedBranchIds = array_values(array_unique(array_filter(array_merge($branchIds, $rotating))));

            if (empty($allowedBranchIds)) {
                $query->where('id', 0); 
            } else {
                $query->whereHas('branches', function ($q) use ($allowedBranchIds) {
                    $q->whereIn('branches.id', $allowedBranchIds); 
                });
            }
        }

        return Inertia::render('Dashboard', [
            'announcements' => $query->get()
        ]);
    })->name('dashboard.announcements');

    // --- MISSION & VISION ---
    Route::get('/dashboard/mission-vision', function () {
        $contents = CompanyContent::all();

        return Inertia::render('MissionVision', [
            'contents' => $contents
        ]);
    })->name('dashboard.mission-vision');

    // --- UPDATED: RESOURCES LINKS ---
    Route::get('/resources/internal-links', function () {
        $links = ResourceLink::where('type', 'internal')
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc') // Automatically sort using drag-and-drop order
            ->get();
            
        return Inertia::render('Resources/InternalLinks', [
            'links' => $links
        ]);
    })->name('resources.internal');

    Route::get('/resources/external-links', function () {
        $links = ResourceLink::where('type', 'external')
            ->where('is_active', true)
            ->orderBy('sort_order', 'asc') // Automatically sort using drag-and-drop order
            ->get();
            
        return Inertia::render('Resources/ExternalLinks', [
            'links' => $links
        ]);
    })->name('resources.external');

    // --- ORGANIZATIONAL CHART (USER VIEW) ---
    Route::get('/dashboard/org-chart', [OrgChartController::class, 'userIndex'])->name('dashboard.org-chart');

    Route::get('/admin/documents', [DocumentController::class, 'index'])->name('admin.documents.index');
    Route::get('/documents/{document}/view/{filename?}', [DocumentController::class, 'show'])->name('documents.show');
});


Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    // Staff Duty Meal Routes
    Route::get('/my-duty-meals', [\App\Http\Controllers\Staff\DutyMealController::class, 'index'])->name('staff.duty-meals.index');
    Route::patch('/my-duty-meals/{participantId}/choice', [\App\Http\Controllers\Staff\DutyMealController::class, 'updateChoice'])->name('staff.duty-meals.choice');
    Route::post('/duty-meals/bulk-lock-in', [App\Http\Controllers\Staff\DutyMealController::class, 'bulkLockIn'])
    ->name('staff.duty-meals.bulk-lock-in');

    Route::post('/notifications/{id}/mark-as-read', function (Request $request, $id) {
        $user = $request->user();
        if ($user) {
            $notification = $user->notifications()->findOrFail($id);
            $notification->markAsRead();
        }
        return back();
    })->middleware('auth')->name('notifications.read');

    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead'])->name('notifications.mark-all-read');
});

Route::get('/notifications/load-more', [NotificationController::class, 'loadMore'])->name('notifications.load-more');

Route::middleware(['auth', AdminMiddleware::class])->prefix('admin')->name('admin')->group(function(){

    Route::get('/logs', [SystemLogController::class, 'index'])->name('.logs.index');
    Route::get('/logs/export', [SystemLogController::class, 'export'])->name('.logs.export');
    
    Route::get('/dashboard', function(){
        $totalActiveEmployees = \App\Models\User::whereIn('status', ['Active', 'Password reset'])->count();
        $totalBranches = \App\Models\Branch::count();

        $activeSessions = DB::table('sessions')
            ->whereNotNull('user_id')
            ->where('last_activity', '>=', now()->subMinutes(15)->getTimestamp())
            ->distinct('user_id')
            ->count('user_id');

        return Inertia::render('Admin/AdminDashboard', [
            'totalActiveEmployees' => $totalActiveEmployees,
            'totalBranches' => $totalBranches,
            'activeSessions' => $activeSessions,
        ]);
    })->name('.dashboard');

    // EMPLOYEE MANAGEMENT ROUTES
    Route::get('/employees', [EmployeeController::class, 'index'])->name('.employees');
    Route::post('/positions', [EmployeeController::class, 'storePosition'])->name('.positions.store');
    Route::post('/branches', [EmployeeController::class, 'storeBranch'])->name('.branches.store');
    Route::post('/departments', [EmployeeController::class, 'storeDepartment'])->name('.departments.store');
    Route::post('/roles', [EmployeeController::class, 'storeRole'])->name('.roles.store');
    Route::post('/users', [EmployeeController::class, 'storeUser'])->name('.users.store');
    
    Route::put('/users/{user}', [EmployeeController::class, 'updateUser'])->name('.users.update');
    Route::patch('/users/{user}/reset-device', [EmployeeController::class, 'resetDevice'])->name('.users.reset-device');
    Route::patch('/users/{user}/toggle-status', [EmployeeController::class, 'toggleStatus'])->name('.users.toggle-status');

    Route::post('/users/bulk-send-links', [EmployeeController::class, 'bulkSendLinks'])->name('.users.bulk-send-links');
    Route::patch('/users/bulk-reset-device', [EmployeeController::class, 'bulkResetDevice'])->name('.users.bulk-reset-device');
    Route::patch('/users/bulk-toggle-status', [EmployeeController::class, 'bulkToggleStatus'])->name('.users.bulk-toggle-status');
    Route::delete('/users/bulk-destroy', [EmployeeController::class, 'bulkDestroy'])->name('.users.bulk-destroy');
    
    Route::delete('/users/{user}', [EmployeeController::class, 'destroy'])->name('.users.destroy');
    Route::delete('/departments/{department}', [EmployeeController::class, 'destroyDepartment'])->name('.departments.destroy');
    Route::delete('/roles/{role}', [EmployeeController::class, 'destroyRole'])->name('.roles.destroy');
    Route::delete('/positions/{position}', [EmployeeController::class, 'destroyPosition'])->name('.positions.destroy');
    Route::delete('/branches/{branch}', [EmployeeController::class, 'destroyBranch'])->name('.branches.destroy');

    Route::get('/employees/export', [EmployeeController::class, 'export'])->name('.employees.export');
    Route::get('/employees/import-template', [EmployeeController::class, 'downloadTemplate'])->name('.employees.template');
    Route::post('/employees/import', [EmployeeController::class, 'import'])->name('.employees.import');

    Route::get('/company-content', [CompanyContentController::class, 'index'])->name('.company-content.index');
    Route::post('/company-content', [CompanyContentController::class, 'store'])->name('.company-content.store');
    Route::put('/company-content/{companyContent}', [CompanyContentController::class, 'update'])->name('.company-content.update');
    Route::delete('/company-content/{companyContent}', [CompanyContentController::class, 'destroy'])->name('.company-content.destroy');
    
    Route::post('/company-content/type', [CompanyContentController::class, 'storeType'])->name('.company-content.type.store');
    Route::put('/company-content/type/{type}', [CompanyContentController::class, 'updateType'])->name('.company-content.type.update');
    Route::delete('/company-content/type/{type}', [CompanyContentController::class, 'destroyType'])->name('.company-content.type.destroy');

    Route::get('/announcements', [AnnouncementController::class, 'index'])->name('.announcements.index');
    Route::post('/announcements', [AnnouncementController::class, 'store'])->name('.announcements.store');
    Route::put('/announcements/{announcement}', [AnnouncementController::class, 'update'])->name('.announcements.update');
    Route::delete('/announcements/{announcement}', [AnnouncementController::class, 'destroy'])->name('.announcements.destroy');
    Route::post('/announcements/priority', [AnnouncementController::class, 'storePriority'])->name('.announcements.priority.store');
    Route::put('/announcements/priority/{priority}', [AnnouncementController::class, 'updatePriority'])->name('.announcements.priority.update');
    Route::delete('/announcements/priority/{priority}', [AnnouncementController::class, 'destroyPriority'])->name('.announcements.priority.destroy');

    Route::post('/org-chart/asset', [OrgChartController::class, 'storeAsset'])->name('.org-chart.asset.store');
    Route::get('/org-chart', [OrgChartController::class, 'index'])->name('.org-chart.index');
    Route::post('/org-chart/structure', [OrgChartController::class, 'saveStructure'])->name('.org-chart.structure.save'); 
    Route::post('/org-chart', [OrgChartController::class, 'store'])->name('.org-chart.store');
    Route::put('/org-chart/{member}', [OrgChartController::class, 'update'])->name('.org-chart.update');
    Route::post('/org-chart/reorder', [OrgChartController::class, 'reorder'])->name('.org-chart.reorder'); 
    Route::delete('/org-chart/{member}', [OrgChartController::class, 'destroy'])->name('.org-chart.destroy');

    Route::post('/documents', [DocumentController::class, 'store'])->name('.documents.store');
    Route::put('/documents/{document}', [DocumentController::class, 'update'])->name('.documents.update');
    Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('.documents.destroy');
    
    Route::post('/documents/category', [DocumentController::class, 'storeCategory'])->name('.documents.category.store');
    Route::patch('/documents/category/{id}', [DocumentController::class, 'updateCategory'])->name('.documents.category.update'); 
    Route::delete('/documents/category/{id}', [DocumentController::class, 'destroyCategory'])->name('.documents.category.destroy');
    Route::patch('/documents/category/{id}/toggle-downloadable', [DocumentController::class, 'toggleDownloadable'])->name('.documents.category.toggle-downloadable');

    // RESOURCE LINKS ADMIN ROUTES
    Route::post('/resource-links/reorder', [ResourceLinkController::class, 'reorder'])->name('.resource-links.reorder');
    Route::get('/resource-links', [ResourceLinkController::class, 'index'])->name('.resource-links.index');
    Route::post('/resource-links', [ResourceLinkController::class, 'store'])->name('.resource-links.store');
    Route::put('/resource-links/{resourceLink}', [ResourceLinkController::class, 'update'])->name('.resource-links.update');
    Route::delete('/resource-links/{resourceLink}', [ResourceLinkController::class, 'destroy'])->name('.resource-links.destroy');
});

Route::middleware(['auth'])->group(function () {
    Route::post('/employees/{user}/send-activation', [EmployeeController::class, 'sendActivationLink'])->name('employees.send-activation');
    Route::post('/employees/{user}/send-reset', [EmployeeController::class, 'sendResetLink'])->name('employees.send-reset');
});

Route::middleware(['guest'])->group(function () {
    Route::get('/setup-account', [SetupAccountController::class, 'showSetupForm'])->name('setup.account');
    Route::post('/setup-account', [SetupAccountController::class, 'setupPassword'])->name('setup.account.store');
    
    Route::get('/reset-password', [PasswordResetLinkController::class, 'showResetForm'])->name('password.reset-link');
    Route::post('/reset-password', [PasswordResetLinkController::class, 'resetPassword'])->name('password.reset-link.store');

    Route::get('/link-expired', [LinkExpired::class, 'index'])->name('link.expired');
});

Route::middleware(['auth', CheckDutyMealAccess::class])->group(function () {
    Route::get('/admin/duty-meals', [DutyMealController::class, 'index'])->name('admin.duty-meals.index');
    Route::get('/admin/duty-meals/create', [DutyMealController::class, 'create'])->name('admin.duty-meals.create');
    Route::post('/admin/duty-meals', [DutyMealController::class, 'store'])->name('admin.duty-meals.store');
    Route::patch('admin/duty-meals/{id}/update-meals', [DutyMealController::class, 'updateMeals'])->name('admin.duty-meals.update-meals');
    Route::patch('admin/participants/{id}/update-choice', [DutyMealController::class, 'updateParticipantChoice'])->name('admin.participants.update-choice');
    Route::patch('admin/participants/{id}/update-shift', [DutyMealController::class, 'updateParticipantShift'])->name('admin.participants.update-shift');
    Route::delete('/admin/duty-meals/participants/{id}', [DutyMealController::class, 'removeParticipant'])->name('admin.participants.remove');
    Route::post('/duty-meals/{id}/add-participant', [DutyMealController::class, 'addParticipant'])->name('admin.duty-meals.add-participant');
    Route::get('/duty-meals/archive', [DutyMealController::class, 'archive'])->name('admin.duty-meals.archive');
    Route::delete('/duty-meals/{id}', [DutyMealController::class, 'destroy'])->name('admin.duty-meals.destroy');
    Route::post('/duty-meals/bulk-delete', [DutyMealController::class, 'bulkDelete'])->name('admin.duty-meals.bulk-delete');
    Route::get('/admin/duty-meals/export', [DutyMealController::class, 'export'])->name('admin.duty-meals.export');
});

Route::middleware(['auth'])->group(function(){
    Route::get('/hr/feedback', [\App\Http\Controllers\HR\FeedbackController::class, 'create'])->name('hr.feedback.create');
    Route::post('/hr/feedback', [\App\Http\Controllers\HR\FeedbackController::class, 'store'])->name('hr.feedback.store');
    Route::get('/prpo/status', [PRPOStatusController::class, 'index'])->name('prpo.status.index');

    Route::prefix('hr')->name('hr.')->group(function(){
        Route::middleware(['role:admin,HRBP,Chief Vet,Operations Manager,Director of Corporate Services and Operations,Marketing Manager,Vet Tech TL,IT TL,Cashier TL,Housekeeping TL,Inventory TL,Clinic Assistant TL,Procurement TL,Auditor TL'])->group(function(){
            Route::get('/manpower-requests/create', [ManpowerRequestController::class, 'create'])->name('manpower-requests.create');
            Route::post('/manpower-requests', [ManpowerRequestController::class, 'store'])->name('manpower-requests.store');
        });

        Route::middleware(['role:admin,HR,HRBP'])->group(function () {
            Route::get('/feedback-submissions', [\App\Http\Controllers\HR\FeedbackController::class, 'index'])->name('feedback.index');
        });
        
        Route::middleware(['role:admin,HR,HRBP,Director of Corporate Services and Operations,Chief Vet,Operations Manager,Marketing Manager,Vet Tech TL,IT TL,Cashier TL,Housekeeping TL,Inventory TL,Clinic Assistant TL,Procurement TL,Auditor TL'])->group(function () {
            Route::get('/manpower-requests', [ManpowerRequestController::class, 'index'])->name('manpower-requests.index');
            Route::patch('/manpower-requests/{manpowerRequest}/status', [ManpowerRequestController::class, 'updateStatus'])->name('manpower-requests.update-status');
        });
    });
});

Route::prefix('prpo')->name('prpo.')->middleware(['auth'])->group(function () {
    Route::get('/products', [ProductController::class, 'index'])->name('products.index');
    Route::get('/products/import-template', [ProductController::class, 'downloadTemplate'])->name('products.import-template');
    Route::post('/products/import', [ProductController::class, 'import'])->name('products.import');
    Route::get('/products/export', [ProductController::class, 'export'])->name('products.export');
    
    Route::post('/suppliers', [SupplierController::class, 'store'])->name('suppliers.store');
    Route::put('/suppliers/{supplier}', [SupplierController::class, 'update'])->name('suppliers.update');
    Route::delete('/suppliers/{supplier}', [SupplierController::class, 'destroy'])->name('suppliers.destroy');
    Route::patch('/suppliers/{supplier}/toggle-status', [SupplierController::class, 'toggleStatus'])->name('suppliers.toggle-status');
    Route::get('/suppliers/template', [SupplierController::class, 'downloadTemplate'])->name('suppliers.template');
    Route::post('/suppliers/import', [SupplierController::class, 'import'])->name('suppliers.import');

    Route::post('/products', [ProductController::class, 'store'])->name('products.store');
    Route::put('/products/{product}', [ProductController::class, 'update'])->name('products.update');
    Route::delete('/products/{product}', [ProductController::class, 'destroy'])->name('products.destroy');
    Route::post('/products/batch-destroy', [ProductController::class, 'batchDestroy'])->name('products.batch-destroy');
    Route::patch('/products/{product}/toggle-status', [ProductController::class, 'toggleStatus'])->name('products.toggle-status');

    Route::get('/purchase-request/create', [PurchaseRequestController::class, 'create'])->name('purchase-requests.create');
    Route::post('/purchase-request', [PurchaseRequestController::class, 'store'])->name('purchase-requests.store');
    Route::put('/purchase-requests/{id}', [PurchaseRequestController::class, 'update'])->name('purchase-requests.update');
    Route::get('/approval-board', [PurchaseRequestController::class, 'approvalBoard'])->name('approval-board');
    Route::patch('/purchase-requests/{purchaseRequest}/status', [PurchaseRequestController::class, 'updateStatus'])->name('purchase-requests.update-status');

    Route::post('/purchase-requests/{purchaseRequest}/generate-pos', [PurchaseOrderController::class, 'generateFromPR'])->name('purchase-requests.generate-pos');
    Route::get('/purchase-orders', [PurchaseOrderController::class, 'index'])->name('purchase-orders.index');
    Route::put('/purchase-orders/{purchaseOrder}', [PurchaseOrderController::class, 'update'])->name('purchase-orders.update');

    Route::get('/purchase-requests/{purchaseRequest}/print', [PurchaseRequestController::class, 'print'])->name('purchase-requests.print');
    Route::get('/purchase-orders/{purchaseOrder}/print', [PurchaseOrderController::class, 'print'])->name('purchase-orders.print');
});

require __DIR__.'/auth.php';