<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        DB::table('tickets')
            ->where(fn ($query) => $query->whereNull('priority')
                ->orWhereRaw("LOWER(TRIM(priority)) IN ('', 'not set', 'not_set', 'not-set')"))
            ->update(['priority' => 'low']);

        Schema::table('tickets', function (Blueprint $table) {
            $table->string('priority')->default('low')->change();
        });
    }

    public function down(): void
    {
        // Keep converted values because existing Low tickets cannot be distinguished.
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('priority')->nullable()->change();
        });
    }
};
