<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up()
    {
        // 1. Move old 'pending_procurement' PRs back to TL queue if they are waiting for PO Gen.
        DB::table('purchase_requests')
            ->where('status', 'pending_procurement')
            ->update(['status' => 'pending_procurement_tl']);

        // 2. Identify PRs labeled 'po_generated' (old PR generation stage) that HAVE NO actual Purchase Orders.
        // Move them to the new 'pr_generated' status.
        $prsWithoutPOs = DB::table('purchase_requests')
            ->leftJoin('purchase_orders', 'purchase_requests.id', '=', 'purchase_orders.purchase_request_id')
            ->where('purchase_requests.status', 'po_generated')
            ->whereNull('purchase_orders.id')
            ->pluck('purchase_requests.id');

        if ($prsWithoutPOs->isNotEmpty()) {
            DB::table('purchase_requests')
                ->whereIn('id', $prsWithoutPOs)
                ->update(['status' => 'pr_generated']);
        }
    }
};
