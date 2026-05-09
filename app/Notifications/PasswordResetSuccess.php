<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;
use App\Models\User; // <-- Added this import

class PasswordResetSuccess extends Notification
{
    use Queueable;

    public $user;

    // Added 'User' here to ensure the data passed is always a User model
    public function __construct(User $user)
    {
        $this->user = $user;
    }

    // This tells Laravel to send this to the database (for your React notification bell)
    public function via($notifiable)
    {
        return ['database'];
    }

    // This shapes the data exactly how your SidebarLayout.jsx expects it!
    public function toArray($notifiable)
    {
        return [
            'message' => '✅ Password Updated',
            'user_email' => $this->user->name . ' has successfully reset their password.',
            'action_url' => route('login') 
        ];
    }
}