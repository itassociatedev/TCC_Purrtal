<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (Schema::hasColumn('assets', 'image_path')) {
            return;
        }

        Schema::table('assets', function (Blueprint $table) {
            // 🟢 ADD THE IMAGE PATH COLUMN
            $table->string('image_path')->nullable()->after('asset_status');
        });
    }

    public function down()
    {
        Schema::table('assets', function (Blueprint $table) {
            $table->dropColumn('image_path');
        });
    }
};