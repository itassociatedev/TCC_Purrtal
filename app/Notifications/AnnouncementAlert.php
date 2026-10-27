<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class AnnouncementAlert extends Notification
{
    use Queueable;

    public $title;
    public $authorName;
    public $announcementId;

    // We pass the title of the announcement and who posted it
    public function __construct($title, $authorName = 'Admin', $announcementId = null)
    {
        $this->title = $title;
        $this->authorName = $authorName;
        $this->announcementId = $announcementId;
    }

    // 🟢 Strictly In-App Notification
    public function via($notifiable)
    {
        return ['database'];
    }

    // 🟢 What shows up in the React Bell Icon
    public function toArray($notifiable)
    {
        return [
            'message' => '📢 New Announcement: ' . $this->title,
            'user_email' => 'Posted by ' . $this->authorName,
            
            // Opens the announcement directly (Dashboard page reads ?open=)
            'action_url' => route('dashboard.announcements', $this->announcementId ? ['open' => $this->announcementId] : [])
        ];
    }
}