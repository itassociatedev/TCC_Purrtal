<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class DeletionRequestNotification extends Notification
{
    use Queueable;

    protected $message;
    protected $module;
    protected $ids;

    public function __construct($message, $module = 'PR', $ids = [])
    {
        $this->message = $message;
        $this->module = $module;
        $this->ids = $ids;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toArray($notifiable)
    {
        // Build the URL that passes the IDs to the frontend
        $url = $this->module === 'PR'
            ? route('prpo.approval-board', ['view' => 'deletion_request', 'pending_delete' => implode(',', $this->ids)])
            : route('prpo.purchase-orders.index', ['view' => 'deletion_request', 'pending_delete' => implode(',', $this->ids)]);

        // Dynamically set the title and icon based on the module
        $title = $this->module === 'PR'
            ? '🗑️ PR Deletion Request'
            : '🗑️ PO Deletion Request';

        return [
            'message' => $title,                  // Maps to the bold title with the icon
            'user_email' => $this->message,       // Maps to the gray descriptive subtext
            'action_url' => $url,                 // Ensures the notification is clickable
            'type' => 'deletion_request',
            'module' => $this->module
        ];
    }
}
