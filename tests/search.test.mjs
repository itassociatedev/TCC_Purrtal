import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesSearch} from '../resources/js/Pages/Tasks/search.mjs';
import {buildLeaderboard} from '../resources/js/Pages/Tasks/leaderboard.mjs';
import {filterTasks} from '../resources/js/Pages/Tasks/taskFilters.mjs';
test('search handles reordered words, accents, punctuation and extra spaces',()=>{assert.ok(matchesSearch('  nunez RUBY  ','Ruby Ann Nuñez'));assert.ok(matchesSearch('santos patrick','Patrick David Santos'));assert.ok(matchesSearch('front-desk','Front Desk Associate'));assert.equal(matchesSearch('ruby john','Ruby Ann Nuñez'),false);});
test('department and branch rankings can be found by an employee name',()=>{const employees=[{name:'Ruby Ann Nuñez',department:'Front Desk',branch:'Makati'},{name:'Bea',department:'IT',branch:'Alabang'}];for(const group of ['people','departments','branches']){const board=buildLeaderboard([],{employees,group,search:'nunez ruby'});assert.equal(board.rows.length,1);assert.ok(board.rows[0].memberNames.includes('Ruby Ann Nuñez'));}});
test('task search matches words across title, assignee and status while retaining filters',()=>{const tasks=[{id:1,title:'Check supplies',assignee:'Ruby Ann Nuñez',department:'IT',branch:'Makati',priority:'High',status:'In Progress',due:'2026-10-29'}];assert.equal(filterTasks(tasks,{view:'Team Tasks',search:'nunez supplies progress',today:'2026-10-28'}).length,1);assert.equal(filterTasks(tasks,{view:'Team Tasks',search:'supplies',department:'HR',today:'2026-10-28'}).length,0);});
