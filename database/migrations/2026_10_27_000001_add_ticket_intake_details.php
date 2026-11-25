<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Nullable columns preserve tickets submitted before the expanded form.
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('employee_department')->nullable();
            $table->dateTime('issue_at')->nullable();
            $table->string('issue_time_type')->nullable();
            $table->string('affected_asset')->nullable();
            $table->unsignedInteger('affected_users')->nullable();
            $table->text('affected_areas')->nullable();
            $table->text('operational_impact')->nullable();
            $table->json('supporting_links')->nullable();
            $table->text('error_messages')->nullable();
            $table->text('troubleshooting_steps')->nullable();
            $table->text('follow_up_contact')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', fn (Blueprint $table) => $table->dropColumn([
            'employee_department', 'issue_at', 'issue_time_type', 'affected_asset',
            'affected_users', 'affected_areas', 'operational_impact', 'supporting_links',
            'error_messages', 'troubleshooting_steps', 'follow_up_contact',
        ]));
    }
};
