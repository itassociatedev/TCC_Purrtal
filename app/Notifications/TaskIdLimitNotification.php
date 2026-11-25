<?php
namespace App\Notifications;
use Illuminate\Notifications\Notification;
class TaskIdLimitNotification extends Notification
{
    public function __construct(public string $series) {}
    public function via(object $notifiable): array { return ['database']; }
    public function toArray(object $notifiable): array { return ['module'=>'Task Module','message'=>"Task ID limit reached for {$this->series}. Update the ID format in Workspace Setup before creating more tasks.",'action_url'=>url('/task-module?view=Workspace%20Setup')]; }
}
