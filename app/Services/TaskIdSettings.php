<?php
namespace App\Services;
use App\Support\TaskIdFormatter;
use Illuminate\Support\Facades\{DB, Schema, Notification};
use Illuminate\Validation\ValidationException;
class TaskIdSettings
{
    public static function defaults(): array { return ['prefixSource'=>'department','dateFormat'=>'my','digits'=>5,'separator'=>'-']; }
    public static function current(): array {
        if (!Schema::hasTable('task_module_settings')) return self::defaults();
        $value=DB::table('task_module_settings')->where('key','task_ids')->value('value');
        return [...self::defaults(), ...(json_decode($value ?: '{}',true) ?: [])];
    }
    public static function reserve(string $department, string $role, \DateTimeInterface $date): string {
        if (!Schema::hasTable('task_id_sequences')) throw ValidationException::withMessages(['task_id'=>'Task ID storage is missing. Ask Admin to run the pending Task Module migration.']);
        return DB::transaction(function() use($department,$role,$date) {
            $format=self::current();
            $prefix=TaskIdFormatter::prefix($format['prefixSource']==='role'?$role:$department);
            $period=$date->format($format['dateFormat']);$separator=$format['separator'];
            $scope=$prefix.$separator.$period.':'.$format['digits'];$max=(10**$format['digits'])-1;
            DB::table('task_id_sequences')->insertOrIgnore(['scope'=>$scope,'last_number'=>0,'created_at'=>now(),'updated_at'=>now()]);
            $counter=DB::table('task_id_sequences')->where('scope',$scope)->lockForUpdate()->first();
            $next=$counter->last_number+1;
            if($next>$max)throw ValidationException::withMessages(['task_id'=>"Task ID limit ({$max}) reached for {$prefix}{$separator}{$period}. Increase the sequence digits in Workspace Setup."]);
            DB::table('task_id_sequences')->where('scope',$scope)->update(['last_number'=>$next,'updated_at'=>now()]);
            if($next===$max && Schema::hasTable('notifications')) {
                $admins=\App\Models\User::whereHas('role',fn($query)=>$query->whereRaw('LOWER(name) = ?', ['admin']))->where('status','Active')->get();
                Notification::send($admins,new \App\Notifications\TaskIdLimitNotification($prefix.$separator.$period));
            }
            return $prefix.$separator.$period.$separator.str_pad((string)$next,$format['digits'],'0',STR_PAD_LEFT);
        });
    }
}
