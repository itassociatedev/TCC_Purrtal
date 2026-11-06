<?php

namespace App\Console\Commands;

use App\Notifications\TaskModuleEmail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class PreviewTaskEmail extends Command
{
    protected $signature = 'tasks:email-preview {--to= : Test recipient, defaults to TASK_TEST_EMAIL}';
    protected $description = 'Write a queued Task Module email preview to the local log; never send external email.';
    public function handle(): int
    {
        if (!app()->environment(['local','testing'])) { $this->error('This preview is for local/testing environments only.'); return self::FAILURE; }
        $recipient=$this->option('to') ?: config('task_module.test_email');
        if (!filter_var($recipient,FILTER_VALIDATE_EMAIL)) {$this->error('Set a valid TASK_TEST_EMAIL address.');return self::FAILURE;}
        $task=['id'=>'preview','title'=>'Check branch equipment','assignee'=>'Example IT employee','branch'=>'Makati','department'=>'IT','due'=>now('Asia/Manila')->addDay()->toDateString(),'status'=>'Pending Approval'];
        Notification::route('mail',$recipient)->notify((new TaskModuleEmail($task,'Task created','Example Team Leader','log'))->onQueue('task-mail-preview'));
        $this->call('queue:work', ['connection'=>config('task_module.queue_connection'),'--queue'=>'task-mail-preview','--once'=>true,'--tries'=>1,'--timeout'=>30]);
        $this->info('Test recipient: '.$recipient);
        $this->info('Preview written to storage/logs/task-mail.log. Nothing was sent to the recipient’s inbox.');
        return self::SUCCESS;
    }
}
