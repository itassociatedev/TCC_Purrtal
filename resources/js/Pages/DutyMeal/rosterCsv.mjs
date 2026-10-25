import {validCsvDate} from '../../Utils/csv.mjs';
export function prepareRosterImport(rows,{canEditDutyMeals,branches,employees,minDate,generateWeekSchedule,getShiftDetails}) {
        if(!canEditDutyMeals)throw new Error('Roster edit permission is required.');
        const branch=branches.find(branch=>branch.name===rows[0].branch);
        if(!branch||rows.some(row=>row.branch!==branch.name))throw new Error('Use one existing branch per import.');
        const dates=[...new Set(rows.map(row=>row.date))].sort();
        if(dates.some(date=>!validCsvDate(date)||date<minDate))throw new Error('Use future dates in YYYY-MM-DD format.');
        if((new Date(dates.at(-1)+'T00:00:00Z')-new Date(dates[0]+'T00:00:00Z'))/86400000>6)throw new Error('Use at most seven consecutive dates.');
        const schedule=generateWeekSchedule(dates[0]);const keys=new Set();
        for(const [index,row] of rows.entries()){
            const day=schedule.find(day=>day.date===row.date);if(!day)throw new Error(`Row ${index+2}: invalid roster date.`);
            if(day.main_meal&&row.main_meal&&day.main_meal!==row.main_meal)throw new Error('Meal names must match for rows on the same day.');
            day.main_meal=row.main_meal||day.main_meal;day.alt_meal=row.alt_meal||day.alt_meal;
            if(!row.employee_email)continue;
            const employee=employees.find(employee=>employee.email===row.employee_email);
            if(!employee)throw new Error(`Row ${index+2}: employee email not found.`);
            if(Number(employee.branch_id)!==Number(branch.id)&&!employee.assigned_branch_ids?.map(Number).includes(Number(branch.id)))throw new Error(`Row ${index+2}: employee is not assigned to this branch.`);
            if(getShiftDetails(employee,row.date,day.dayName).isOff)throw new Error(`Row ${index+2}: employee is off or on leave.`);
            if(!['day','graveyard','straight'].includes(row.shift_type))throw new Error(`Row ${index+2}: use day, graveyard or straight.`);
            const key=row.date+':'+employee.id;if(keys.has(key))throw new Error('Duplicate employee/date rows.');keys.add(key);
            day.participants.push({id:employee.id,name:employee.name,department:employee.department_id,position:employee.position_id,shift_type:row.shift_type});
        }
        return {branch_id:branch.id,week_start:dates[0],schedule};
    }