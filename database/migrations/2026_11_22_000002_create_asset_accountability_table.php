<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('assets', 'accountability_type')) {
            Schema::table('assets', function (Blueprint $table) {
                $table->string('accountability_type', 20)->default('personal')->after('user_id');
            });
        }

        if (!Schema::hasTable('asset_user')) {
            Schema::create('asset_user', function (Blueprint $table) {
                $table->id();
                $table->foreignId('asset_id')->constrained()->cascadeOnDelete();
                $table->foreignId('user_id')->constrained()->cascadeOnDelete();
                $table->boolean('is_team_leader')->default(false);
                $table->timestamps();
                $table->unique(['asset_id', 'user_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_user');
        if (Schema::hasColumn('assets', 'accountability_type')) {
            Schema::table('assets', fn (Blueprint $table) => $table->dropColumn('accountability_type'));
        }
    }
};
