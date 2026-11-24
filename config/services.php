<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'onedrive' => [
        'enabled' => (bool) env('ONEDRIVE_ENABLED', false),
        'tenant_id' => env('ONEDRIVE_TENANT_ID'),
        'client_id' => env('ONEDRIVE_CLIENT_ID'),
        'client_secret' => env('ONEDRIVE_CLIENT_SECRET'),
        'user_id' => env('ONEDRIVE_USER_ID'),
        'site_id' => env('ONEDRIVE_SITE_ID'),
        'folder_path' => env('ONEDRIVE_FOLDER_PATH', 'TCC Purrtal/Asset Photos'),
        'branch_folders' => [
            'GH' => env('ONEDRIVE_BRANCH_FOLDER_GH', 'Greenhills'),
            'MKT' => env('ONEDRIVE_BRANCH_FOLDER_MKT', 'Makati'),
            'ALB' => env('ONEDRIVE_BRANCH_FOLDER_ALB', 'Alabang'),
        ],
    ],

];
