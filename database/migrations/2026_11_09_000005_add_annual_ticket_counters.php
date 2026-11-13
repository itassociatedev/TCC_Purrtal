<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ticket_annual_counters', function (Blueprint $table) {
            $table->string('location_code', 12);
            $table->char('category_code', 2);
            $table->char('year_suffix', 2);
            $table->unsignedInteger('last_number');
            $table->primary(['location_code', 'category_code', 'year_suffix']);
        });

        // Continue from the highest ID already issued in each annual sequence.
        DB::table('tickets')->select('id', 'ticket_code')->where('ticket_code', 'like', '%-%-%')
            ->chunkById(500, function ($tickets) {
                foreach ($tickets as $ticket) {
                    if (!preg_match('/^([A-Z0-9_]{1,12})-([A-Z]{2})-([0-9]{2})([0-9]{5})$/D', $ticket->ticket_code, $parts)) {
                        continue;
                    }

                    [, $location, $category, $year, $number] = $parts;
                    $scope = ['location_code' => $location, 'category_code' => $category, 'year_suffix' => $year];
                    $counters = DB::table('ticket_annual_counters');
                    $counters->insertOrIgnore($scope + ['last_number' => (int) $number]);
                    $counters->where($scope)->where('last_number', '<', (int) $number)->update(['last_number' => (int) $number]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_annual_counters');
    }
};
