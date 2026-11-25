import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareRosterImport} from '../resources/js/Pages/DutyMeal/rosterCsv.mjs';
const employee={id:4,name:'Clinic staff',email:'staff@example.com',branch_id:1,department_id:2,position_id:3};
const options={canEditDutyMeals:true,branches:[{id:1,name:'Makati'},{id:2,name:'Alabang'}],employees:[employee],minDate:'2026-10-26',generateWeekSchedule:date=>[{date,dayName:'Monday',participants:[],main_meal:'',alt_meal:''}],getShiftDetails:()=>({isOff:false})};
const row={date:'2026-10-26',branch:'Makati',employee_email:employee.email,shift_type:'day',main_meal:'Chicken',alt_meal:'Fish'};
test('roster CSV produces an editable draft with the participant shape used by setup',()=>{
 const draft=prepareRosterImport([row],options);
 assert.equal(draft.branch_id,1);assert.equal(draft.schedule[0].main_meal,'Chicken');
 assert.deepEqual(draft.schedule[0].participants,[{id:4,name:'Clinic staff',department:2,position:3,shift_type:'day'}]);
 assert.equal(prepareRosterImport([{...row,employee_email:''}],options).schedule[0].participants.length,0);
});
test('roster CSV rejects duplicate participants, invalid dates, unauthorized branches and unavailable staff',()=>{
 assert.throws(()=>prepareRosterImport([row,row],options));
 assert.throws(()=>prepareRosterImport([{...row,date:'2026-02-30'}],options));
 assert.throws(()=>prepareRosterImport([{...row,branch:'Alabang'}],options));
 assert.throws(()=>prepareRosterImport([row],{...options,canEditDutyMeals:false}));
 assert.throws(()=>prepareRosterImport([row],{...options,getShiftDetails:()=>({isOff:true})}));
 assert.throws(()=>prepareRosterImport([{...row,shift_type:'invalid'}],options));
});
