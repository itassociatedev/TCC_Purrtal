<?php
namespace App\Http\Controllers;
use App\Services\TaskIdSettings;
use App\Services\LoggerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB,Schema};
use Illuminate\Validation\Rule;
class TaskIdSettingsController extends Controller
{
    public function show(Request $request) {
        abort_unless(strtolower(trim($request->user()->role?->name ?? ''))==='admin',403);
        return response()->json(['settings'=>TaskIdSettings::current(),'counters'=>Schema::hasTable('task_id_sequences')?DB::table('task_id_sequences')->orderByDesc('updated_at')->limit(20)->get():[]]);
    }
    public function update(Request $request) {
        abort_unless(strtolower(trim($request->user()->role?->name ?? ''))==='admin',403);
        abort_unless(Schema::hasTable('task_module_settings'),503,'Run the pending Task Module migration before saving ID settings.');
        $data=$request->validate(['prefixSource'=>['required',Rule::in(['department','role'])],'dateFormat'=>['required',Rule::in(['my','mY','Ym','Ymd'])],'digits'=>'required|integer|min:5|max:9','separator'=>['required',Rule::in(['-','_'])], 'applyTo'=>['required',Rule::in(['new','all'])]]);
        $applyTo=$data['applyTo']; unset($data['applyTo']);
        $records=DB::transaction(function() use($data,$applyTo) {
            DB::table('task_module_settings')->where('key','task_ids')->lockForUpdate()->first();
            DB::table('task_module_settings')->updateOrInsert(['key'=>'task_ids'],['value'=>json_encode($data),'updated_at'=>now()]);
            $updated=[];
            if($applyTo==='all' && Schema::hasTable('task_module_records')) {
                foreach(\App\Models\TaskModuleRecord::orderBy('id')->lockForUpdate()->get() as $record) {
                    $payload=$record->payload;
                    $previous=$payload['taskCode'] ?? $record->document()['taskCode'];
                    $payload['taskCode']=TaskIdSettings::reserve($payload['department'] ?? $record->department ?? '', $payload['assigneeRole'] ?? '', $record->created_at->timezone('Asia/Manila'));
                    $payload['taskIdPrefixSource']=$data['prefixSource'];
                    $payload['history'][]=['text'=>'Task ID updated from '.$previous.' to '.$payload['taskCode'].'.','at'=>now()->toIso8601String()];
                    $record->update(['payload'=>$payload,'version'=>$record->version+1]);
                    $updated[]=['key'=>$record->client_key,'taskCode'=>$payload['taskCode'],'version'=>$record->version,'history'=>$payload['history']];
                }
            }
            LoggerService::log('Task Module','Settings','Updated task ID format. '.($applyTo==='all' ? count($updated).' existing task IDs regenerated.' : 'Existing task IDs preserved.'));
            return $updated;
        });
        return response()->json(['settings'=>$data,'applyTo'=>$applyTo,'records'=>$records]);
    }
}
