<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class ScheduleAssigned extends Notification
{
    use Queueable;

    protected $message;

    public function __construct($message)
    {
        $this->message = $message;
    }

    public function via($notifiable)
    {
        return ['database']; // You can add 'mail' here later if you want email alerts!
    }

    public function toDatabase($notifiable)
    {
        return [
            'title' => 'Schedule Update',
            'message' => $this->message,
            'url' => route('attendance.calendar'), // Clicking the notification takes them to their calendar
            'icon' => 'calendar'
        ];
    }
}