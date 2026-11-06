<?php

return [
    'server_enabled' => env('TASK_SERVER_ENABLED', false),
    // log = local preview, send = configured mail transport, off = no notifications.
    'email_mode' => env('TASK_EMAIL_MODE', 'log'),
    'mailer' => env('TASK_MAILER', 'smtp'),
    'test_email' => env('TASK_TEST_EMAIL', 'local-preview@example.invalid'),
    'sender_email' => env('TASK_GMAIL_USERNAME'),
    'queue_connection' => env('TASK_MAIL_QUEUE_CONNECTION', 'database'),
    'queue' => 'task-mail',
];
