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

        $url = $this->module === 'PR'
            ? route('prpo.approval-board', ['view' => 'deletion_request', 'pending_delete' => implode(',', $this->ids)])
            : route('prpo.purchase-orders.index', ['view' => 'deletion_request', 'pending_delete' => implode(',', $this->ids)]);

        $title = $this->module === 'PR'
            ? '🗑️ PR Deletion Request'
            : '🗑️ PO Deletion Request';

        return [
            'message' => $title,
            'user_email' => $this->message,
            'action_url' => $url,
            'type' => 'deletion_request',
            'module' => $this->module
        ];
    }
}
