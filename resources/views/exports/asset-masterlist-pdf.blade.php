<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Asset Masterlist</title>
    <style>
        @page { size: A4 landscape; margin: 12mm; }
        * { box-sizing: border-box; }
        body { font-family: Arial, sans-serif; color: #111827; font-size: 9px; margin: 0; }
        h1 { margin: 0 0 3px; font-size: 18px; }
        .meta { color: #6b7280; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #d1d5db; padding: 5px; vertical-align: top; }
        th { background: #eef2ff; text-align: left; font-size: 8px; text-transform: uppercase; }
        .photo { width: 72px; height: 52px; object-fit: contain; display: block; margin: auto; }
        .tag { font-family: monospace; font-weight: bold; }
        .nowrap { white-space: nowrap; }
        @media print { .no-print { display: none; } }
    </style>
</head>
<body onload="window.print()">
    <h1>Asset Masterlist</h1>
    <div class="meta">Generated {{ $generatedAt->format('M d, Y h:i A') }} · {{ $assets->count() }} asset record(s)</div>
    <table>
        <thead><tr><th>Photo</th><th>Asset</th><th>Tag</th><th>Serial / Model</th><th>Assignment</th><th>Location</th><th>Status</th><th>Condition</th><th>Value</th></tr></thead>
        <tbody>
        @foreach($assets as $asset)
            @php
                $photo = $asset->image_path;
                if ($photo && !str_starts_with($photo, 'http')) $photo = asset('storage/' . ltrim($photo, '/'));
                $people = $asset->accountableUsers->sortByDesc(fn ($user) => (int) ($user->pivot?->is_team_leader ?? false));
                $person = $people->isNotEmpty()
                    ? $people->map(fn ($user) => $user->name . (($user->pivot?->is_team_leader ?? false) ? ' (Team Leader)' : ''))->implode(', ')
                    : ($asset->user?->name ?: ($asset->assigned_personnel ?: 'Unassigned'));
                $value = $asset->total_value ?: (($asset->unit_value ?: 0) * ($asset->qty ?: 1));
            @endphp
            <tr>
                <td>@if($photo)<img class="photo" src="{{ $photo }}" alt="Asset photo">@else—@endif</td>
                <td><strong>{{ $asset->name }}</strong><br>{{ $asset->category ?: '—' }}</td>
                <td class="tag nowrap">{{ $asset->asset_tag }}</td>
                <td>{{ $asset->serial_no ?: '—' }}<br>{{ $asset->model_no ?: '—' }}</td>
                <td>{{ $person }}</td>
                <td>{{ $asset->branch ?: 'Unassigned' }}<br>{{ $asset->department ?: '—' }} / {{ $asset->area ?: '—' }}</td>
                <td>{{ $asset->asset_status ?: 'New' }}</td>
                <td>{{ $asset->condition ?: 'Good' }}</td>
                <td class="nowrap">₱{{ number_format((float) $value, 2) }}</td>
            </tr>
        @endforeach
        </tbody>
    </table>
</body>
</html>
