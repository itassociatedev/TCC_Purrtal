<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('branches', 'code')) {
            Schema::table('branches', fn (Blueprint $table) => $table->string('code', 10)->nullable()->unique()->after('name'));
        }

        foreach (['greenhills' => 'GH', 'makati' => 'MKT', 'alabang' => 'ALB'] as $name => $code) {
            DB::table('branches')->whereRaw('LOWER(name) = ?', [$name])->update(['code' => $code]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('branches', 'code')) {
            Schema::table('branches', fn (Blueprint $table) => $table->dropColumn('code'));
        }
    }
};
