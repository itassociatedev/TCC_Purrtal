<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class PRPOCcStatusUpdate extends Notification
{
    use Queueable;

    public $document;
    public $docType;
    public $statusMessage;

    public function __construct($document, $docType, $statusMessage)
    {
        $this->document = $document;
        $this->docType = $docType;
        $this->statusMessage = $statusMessage;
    }

    public function via($notifiable)
    {
        // 🟢 In-app bell icon only
        return ['database'];
    }

    public function toArray($notifiable)
    {
        $docNumber = $this->docType === 'PR'
            ? $this->document->pr_number
            : $this->document->po_number;

        $prId = $this->docType === 'PR'
            ? $this->document->id
            : $this->document->purchase_request_id;

        return [
            'message' => "CC Update: " . $docNumber,
            'user_email' => $this->statusMessage,
            'action_url' => route('prpo.status.index') . '?highlight=' . $prId
        ];
    }
}
