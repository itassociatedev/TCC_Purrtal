<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Per-member photo framing. The defaults (centred, no zoom) match how photos
     * were shown before, so existing photos look the same until adjusted.
     */
    public function up(): void
    {
        Schema::table('org_chart_members', function (Blueprint $table) {
            if (!Schema::hasColumn('org_chart_members', 'image_position_x')) {
                $table->decimal('image_position_x', 5, 2)->default(50)->after('image_path');
            }
            if (!Schema::hasColumn('org_chart_members', 'image_position_y')) {
                $table->decimal('image_position_y', 5, 2)->default(50)->after('image_position_x');
            }
            if (!Schema::hasColumn('org_chart_members', 'image_zoom')) {
                $table->decimal('image_zoom', 4, 2)->default(1)->after('image_position_y');
            }
        });
    }

    public function down(): void
    {
        Schema::table('org_chart_members', function (Blueprint $table) {
            $table->dropColumn(['image_position_x', 'image_position_y', 'image_zoom']);
        });
    }
};
