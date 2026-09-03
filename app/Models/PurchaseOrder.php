<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory;

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

    // Relationships

    // Add this to your model's properties
    protected $appends = ['po_number'];

    public function getPoNumberAttribute()
    {
        // Inherits the parent PR's ID to generate the matching PRPO-00197
        return 'PRPO-' . str_pad($this->purchase_request_id, 5, '0', STR_PAD_LEFT);
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
