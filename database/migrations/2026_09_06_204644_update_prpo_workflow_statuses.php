<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Safely migrate existing PRs waiting for PO Generation into the new Procurement TL queue
        DB::table('purchase_requests')
            ->where('status', 'pending_procurement')
            ->update(['status' => 'pending_procurement_tl']);

        // 2. Safely migrate existing POs to use the new PO-specific statuses
        DB::table('purchase_orders')
            ->where('status', 'drafted')
            ->update(['status' => 'po_generated']);

        DB::table('purchase_orders')
            ->where('status', 'pending_approval')
            ->update(['status' => 'pending_evp_final']);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('purchase_requests')
            ->where('status', 'pending_procurement_tl')
            ->update(['status' => 'pending_procurement']);

        DB::table('purchase_orders')
            ->where('status', 'po_generated')
            ->update(['status' => 'drafted']);

        DB::table('purchase_orders')
            ->where('status', 'pending_evp_final')
            ->update(['status' => 'pending_approval']);
    }
};
