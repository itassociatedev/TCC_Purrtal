<?php

namespace App\Console\Commands;

use App\Notifications\TaskModuleEmail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class SendTaskTestEmail extends Command
{
    protected $signature='tasks:email-test {--send : Send one real test message using the configured Task mailer}';
    protected $description='Preview a Task email, or explicitly send one test message to TASK_TEST_EMAIL.';
    public function handle(): int
    {
        if (!app()->environment(['local','testing'])) {$this->error('Use this command in the local/testing environment.');return self::FAILURE;}
        if (!$this->option('send')) return $this->call('tasks:email-preview');
        $recipient=config('task_module.test_email');
        if (!filter_var($recipient,FILTER_VALIDATE_EMAIL) || str_ends_with($recipient,'.invalid')) {$this->error('Configure a real TASK_TEST_EMAIL recipient first.');return self::FAILURE;}
        $mailer=config('task_module.mailer');$settings=config('mail.mailers.'.$mailer,[]);
        if ($mailer==='task-gmail' && empty($settings['password'])) {$this->error('Google authorization is required. Run .\scripts\setup-task-gmail.ps1 to enter a Google App Password securely.');return self::FAILURE;}
        if (in_array($settings['transport']??'', ['log','array']) || !$settings) {$this->error('The Task mailer is still a preview transport. Configure an approved sending account first.');return self::FAILURE;}
        $host=parse_url($settings['url']??'',PHP_URL_HOST) ?: ($settings['host']??'');
        if (str_contains(strtolower($host),'sandbox.smtp.mailtrap') || in_array($host,['localhost','127.0.0.1','mailpit'])) {
            $this->error('The configured sender is a local/sandbox testing inbox. Configure an approved delivery mailer before testing receipt in Gmail or Outlook.');return self::FAILURE;
        }
        $task=['id'=>'email-test','title'=>'Email notification test — no action required','assignee'=>'Test recipient','branch'=>'Test branch','department'=>'IT','due'=>now('Asia/Manila')->toDateString(),'status'=>'Test message'];
        Notification::sendNow(Notification::route('mail',$recipient),new TaskModuleEmail($task,'Test notification','The Cat Clinic','send'));
        $this->info('One test email was accepted by the configured mail transport for '.$recipient.'. Check Inbox and Spam.');
        return self::SUCCESS;
    }
}
