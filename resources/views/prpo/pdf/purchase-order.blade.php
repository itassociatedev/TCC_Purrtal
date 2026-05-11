<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{ $po->po_number }}</title>
    <style>
        /* 🟢 FORCED LANDSCAPE WITH MINIMAL MARGINS */
        @media print {
            @page { 
                size: landscape; 
                margin: 8mm; 
            }
            body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
            }
        }
        
        /* 🟢 MICRO-TYPOGRAPHY FOR DENSITY */
        body { 
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
            color: #333; 
            font-size: 10px; 
            line-height: 1.15; 
            margin: 0; 
            padding: 0; 
            display: block;
        }
        
        /* 🟢 SIDE-BY-SIDE MASTER HEADER GRID */
        .master-header { width: 100%; border-bottom: 2px solid #111827; margin-bottom: 8px; padding-bottom: 6px; border-collapse: collapse; }
        .master-header td { vertical-align: top; }
        .border-left { border-left: 1px solid #e5e7eb; padding-left: 10px; margin-left: 10px; }
        
        .company-title { font-size: 17px; font-weight: bold; color: #111827; margin: 0; }
        .doc-title { font-size: 21px; font-weight: bold; color: #4f46e5; margin: 0; }
        
        .info-label { font-size: 9px; font-weight: bold; color: #6b7280; text-transform: uppercase; display: block; margin-bottom: 1px; } 
        .info-value { font-size: 11px; font-weight: bold; color: #111827; } 
        
        /* 🟢 ULTRA COMPACT ITEMS TABLE */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
        .items-table th { background-color: #f3f4f6; padding: 3px 4px; text-align: left; font-size: 10px; border-bottom: 2px solid #d1d5db; } 
        .items-table td { padding: 2px 4px; border-bottom: 1px solid #e5e7eb; } 
        
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        
        tr { page-break-inside: avoid; break-inside: avoid; }

        /* 🟢 SIDE-BY-SIDE FOOTER (SIGNATURES + TOTALS) */
        .footer-table { width: 100%; border-collapse: collapse; margin-top: 5px; page-break-inside: avoid; break-inside: avoid; }
        .footer-table td { vertical-align: bottom; }
        
        /* Totals Block */
        .totals-table { width: 220px; border-collapse: collapse; float: right; }
        .totals-table td { padding: 3px 6px; border-bottom: 1px solid #e5e7eb; }
        .grand-total { font-size: 13px; font-weight: bold; color: #111827; background-color: #f3f4f6; }
        
        /* Signatures Block - PERFECTED ORDER */
        .signatures { display: flex; justify-content: flex-start; gap: 60px; width: 100%; }
        .sig-block { width: 220px; text-align: center; }
        .sig-line { border-bottom: 1px solid #000; margin-bottom: 4px; height: 40px; width: 100%; }
        .sig-title { font-size: 10px; color: #6b7280; margin-bottom: 2px; } /* Added margin to space out title and name */
        .sig-name { font-weight: bold; font-size: 11px; text-transform: uppercase; } 
    </style>
</head>
<body>

@php
        $imagePath = resource_path('js/Assets/tcc_logo.png');
        $logoData = '';
        if(file_exists($imagePath)) {
            $logoData = 'data:image/png;base64,' . base64_encode(file_get_contents($imagePath));
        }
@endphp

    {{-- MASTER HEADER --}}
    <table class="master-header">
        <tr>
            <td style="width: 25%;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    @if($logoData)
                        <img src="{{ $logoData }}" alt="TCC Logo" style="width: 50px; height: auto; border-radius: 4px;">
                    @endif
                    <div>
                        <h1 class="company-title" style="line-height: 1.1;">The CAT Clinic</h1>
                        <div style="color: #6b7280; font-size: 10px; margin-top: 1px;">Makati City, Metro Manila</div>
                    </div>
                </div>
            </td>

            <td style="width: 30%;" class="border-left">
                <span class="info-label">To Supplier:</span>
                <span class="info-value">{{ $po->supplier->name ?? 'N/A' }}</span><br>
                {{ $po->supplier->contact_person ?? 'N/A' }} | {{ $po->supplier->contact_number ?? 'N/A' }}<br>
                {{ $po->supplier->address ?? 'N/A' }}<br>
                TIN: {{ $po->supplier->tin ?? 'N/A' }}
            </td>

            <td style="width: 25%;" class="border-left">
                <span class="info-label">Shipping Details:</span>
                <span class="info-value">Ship To: {{ $po->ship_to }}</span><br>
                Target Delivery: {{ \Carbon\Carbon::parse($po->delivery_date)->format('F d, Y') }}<br>
                Terms: {{ $po->payment_terms }}
            </td>

            <td style="width: 20%; text-align: right; vertical-align: middle;">
                <h2 class="doc-title">PURCHASE ORDER</h2>
                <div style="font-weight: bold; margin-top: 2px; font-size: 12px;">PO #: {{ $po->po_number }}</div>
            </td>
        </tr>
    </table>

    {{-- ITEMS TABLE --}}
    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 3%;">#</th>
                <th style="width: 40%;">Description & Specs</th>
                <th style="width: 22%;">Notes / Freebies</th>
                <th class="text-center" style="width: 10%;">Qty</th>
                <th class="text-right" style="width: 10%;">Unit Price</th>
                <th class="text-right" style="width: 15%;">Line Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($po->items as $index => $item)
            <tr>
                <td style="color: #6b7280;">{{ $index + 1 }}</td>
                <td>
                    <strong>{{ $item->product->name ?? $item->description }}</strong>
                    @if($item->specifications)
                        <span style="font-size: 10px; color: #6b7280;"> | {{ $item->specifications }}</span> 
                    @endif
                </td>
                
                <td>
                    @if($item->notes)
                        <span style="font-size: 9px; color: #4f46e5; font-weight: bold;">{{ $item->notes }}</span>
                    @else
                        <span style="color: #d1d5db;">-</span>
                    @endif
                </td>

                <td class="text-center">{{ $item->qty }} {{ $item->unit }}</td>
                <td class="text-right">₱{{ number_format($item->unit_price, 2) }}</td>
                <td class="text-right font-bold">₱{{ number_format($item->net_payable, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    {{-- FOOTER: Signatures on the left, Totals on the right --}}
    <table class="footer-table">
        <tr>
            <td style="width: 65%;">
                <div class="signatures">
                    {{-- Prepared By Block - CORRECTED ORDER --}}
                    <div class="sig-block">
                        <div class="sig-line"></div>
                        <div class="sig-title">Prepared By</div>
                        <div class="sig-name">{{ $po->preparedBy->name ?? 'barabim' }}</div>
                    </div>
                    
                    {{-- Approved By Block - CORRECTED ORDER --}}
                    <div class="sig-block">
                        <div class="sig-line"></div>
                        <div class="sig-title">Approved By</div>
                        <div class="sig-name">Director of Corporate Services and Operations </div>
                    </div>
                </div>
            </td>
            
            <td style="width: 35%;">
                <table class="totals-table">
                    <tr>
                        <td>Gross Amount:</td>
                        <td class="text-right">₱{{ number_format($po->gross_amount, 2) }}</td>
                    </tr>
                    <tr>
                        <td>Discount:</td>
                        <td class="text-right" style="color: #ef4444;">- ₱{{ number_format($po->discount_total, 2) }}</td>
                    </tr>
                    <tr>
                        <td>Net of Discount:</td>
                        <td class="text-right">₱{{ number_format($po->net_of_discount, 2) }}</td>
                    </tr>
                    <tr>
                        <td>VAT:</td>
                        <td class="text-right">₱{{ number_format($po->vat_total, 2) }}</td>
                    </tr>
                    <tr class="grand-total">
                        <td>GRAND TOTAL:</td>
                        <td class="text-right">₱{{ number_format($po->grand_total, 2) }}</td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>

    {{-- Auto-trigger print dialog --}}
    <script>
        window.onload = function() {
            setTimeout(function() {
                window.print();
            }, 500);
        }
    </script>
</body>
</html>     