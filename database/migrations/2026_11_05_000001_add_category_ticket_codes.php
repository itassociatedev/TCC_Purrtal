<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('ticket_category_counters', function (Blueprint $table) {
            $table->string('prefix', 2)->primary();
            $table->unsignedBigInteger('next_number')->default(0);
        });
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('ticket_code', 24)->nullable()->unique();
        });

        // Number existing tickets in original ID order and continue from there.
        // The numeric keys still link activities and existing notification URLs.
        $prefixes = ['Hardware' => 'HW', 'Software' => 'SW', 'Network' => 'NW', 'Account & Access' => 'AC', 'Other' => 'OT'];
        DB::transaction(function () use ($prefixes) {
            $next = array_fill_keys(array_values($prefixes), 0);
            DB::table('tickets')->select('id', 'category')->chunkById(500, function ($tickets) use ($prefixes, &$next) {
                foreach ($tickets as $ticket) {
                    $prefix = $prefixes[$ticket->category] ?? 'OT';
                    DB::table('tickets')->where('id', $ticket->id)
                        ->update(['ticket_code' => sprintf('%s%04d', $prefix, $next[$prefix]++)]);
                }
            });
            foreach ($next as $prefix => $number) {
                DB::table('ticket_category_counters')->insert(['prefix' => $prefix, 'next_number' => $number]);
            }
        });
        Schema::table('tickets', function (Blueprint $table) {
            $table->string('ticket_code', 24)->nullable(false)->change();
        });
    }

    public function down(): void
    {
        Schema::table('tickets', function (Blueprint $table) {
            $table->dropUnique(['ticket_code']);
            $table->dropColumn('ticket_code');
        });
        Schema::dropIfExists('ticket_category_counters');
    }
};
