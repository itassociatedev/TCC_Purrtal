<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up()
    {
        // 1. Move old 'pending_procurement' PRs back to TL queue for endorsement
        DB::table('purchase_requests')
            ->where('status', 'pending_procurement')
            ->update(['status' => 'pending_procurement_tl']);
            
        // 2. Move inappropriately 'approved' PRs to the new PO Generation queue
        // (Assuming PRs shouldn't be 'approved', as that is reserved for final POs)
        DB::table('purchase_requests')
            ->where('status', 'approved')
            ->update(['status' => 'pending_procurement']);
    }
};
