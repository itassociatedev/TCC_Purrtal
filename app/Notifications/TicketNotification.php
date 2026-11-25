<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class TicketNotification extends Notification
{
    // Store ticket alerts for the dedicated IT bell, separate from regular portal alerts.
    // Callers choose recipients; TicketSla suppresses messages for preview tickets.
    public function __construct(public int $ticketId, public string $message, public string $actionRoute = 'tickets.dashboard') {}

    public function via($notifiable): array { return ['database']; }

    public function toArray($notifiable): array
    {
        // Keep actionRoute in the constructor for older callers; all ticket alerts now
        // open the existing details dialog through a server-authorized numeric deep link.
        return [
            'module' => 'ticketing',
            'ticket_id' => $this->ticketId,
            'message' => $this->message,
            'action_url' => route('tickets.all', ['selected_ticket' => $this->ticketId]),
        ];
    }
}
