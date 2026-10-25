<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('shifts', function (Blueprint $table) {
            $table->id();
            $table->string('name'); // e.g., "7:30AM - 4:30PM (07:30-16:30)"
            $table->time('start_time');
            $table->time('end_time');
            $table->string('shift_type'); // e.g., "Day Shift", "Straight Duty", "Graveyard Shift"
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('shifts');
    }
};