<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB,Schema};
return new class extends Migration {
 public function up(): void {
  Schema::table('ticket_priorities',fn(Blueprint $t)=>$t->unsignedTinyInteger('time_completion_points')->default(3));
  foreach(['critical'=>7,'high'=>4,'medium'=>2,'low'=>0] as $key=>$points)DB::table('ticket_priorities')->where('key',$key)->update(['score_points'=>$points]);
  // Custom priorities also respect the 10-point ceiling; no existing task/SLA target is changed.
  DB::table('ticket_priorities')->where('score_points','>',7)->update(['score_points'=>7]);
  \App\Models\Ticket::whereIn('status',['resolved','closed'])->orderBy('id')->chunkById(100,function($tickets){foreach($tickets as $ticket)DB::transaction(function()use($ticket){
   $locked=\App\Models\Ticket::whereKey($ticket->id)->lockForUpdate()->first();if($locked)\App\Services\TicketResolutionScore::backfill($locked,true);
  });});
 }
 public function down(): void {Schema::table('ticket_priorities',fn(Blueprint $t)=>$t->dropColumn('time_completion_points'));}
};
