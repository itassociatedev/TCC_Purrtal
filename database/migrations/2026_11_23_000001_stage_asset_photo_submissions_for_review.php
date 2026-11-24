<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('asset_photo_submissions', 'submission_type')) {
            return;
        }

        Schema::table('asset_photo_submissions', function (Blueprint $table) {
            $table->foreignId('asset_id')->nullable()->change();
            $table->string('submission_type', 30)->default('photo_update')->after('asset_id');
            $table->json('asset_data')->nullable()->after('submission_type');
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('asset_photo_submissions', 'submission_type')) {
            return;
        }

        if (DB::table('asset_photo_submissions')->whereNull('asset_id')->exists()) {
            throw new RuntimeException('Cannot roll back staged asset photo submissions while unapproved new asset drafts exist. Resolve them first.');
        }

        Schema::table('asset_photo_submissions', function (Blueprint $table) {
            $table->dropColumn(['submission_type', 'asset_data']);
            $table->foreignId('asset_id')->nullable(false)->change();
        });
    }
};
