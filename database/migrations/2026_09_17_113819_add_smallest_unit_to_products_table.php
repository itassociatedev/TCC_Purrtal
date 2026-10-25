<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('products', function (Blueprint $table) {
            // 🟢 Add the new column right after the product name
            if (!Schema::hasColumn('products', 'smallest_unit')) {
                $table->string('smallest_unit')->nullable()->after('name');
            }
        });
    }

    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            if (Schema::hasColumn('products', 'smallest_unit')) {
                $table->dropColumn('smallest_unit');
            }
        });
    }
};
