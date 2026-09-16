<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PurchaseOrder extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'purchase_request_id', 'supplier_id', 'prepared_by_id',
        'po_number', 'po_date', 'delivery_date', 'payment_terms',
        'ship_to','no_of_quotations' , 'shipping_address', 'attention', 'contact_no',
        'purpose', 'department', 'delivery_location', 'special_instructions',
        'gross_amount', 'discount_total', 'net_of_discount', 'vat_total', 'grand_total',
        'status','remarks', 'attachments'
    ];

    protected $casts = [
        'po_date' => 'date',
        'delivery_date' => 'date',
        'attachments' => 'array',
    ];

    protected $appends = ['po_number'];

    public function getPoNumberAttribute($value)
    {
        if ($value && !str_contains($value, 'UNK')) {
            return $value;
        }

        $branchName = $this->purchaseRequest ? strtoupper(trim($this->purchaseRequest->branch)) : 'UNK';

        $knownBranches = [
            'MAKATI' => 'MKT',
            'GREENHILLS' => 'GH',
            'ALABANG' => 'ALB'
        ];

        if ($branchName === 'UNK') {
            $branchInitials = 'UNK';
        } elseif (isset($knownBranches[$branchName])) {
            $branchInitials = $knownBranches[$branchName];
        } else {
            $words = array_filter(explode(' ', $branchName));
            if (count($words) > 1) {
                $branchInitials = '';
                foreach (array_slice($words, 0, 3) as $w) {
                    $branchInitials .= $w[0];
                }
            } else {
                $firstLetter = $branchName[0] ?? 'U';
                $consonants = preg_replace('/[AEIOU\W]/', '', substr($branchName, 1));
                $branchInitials = substr($firstLetter . $consonants, 0, 3);

                if (strlen($branchInitials) < 2) {
                    $branchInitials = substr($branchName, 0, 3);
                }
            }
        }

        $referenceId = $this->id ?? $this->purchase_request_id;

        return 'PO-' . $branchInitials . '-' . str_pad($referenceId, 5, '0', STR_PAD_LEFT);
    }

    public function purchaseRequest()
    {
        return $this->belongsTo(PurchaseRequest::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function preparedBy()
    {
        return $this->belongsTo(User::class, 'prepared_by_id');
    }

    public function items()
    {
        return $this->hasMany(PurchaseOrderItem::class);
    }
}
