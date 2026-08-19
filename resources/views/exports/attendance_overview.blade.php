<table>
    <thead>
        <tr>
            <th colspan="{{ count($dates) + 2 }}" style="font-weight: bold; font-size: 16px; text-align: center; background-color: #e0e7ff; height: 30px;">
                ATTENDANCE OVERVIEW: {{ $weekRange }}
            </th>
        </tr>
        <tr>
            <th style="font-weight: bold; background-color: #f3f4f6;">Employee Name</th>
            <th style="font-weight: bold; background-color: #f3f4f6;">Department</th>
            @foreach($dates as $date)
                <th style="font-weight: bold; text-align: center; background-color: #f3f4f6;">
                    {{ $date['display'] }}
                </th>
            @endforeach
        </tr>
    </thead>
    <tbody>
        @foreach($employees as $emp)
            <tr>
                <td style="font-weight: bold;">{{ $emp['name'] }}</td>
                <td style="color: #4b5563;">{{ $emp['department'] }}</td>
                
                @foreach($dates as $date)
                    @php
                        // Dynamically pull the shift data for this specific day
                        $shift = $emp['shifts'][$date['dateString']] ?? null;
                    @endphp
                    
                    <td style="text-align: center; {{ $shift && $shift['is_override'] ? 'background-color: #fffbeb;' : '' }}">
                        @if($shift)
                            @if($shift['is_off'])
                                <span style="color: #6b7280; font-style: italic;">Off Day</span>
                            @elseif($shift['shift_type'])
                                <span style="font-weight: bold; color: #3730a3;">{{ $shift['shift_type'] }}</span><br>
                                <span style="font-size: 10px; color: #4b5563;">{{ $shift['start_time'] }} - {{ $shift['end_time'] }}</span>
                            @else
                                <span style="color: #9ca3af;">No Shift</span>
                            @endif
                        @else
                            <span style="color: #9ca3af;">No Shift</span>
                        @endif
                    </td>
                @endforeach
            </tr>
        @endforeach
    </tbody>
</table>