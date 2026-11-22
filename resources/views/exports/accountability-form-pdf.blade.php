<!doctype html>
<html><head><meta charset="utf-8"><title>Asset Accountability Form</title>
<style>
body{font-family:Arial,sans-serif;color:#1f2937;font-size:12px;margin:34px} .brand{text-align:center;color:#3b6f9f;font-weight:bold} h1{font-size:18px;margin:8px 0 24px;color:#3b6f9f;text-align:center} h2{font-size:14px;color:#3b6f9f;margin:18px 0 6px} .info{white-space:pre-line;line-height:1.5} table{border-collapse:collapse;width:100%;margin-bottom:16px} th,td{border:1px solid #6b7280;padding:6px;text-align:left;height:18px} th{text-align:center;font-weight:normal} .ack{line-height:1.5;margin-top:24px} .signatures{display:flex;justify-content:space-between;margin-top:28px} .signature{width:45%;border-top:1px solid #374151;padding-top:5px} @media print{body{margin:18mm}.print{display:none}}
</style></head><body>
<div class="brand">The Cat Clinic</div><h1>Asset Accountability Form</h1>
<div class="info"><strong>Employee Information</strong>
Name: {{ $user->name }}
Department: {{ optional($user->department)->name ?? $user->department ?? '—' }}
Branch: {{ optional($user->branches->first())->name ?? '—' }}
Date: {{ $generatedAt->format('n/j/y') }}</div>
@foreach ([['Personal Accountability',$personalAssets],['Shared Accountability',$sharedAssets]] as [$title,$items])
<h2>{{ $title }}</h2><table><thead><tr><th>Item</th><th>Tag</th><th>Serial Number / Model</th><th>Condition</th><th>Remarks</th></tr></thead><tbody>
@forelse($items as $asset)<tr><td>{{ $asset->name }}</td><td>{{ $asset->asset_tag }}</td><td>{{ $asset->serial_no ?: ($asset->model_no ?: '') }}</td><td>{{ $asset->condition ?: '' }}</td><td>{{ $asset->remarks ?: '' }}</td></tr>@empty<tr><td colspan="5">No assets assigned.</td></tr>@endforelse
</tbody></table>@endforeach
<h2>Acknowledgment</h2><div class="ack">I acknowledge that the above asset(s) are assigned to me and I am responsible for their safekeeping and proper use. I understand that I must report any loss, damage, or transfer of the asset(s) to the IT Department immediately. Upon separation from the company or reassignment, I will return the asset(s) in good condition, subject to final inspection.</div>
<div class="signatures"><div class="signature">Employee Signature<br><br>Date: ____________________</div><div class="signature">IT Dept. Representative<br><br>Date: ____________________</div></div>
<button class="print" onclick="window.print()">Print / Save as PDF</button>
</body></html>
