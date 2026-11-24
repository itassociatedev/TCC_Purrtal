<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};
return new class extends Migration {
    public function up(): void {
        Schema::table('ticket_priorities',function(Blueprint $t){$t->unsignedInteger('score_points')->default(0);$t->text('description')->nullable();});
        foreach (['critical'=>20,'high'=>10,'medium'=>5,'low'=>1] as $key=>$points) DB::table('ticket_priorities')->where('key',$key)->update(['score_points'=>$points]);
        // Existing resolved/closed tickets get one auditable snapshot, using history to undo later priority edits.
        \App\Models\Ticket::whereIn('status',['resolved','closed'])->orderBy('id')->chunkById(100,function($tickets){
            foreach($tickets as $ticket) DB::transaction(function()use($ticket){
                $locked=\App\Models\Ticket::whereKey($ticket->id)->lockForUpdate()->first();
                if($locked) \App\Services\TicketResolutionScore::backfill($locked);
            });
        });
    }
    public function down(): void {
        // Frozen resolution evidence remains in ticket history and SLA JSON.
        Schema::table('ticket_priorities',fn(Blueprint $t)=>$t->dropColumn(['score_points','description']));
    }
};
