<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class TaskModuleEmail extends Notification implements ShouldQueue
{
    use Queueable;
    public function __construct(public array $task, public string $event, public string $actor, public string $mode)
    {
        $this->onConnection(config('task_module.queue_connection'));
        $this->onQueue(config('task_module.queue'));
        $this->afterCommit();
    }
    public function via(object $notifiable): array { return ['mail']; }
    public function shouldSend(object $notifiable, string $channel): bool
    {
        return !preg_match('/disabled|inactive|terminated/i', $notifiable->status ?? '') && (int) ($notifiable->id ?? 0) !== 380;
    }
    public function toMail(object $notifiable): MailMessage
    {
        $message = (new MailMessage)
            ->mailer($this->mode === 'send' ? config('task_module.mailer') : 'task-preview')
            ->subject('The Cat Clinic · '.$this->event.': '.$this->task['title'])
            ->greeting('Hello '.($notifiable->name ?? 'team member').',')
            ->line($this->event.' by '.$this->actor.'.')
            ->line('Task: '.$this->task['title'])
            ->line('Assigned to: '.($this->task['assignee'] ?? 'IT team'))
            ->line('Branch: '.$this->task['branch'].' · Department: '.$this->task['department'])
            ->line('Status: '.$this->task['status'])
            ->line('Deadline: '.$this->task['due']);
        if ($this->mode === 'send' && config('task_module.mailer') === 'task-gmail') $message->from(config('task_module.sender_email'), 'The Cat Clinic');
        if (!empty($this->task['remarks'])) $message->line('Feedback: '.$this->task['remarks']);
        return $message->action('Open Task Module', route('tasks.index', ['view' => in_array($this->task['status'], ['Pending Approval', 'Pending Review']) ? 'Review Queue' : 'My Tasks', 'task' => $this->task['id']]))
            ->line('Sign in to view the task and its supporting details.');
    }
}
