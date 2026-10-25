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
        Schema::table('schedule_overrides', function (Blueprint $table) {
            $table->boolean('is_leave')->default(false)->after('is_off_day');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        Schema::table('schedule_overrides', function (Blueprint $table) {
            $table->dropColumn('is_leave');
        });
    }
};
