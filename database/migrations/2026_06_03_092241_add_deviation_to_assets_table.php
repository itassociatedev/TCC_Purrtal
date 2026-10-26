<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up()
    {
        if (Schema::hasColumn('assets', 'deviation')) {
            return;
        }

        Schema::table('assets', function (Blueprint $table) {
            $table->string('deviation')->nullable()->after('warranty_expiration');
        });
    }

    public function down()
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('deviation');
        });
    }
};
