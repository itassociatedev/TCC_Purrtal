<table>
    <thead>
        <tr><th colspan="7" style="font-weight:bold;font-size:16px;background-color:#e0e7ff;">DUTY MEAL SUMMARY</th></tr>
        <tr>
            @foreach(['Date', 'Meal category', 'Total', 'Main', 'Alternative', 'Special requests', 'Notes'] as $heading)
                <th style="font-weight:bold;background-color:#f3f4f6;">{{ $heading }}</th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        @foreach($weeks as $week)
            @foreach($week['days'] as $date => $day)
                @foreach(['clinic_lunch'=>'Clinic lunch', 'clinic_dinner'=>'Clinic dinner', 'clinic_whole'=>'Whole day (lunch + dinner)', 'back_office'=>'Back office'] as $key => $label)
                    <tr>
                        <td>{{ $date }}</td>
                        <td style="{{ $key === 'clinic_whole' ? 'font-weight:bold;background-color:#eef2ff;' : '' }}">{{ $label }}</td>
                        <td style="text-align:center;font-weight:bold;">{{ $day[$key]['total'] }}</td>
                        <td style="text-align:center;">{{ $day[$key]['main'] }}</td>
                        <td style="text-align:center;">{{ $day[$key]['alt'] }}</td>
                        <td style="text-align:center;">{{ $day[$key]['special'] }}</td>
                        <td>{!! implode('<br style="mso-data-placement:same-cell;" />', $day[$key]['notes']) !!}</td>
                    </tr>
                @endforeach
            @endforeach
        @endforeach
    </tbody>
</table>
