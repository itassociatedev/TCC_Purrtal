<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Column => column it is placed after
    private array $columns = [
        'prepared_by_name' => 'user_id',
        'prepared_by_role' => 'prepared_by_name',
        'reviewed_by_name' => 'reviewed_by_id',
        'reviewed_by_role' => 'reviewed_by_name',
        'approved_by_name' => 'approved_by_id',
        'approved_by_role' => 'approved_by_name',
    ];

    public function up(): void
    {
        // Added one at a time so a partially applied run can be resumed safely
        foreach ($this->columns as $column => $after) {
            if (Schema::hasColumn('purchase_requests', $column)) {
                continue;
            }

            Schema::table('purchase_requests', function (Blueprint $table) use ($column, $after) {
                $table->string($column)->nullable()->after($after);
            });
        }
    }

    public function down(): void
    {
        $existing = array_values(array_filter(
            array_keys($this->columns),
            fn ($column) => Schema::hasColumn('purchase_requests', $column)
        ));

        if ($existing) {
            Schema::table('purchase_requests', function (Blueprint $table) use ($existing) {
                $table->dropColumn($existing);
            });
        }
    }
};
