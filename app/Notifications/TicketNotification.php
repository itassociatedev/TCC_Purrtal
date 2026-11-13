<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class TicketNotification extends Notification
{
    // Store a small payload for the existing notification bell. The controller
    // decides recipients and suppresses all notifications during preview.
    public function __construct(public int $ticketId, public string $message, public string $actionRoute = 'tickets.dashboard') {}

    public function via($notifiable): array { return ['database']; }

    public function toArray($notifiable): array
    {
        // action_url matches the link field consumed by SidebarLayout.
        return [
            'module' => 'ticketing',
            'ticket_id' => $this->ticketId,
            'message' => $this->message,
            'action_url' => route($this->actionRoute ?? 'tickets.dashboard'),
        ];
    }
}
