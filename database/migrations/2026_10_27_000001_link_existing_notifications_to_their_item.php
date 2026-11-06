<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Document and announcement notifications used to link to the list page only.
     * New ones link to the item (?open=<id>); give existing ones the same link by
     * matching the title in the message to the item created before the notification.
     */
    public function up(): void
    {
        $types = [
            'App\\Notifications\\NewDocumentAlert' => ['documents', '📁 New Document: '],
            'App\\Notifications\\AnnouncementAlert' => ['announcements', '📢 New Announcement: '],
        ];

        foreach ($types as $type => [$table, $prefix]) {
            DB::table('notifications')->where('type', $type)->orderBy('created_at')->chunk(200, function ($rows) use ($table, $prefix) {
                foreach ($rows as $row) {
                    $data = json_decode($row->data, true);
                    $message = $data['message'] ?? '';
                    $url = $data['action_url'] ?? '';

                    if (!$url || !str_starts_with($message, $prefix) || str_contains($url, 'open=')) {
                        continue;
                    }

                    $itemId = DB::table($table)
                        ->where('title', substr($message, strlen($prefix)))
                        ->where('created_at', '<=', date('Y-m-d H:i:s', strtotime($row->created_at) + 60))
                        ->orderByDesc('created_at')
                        ->value('id');

                    if (!$itemId) {
                        continue;
                    }

                    $data['action_url'] = strtok($url, '?') . '?open=' . $itemId;

                    DB::table('notifications')->where('id', $row->id)->update(['data' => json_encode($data)]);
                }
            });
        }
    }

    public function down(): void
    {
        // Links without ?open= still work, so there is nothing to undo
    }
};
