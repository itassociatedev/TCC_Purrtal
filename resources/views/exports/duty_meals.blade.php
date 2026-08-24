<table>
    @foreach($weeks as $weekStart => $week)
        <!-- HEADER ROW -->
        <tr>
            <td colspan="8" style="font-weight: bold; font-size: 16px; text-align: center; background-color: #d1d5db;">
                AUTOMATIC DUTY MEAL SUMMARY - Week of {{ $weekStart }}
            </td>
        </tr>
        
        <!-- DATES ROW -->
        <tr>
            <td style="font-weight: bold; background-color: #f3f4f6;">CATEGORY</td>
            @foreach($week['dates'] as $date)
                <td style="font-weight: bold; text-align: center; background-color: #f3f4f6;">{{ $date }}</td>
            @endforeach
        </tr>

        <!-- ================= CLINIC LUNCH ================= -->
        <tr>
            <td style="font-weight: bold; color: #1e40af;">CLINIC LUNCH</td>
            <td colspan="7"></td>
        </tr>
        <tr>
            <td style="font-weight: bold;">Total</td>
            @foreach($week['days'] as $day) <td style="text-align: center; font-weight: bold;">{{ $day['clinic_lunch']['total'] > 0 ? $day['clinic_lunch']['total'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Main</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_lunch']['main'] > 0 ? $day['clinic_lunch']['main'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Alternative</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_lunch']['alt'] > 0 ? $day['clinic_lunch']['alt'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Special Requests</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_lunch']['special'] > 0 ? $day['clinic_lunch']['special'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td style="font-weight: bold; color: #dc2626;">NOTES</td>
            @foreach($week['days'] as $day) <td style="color: #4b5563; font-style: italic;">{!! implode('<br style="mso-data-placement:same-cell;" />', $day['clinic_lunch']['notes']) !!}</td> @endforeach
        </tr>
        
        <tr><td colspan="8"></td></tr> <!-- SPACER ROW -->

        <!-- ================= CLINIC DINNER ================= -->
        <tr>
            <td style="font-weight: bold; color: #1e40af;">CLINIC DINNER</td>
            <td colspan="7"></td>
        </tr>
        <tr>
            <td style="font-weight: bold;">Total</td>
            @foreach($week['days'] as $day) <td style="text-align: center; font-weight: bold;">{{ $day['clinic_dinner']['total'] > 0 ? $day['clinic_dinner']['total'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Main</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_dinner']['main'] > 0 ? $day['clinic_dinner']['main'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Alternative</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_dinner']['alt'] > 0 ? $day['clinic_dinner']['alt'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Special Requests</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_dinner']['special'] > 0 ? $day['clinic_dinner']['special'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td style="font-weight: bold; color: #dc2626;">NOTES</td>
            @foreach($week['days'] as $day) <td style="color: #4b5563; font-style: italic;">{!! implode('<br style="mso-data-placement:same-cell;" />', $day['clinic_dinner']['notes']) !!}</td> @endforeach
        </tr>

        <tr><td colspan="8"></td></tr> <!-- SPACER ROW -->

        <!-- ================= CLINIC WHOLE DAY ================= -->
        <tr>
            <td style="font-weight: bold; color: #1e40af;">FOR THE WHOLE DAY</td>
            <td colspan="7"></td>
        </tr>
        <tr>
            <td style="font-weight: bold;">Total</td>
            @foreach($week['days'] as $day) <td style="text-align: center; font-weight: bold;">{{ $day['clinic_whole']['total'] > 0 ? $day['clinic_whole']['total'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Main</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_whole']['main'] > 0 ? $day['clinic_whole']['main'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Alternative</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_whole']['alt'] > 0 ? $day['clinic_whole']['alt'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Special Requests</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['clinic_whole']['special'] > 0 ? $day['clinic_whole']['special'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td style="font-weight: bold; color: #dc2626;">NOTES</td>
            @foreach($week['days'] as $day) <td style="color: #4b5563; font-style: italic;">{!! implode('<br style="mso-data-placement:same-cell;" />', $day['clinic_whole']['notes']) !!}</td> @endforeach
        </tr>

        <tr><td colspan="8"></td></tr> <!-- SPACER ROW -->

        <!-- ================= BACK OFFICE LUNCH ================= -->
        <tr>
            <td style="font-weight: bold; color: #1e40af;">BACK OFFICE LUNCH</td>
            <td colspan="7"></td>
        </tr>
        <tr>
            <td style="font-weight: bold;">Total</td>
            @foreach($week['days'] as $day) <td style="text-align: center; font-weight: bold;">{{ $day['back_office']['total'] > 0 ? $day['back_office']['total'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Main</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['back_office']['main'] > 0 ? $day['back_office']['main'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Alternative</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['back_office']['alt'] > 0 ? $day['back_office']['alt'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td>Special Requests</td>
            @foreach($week['days'] as $day) <td style="text-align: center;">{{ $day['back_office']['special'] > 0 ? $day['back_office']['special'] : '' }}</td> @endforeach
        </tr>
        <tr>
            <td style="font-weight: bold; color: #dc2626;">NOTES</td>
            @foreach($week['days'] as $day) <td style="color: #4b5563; font-style: italic;">{!! implode('<br style="mso-data-placement:same-cell;" />', $day['back_office']['notes']) !!}</td> @endforeach
        </tr>
        
        <tr><td colspan="8"></td></tr>
        <tr><td colspan="8"></td></tr> <!-- Multi-week separator -->
    @endforeach
</table>