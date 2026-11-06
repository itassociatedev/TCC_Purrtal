<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The "forgot password" request saved "Password reset" while the admin reset saved
     * "Password Reset", so Employee Management showed two statuses. Use one spelling.
     */
    public function up(): void
    {
        DB::table('users')
            ->whereRaw('BINARY status = ?', ['Password reset'])
            ->update(['status' => 'Password Reset']);
    }

    public function down(): void
    {
        // Nothing to restore: both spellings meant the same status
    }
};
