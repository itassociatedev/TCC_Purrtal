<?php

namespace App\Providers;

use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Event;

// Security Events
use Illuminate\Auth\Events\Failed;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Auth\Events\PasswordReset;

// Models to Observe
use App\Models\User;
use App\Models\Announcement;
use App\Models\CompanyContent;
use App\Models\OrgChartMember; // <-- Make sure this is imported!

// Add other models like HrRequest if you have created them

// The Observer and Logger
use App\Observers\AuditObserver;
use App\Services\LoggerService;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        \Illuminate\Support\Facades\Vite::prefetch(concurrency: 3);

        // Existing Observers
        \App\Models\User::observe(\App\Observers\AuditObserver::class);
        \App\Models\Announcement::observe(\App\Observers\AuditObserver::class);
        \App\Models\CompanyContent::observe(\App\Observers\AuditObserver::class);

        // 🟢 NEW: Document Repository Module
        \App\Models\Document::observe(\App\Observers\AuditObserver::class);
        \App\Models\DocumentCategory::observe(\App\Observers\AuditObserver::class);
        
        // 🟢 NEW: Organizational Chart
        \App\Models\OrgChartMember::observe(\App\Observers\AuditObserver::class); 

        // 🟢 NEW: HR Module
        \App\Models\HrRequest::observe(\App\Observers\AuditObserver::class);
        \App\Models\ManpowerRequest::observe(\App\Observers\AuditObserver::class);

        // 🟢 NEW: PR/PO Module
        \App\Models\Product::observe(\App\Observers\AuditObserver::class);
        \App\Models\PurchaseRequest::observe(\App\Observers\AuditObserver::class);
        \App\Models\PurchaseOrder::observe(\App\Observers\AuditObserver::class);

        // 🟢 NEW: Duty Meal Module
        \App\Models\DutyMeal::observe(\App\Observers\AuditObserver::class); 
    }
}