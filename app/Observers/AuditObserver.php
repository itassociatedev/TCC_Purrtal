<?php

namespace App\Observers;

use App\Services\LoggerService;
use Illuminate\Database\Eloquent\Model;

class AuditObserver
{
    /**
     * Map the model class to its readable module name for the logs.
     */
    private function getModuleName(Model $model)
    {
        return match (get_class($model)) {
            // Admin & Employee
            \App\Models\User::class => 'Employee Management',
            \App\Models\Announcement::class => 'Announcements',
            \App\Models\CompanyContent::class => 'Company Content',
            \App\Models\OrgChartMember::class => 'Organizational Chart',

            // THE DOCUMENT MODELS HERE:
            \App\Models\Document::class => 'Document Repository',
            \App\Models\DocumentCategory::class => 'Document Repository',

            // HR Module
            \App\Models\HrRequest::class => 'HR Module',
            \App\Models\ManpowerRequest::class => 'HR Module',

            // PR/PO Module
            \App\Models\Product::class => 'PR/PO Module',
            \App\Models\PurchaseRequest::class => 'PR/PO Module',
            \App\Models\PurchaseOrder::class => 'PR/PO Module',
            \App\Models\Supplier::class => 'PR/PO Module',

            // Duty Meal Module
            \App\Models\DutyMeal::class => 'Duty Meal Module', 
            
            default => 'System',
        };
    }

    /**
     * Determine the correct User ID for the log.
     * Useful for actions performed by users who aren't fully logged in yet.
     */
    private function determineUserId(Model $model)
    {
        if (auth()->check()) {
            return auth()->id();
        }

        // If not logged in, but the model being manipulated is a User, use that User's ID
        if ($model instanceof \App\Models\User) {
            return $model->id;
        }

        return null;
    }

    /**
     * Handle the Model "created" event.
     */
    public function created(Model $model): void
    {
        // Try to find a name or title to make the log more readable
        $identifier = $model->name ?? $model->title ?? $model->label ?? "a record";
        $userId = $this->determineUserId($model);
        
        LoggerService::log(
            $this->getModuleName($model), 
            'Create', 
            "Created $identifier in " . $this->getModuleName($model),
            'success',
            $userId
        );
    }

    /**
     * Handle the Model "updated" event.
     */
    public function updated(Model $model): void
    {
        // Check if the record is being "Updated" or if it's specifically a "Status Change"
        $module = $this->getModuleName($model);
        $identifier = $model->name ?? $model->title ?? $model->label ?? "record";
        $userId = $this->determineUserId($model);
        
        $description = "Updated $identifier in $module";
        
        // Capture specific status changes for HR/PRPO workflows
        if ($model->wasChanged('status')) {
            $description = "Status of $identifier changed to: " . strtoupper($model->status);
        }

        LoggerService::log($module, 'Update', $description, 'warning', $userId);
    }

    /**
     * Handle the Model "deleted" event.
     */
    public function deleted(Model $model): void
    {
        $identifier = $model->name ?? $model->title ?? $model->label ?? "a record";
        $userId = $this->determineUserId($model);
        
        LoggerService::log(
            $this->getModuleName($model), 
            'Delete', 
            "Deleted $identifier from " . $this->getModuleName($model), 
            'danger',
            $userId
        );
    }
}