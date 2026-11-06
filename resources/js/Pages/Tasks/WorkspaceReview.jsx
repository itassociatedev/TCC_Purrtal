import {assignmentDirectory} from './assignmentDirectory.mjs';
import {reportTemplates} from './reportTemplates.mjs';

export default function WorkspaceReview({config,onOpen}){
 const people=assignmentDirectory(config),issues=[],seen=new Set();
 const issue=(section,text)=>issues.push({section,text});
 for(const branch of config.branches){const managers=config.operationsManagers.filter(person=>person.branch===branch);if(managers.length!==1)issue('people',branch+': '+(managers.length?'more than one Operations Manager is assigned.':'no Operations Manager is assigned.'));}
 for(const person of people){
  if(seen.has(person.name))issue('people',person.name+' appears more than once.');seen.add(person.name);
  if(!config.departments.includes(person.department))issue('people',person.name+': check the department assignment.');
  if(!config.branches.includes(person.branch)||(person.availableBranches||[]).some(branch=>!config.branches.includes(branch)))issue('people',person.name+': check the home branch and allowed branches.');
 }
 const reports=reportTemplates(config).filter(report=>report.enabled);
 for(const report of reports)if(!config.departments.includes(report.department))issue('dailyReports',report.name+': its department is no longer available.');
 if(!config.teamLeaders.some(person=>person.department===config.itDepartment))issue('people','No IT Supervisor is assigned. Check who will review IT reports.');
 if(!config.priorities.includes('Critical'))issue('priorities','Critical priority is missing.');
 if(!config.checks.length)issue('checks','Opening Rounds has no system checks.');
 if(!reports.length)issue('dailyReports','No daily report templates are enabled.');
 const backup=()=>{const data={format:'tcc-task-workspace-settings',version:1,exportedAt:new Date().toISOString(),settings:config};const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='task-workspace-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 return <div className="tm-workspace-review"><header><div><h3>Setup review</h3><p>Check common setup issues before assigning tasks.</p></div><button type="button" className="tm-secondary" onClick={backup}>Download settings backup</button></header>
 <div className="tm-setup-overview-counts">{[[seen.size,'People','people'],[config.branches.length,'Branches','branches'],[config.departments.length,'Departments','departments'],[reports.length,'Enabled reports','dailyReports']].map(([count,label,section])=><button type="button" key={label} onClick={()=>onOpen(section)}><strong>{count}</strong><span>{label} ↗</span></button>)}</div>
 <section><h4>{issues.length?issues.length+' items to review':'No common setup issues found'}</h4>{issues.length?<ul className="tm-setup-review-list">{issues.map((item,index)=><li key={index}><span>{item.text}</span><button type="button" className="tm-text-button" onClick={()=>onOpen(item.section)}>Open settings ↗</button></li>)}</ul>:<p>Manager coverage, people assignments, priorities, and report templates passed these setup checks.</p>}</section>
 <p className="tm-daily-caption">The backup contains this browser’s Task Module settings, including employee names and local overrides. It does not include task records or change Employee Management.</p>
 </div>;
}
