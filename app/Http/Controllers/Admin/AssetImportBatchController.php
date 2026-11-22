<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\AssetImportBatch;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Support\AssetAccess;

class AssetImportBatchController extends Controller
{
    public function index()
    {
        $this->authorizeBatchAccess();
        return response()->json(AssetImportBatch::with('uploader:id,name')->latest()->paginate(20));
    }

    public function download(AssetImportBatch $batch)
    {
        $this->authorizeBatchAccess();
        abort_unless(Storage::disk('local')->exists($batch->stored_path), 404);
        return Storage::disk('local')->download($batch->stored_path, $batch->original_filename);
    }

    public function reverse(Request $request, AssetImportBatch $batch)
    {
        $this->authorizeBatchAccess();
        abort_if($batch->status === 'reversed', 422, 'This import batch has already been reversed.');

        DB::transaction(function () use ($batch) {
            foreach ($batch->items()->with('asset')->lockForUpdate()->get() as $item) {
                $asset = $item->asset;
                abort_if(!$asset, 422, "Reversal blocked because asset item {$item->id} no longer exists.");

                if (hash('sha256', json_encode($asset->only(array_keys($asset->getAttributes())), JSON_UNESCAPED_UNICODE)) !== $item->after_hash) {
                    abort(422, "Reversal blocked because asset {$asset->asset_tag} changed after this import.");
                }

                if ($item->created_by_batch) {
                    $asset->delete();
                } elseif ($item->before_values) {
                    $asset->fill($item->before_values);
                    $asset->saveQuietly();
                }
            }

            $batch->update(['status' => 'reversed', 'reversed_at' => now()]);
        });

        return back()->with('success', 'Import batch reversed successfully.');
    }

    private function authorizeBatchAccess(): void
    {
        $user = auth()->user();
        abort_unless(AssetAccess::isFullManager($user), 403);
    }
}
