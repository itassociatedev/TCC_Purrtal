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

            // Asset Management Module
            \App\Models\Asset::class => 'Asset Management Module',

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
        // Special handling for Assets to include asset_tag in description
        if ($model instanceof \App\Models\Asset) {
            $description = "Created new asset: {$model->asset_tag} ({$model->name}).";
        } else {
            // Try to find a name or title to make the log more readable
            $description = "Created " . ($model->name ?? $model->title ?? $model->label ?? "a record") . " in " . $this->getModuleName($model);
        }

        $userId = $this->determineUserId($model);

        LoggerService::log(
            $this->getModuleName($model),
            'Create',
            $description,
            'success',
            $userId
        );
    }

    /**
     * Handle the Model "updated" event.
     */
    public function updated(Model $model): void
    {
        // Special handling for Assets to include asset_tag in description
        if ($model instanceof \App\Models\Asset) {
            $description = "Updated asset: {$model->asset_tag}.";
        } elseif ($model instanceof \App\Models\User) {
            // 🟢 THE FIX: Ignore background authentication changes for Users!
            // Get an array of columns that actually changed during this update
            $changedColumns = array_keys($model->getChanges());

            // Define the background columns that should NOT trigger a system log
            $ignoredColumns = [
                'remember_token',
                'updated_at',
                'last_login_at',
                'failed_login_attempts'
            ];

            // Remove the ignored columns from the list of changed columns
            $actualChanges = array_diff($changedColumns, $ignoredColumns);

            // If the array is empty, it means ONLY background columns were changed.
            // We stop the observer right here so no false log is created.
            if (empty($actualChanges)) {
                return;
            }
        }

        // Check if the record is being "Updated" or if it's specifically a "Status Change"
        $module = $this->getModuleName($model);

        // Skip description building if we already set it for Asset
        if (!($model instanceof \App\Models\Asset)) {
            $identifier = $model->name ?? $model->title ?? $model->label ?? "record";
            $description = "Updated $identifier in $module";

            // Capture specific status changes for HR/PRPO workflows
            if ($model->wasChanged('status')) {
                $description = "Status of $identifier changed to: " . strtoupper($model->status);
            }
        }

        $userId = $this->determineUserId($model);
        LoggerService::log($module, 'Update', $description, 'warning', $userId);
    }

    /**
     * Handle the Model "deleted" event.
     */
    public function deleted(Model $model): void
    {
        // Special handling for Assets to include asset_tag in description
        if ($model instanceof \App\Models\Asset) {
            $description = "Deleted asset: {$model->asset_tag}.";
        } else {
            $description = "Deleted " . ($model->name ?? $model->title ?? $model->label ?? "a record") . " from " . $this->getModuleName($model);
        }

        $userId = $this->determineUserId($model);

        LoggerService::log(
            $this->getModuleName($model),
            'Delete',
            $description,
            'danger',
            $userId
        );
    }
}