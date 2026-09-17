<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class POStatusUpdate extends Notification
{
    use Queueable;

    public $po;
    public $statusMessage;

    public function __construct($po, $statusMessage)
    {
        $this->po = $po;
        $this->statusMessage = $statusMessage;
    }

    public function via($notifiable)
    {
        return ['database'];
    }

    public function toArray($notifiable)
    {
        // Safely grab the supplier name if it exists
        $supplierName = $this->po->supplier->name ?? 'Supplier';

        // 🟢 Safely check the receiving user's role
        $userRole = strtolower(trim($notifiable->role->name ?? ''));
        $allowedRoles = ['procurement assist', 'procurement tl','president', 'director of corporate services and operations', 'admin', 'operations manager', 'inventory assist', 'inventory tl'];

        // 🟢 Dynamically set the URL
        $actionUrl = in_array($userRole, $allowedRoles) 
            ? route('prpo.purchase-orders.index') 
            : route('prpo.status.index');

        return [
            'message' => '📦 PO Update: ' . $this->po->po_number,
            'user_email' => $this->statusMessage . ' (' . $supplierName . ')',
            'action_url' => $actionUrl 
        ];
    }
}