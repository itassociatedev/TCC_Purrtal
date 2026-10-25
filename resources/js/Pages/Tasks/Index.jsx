import {prepareTaskImport} from './taskCsv.mjs';
import {validateCollaborativeSubmission} from './collaborativeTasks.mjs';
import CsvImportControl from '@/Components/CsvImportControl';
import {downloadCsv} from '@/Utils/csv.mjs';
import DismissOpeningReport from './DismissOpeningReport.jsx';
import {canDismissOpeningReport, dismissOpeningReport} from './dismissOpeningReport.mjs';
import OpeningWarning from './OpeningWarning.jsx';
import { canAccessWeeklyReports, canReviewWeeklyReports, canViewWeeklyReport } from './weeklyReportAccess.mjs';
import TaskFilters from './TaskFilters.jsx';
import { indexTasks, reportSectionTasks, reportMatchesDate, activityReport } from './taskViews.mjs';
import TaskDetailLayout from './TaskDetailLayout.jsx';
import TaskHistory from './TaskHistory.jsx';
import { corporatePositions } from './organizationStructure.mjs';
import { companySettings, reconcileRosterTasks, rememberTaskDirectoryChanges } from './companyDirectory.mjs';
import { sortPreviewRoles, sortPreviewPeople, groupPreviewPeople, previewMember } from './previewDirectory.mjs';
import { addRoleSampleTasks } from './sampleRoleTasks.mjs';
import {routeTaskApproval,canApproveTaskRequest,approvalBlocksWork,backfillRequestApprovals} from './taskApproval.mjs';
import TaskCollection,{isCreativeTaskPage} from './TaskCollection.jsx';
import {workspacePeople,resetTaskPerson,editWorkspacePerson} from './peopleSetup.mjs';
import DashboardTaskList from './DashboardTaskList.jsx';
import TeamProgressCards from './TeamProgressCards.jsx';
import '../../../css/task-planning.css';
import '../../../css/task-form.css';
import '../../../css/task-dashboard.css';
import TaskOverview from './TaskOverview.jsx';
import CollaborationCreateFields from './CollaborationCreateFields.jsx';
import DeleteTaskControl from './DeleteTaskControl.jsx';
import { deleteTaskTree } from './taskDeletion.mjs';
import { taskListScope } from './personalTasks.mjs';
import { assignmentDirectory, eligibleAssignees, canAssignAcrossRoles, taskEditAssignees } from './assignmentDirectory.mjs';
import CollaborativeTasks from './CollaborativeTasks.jsx';
import { isCollaborativeTask, childTasks, dependencyBlockers, createChildTask, canReviewCollaborativeChild, createCollaborativeMain, removeIncorrectCollaborations, childDeadline, canCompleteMainTask, canCreateCollaborative, canMonitorCollaborative, monitorMatchesAssignment, appendCollaborativeChild } from './collaborativeTasks.mjs';
import TaskPings from './TaskPings.jsx';
import { sendTaskPing, acknowledgeTaskPing, validPingChange } from './taskPings.mjs';
import TaskNotifications from './TaskNotifications.jsx';
import { taskNotificationChanges, publishTaskNotifications, overdueNotifications, notificationForTask } from './taskNotifications.mjs';
import CalendarHelp from './CalendarHelp.jsx';
import CalendarTaskList from './CalendarTaskList.jsx';
import OverdueBadge from './OverdueBadge.jsx';
import { previewView } from './previewNavigation.mjs';
import CalendarEmployeeList from './CalendarEmployeeList.jsx';
import { employeeTaskGroups, calendarDayPreview, employeeOverdueCounts } from './calendarEmployees.mjs';
import EmployeeSchedule from './EmployeeSchedule.jsx';
import { scheduledBranch, applyBranchAssignment } from './workSchedule.mjs';
import WeeklyReport from './WeeklyReport.jsx';
import { isIntern, isWeeklyReport, canEditWeeklyReport, formatWeeklyReport } from './weeklyReports.mjs';
import { reportStatus } from './reportStatus.mjs';
import PagedList from './PagedList.jsx';
import CustomDailyReport from './CustomDailyReport.jsx';
import { formatCustomReport } from './reportTemplates.mjs';
import { Head, router, usePage } from '@inertiajs/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import SidebarLayout from '@/Layouts/SidebarLayout';
import '../../../css/tasks.css';
import '../../../css/task-collections.css';
import { filterTasks, isOverdue } from './taskFilters.mjs';
import { branches, departments, employees, employeeByName, sampleTaskOwner, ensureOpeningRounds, operationsManagers, teamLeaders, managerForBranch, leaderForDepartment, tasksForPreview, employeesForPreview } from './taskDirectory.mjs';
import OpeningRounds from './OpeningRounds.jsx';
import NarrativeReport from './NarrativeReport.jsx';
import OperationsReport from './OperationsReport.jsx';
import { formatOperations } from './operationsReport.mjs';
import { clinicDate, ensureDailyTasks, formatNarrative, isDailyTemplate, dashboardDailyTasks } from './dailyTasks.mjs';
import { formatRounds } from './openingRounds.mjs';
import WorkspaceSetup from './WorkspaceSetup.jsx';
import { canRequestTask, branchScopedRole, pageTitle, canSubmitAssignedTask, canEditDailyReport, dailyReportTypes, itReportDone, canCorrectITReport } from './taskPolicy.mjs';
import { loadSettings, changeSetting, eligibleEmployees, canWorkAt } from './taskSettings.mjs';

// Prototype fixtures: these names and roles are examples, not database records.
const people = employees.map(employee => employee.name);
const roles = ['Employee', 'Team Leader', 'Operations Manager', 'Chief Vet', 'EVP'];
// Use local calendar dates for task deadlines; avoid UTC conversion shifting the day.
const dateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = clinicDate();
const dayOffset = n => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
const prettyDate = value => new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
  month: 'short',
  day: 'numeric'
});
// Seed a mix of workflow states with deadlines relative to today for a useful preview.
const seed = ensureOpeningRounds([['Prepare daily clinic summary', 0, 'High', 0, 'In Progress', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Update inventory tracker', 1, 'Medium', 1, 'Not Started', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Submit monthly inventory report', 2, 'High', -1, 'In Progress', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Review client follow-ups', 3, 'Low', 2, 'Pending Review', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Clean and sanitize treatment area', 4, 'Medium', 3, 'Completed', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Log operational output', 0, 'Medium', 0, 'Not Started', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Prepare staff meeting agenda', 1, 'Low', 5, 'Revision Needed', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.'], ['Check medical supplies', 3, 'High', 4, 'Completed', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.']].map(([title, person, priority, offset, status, description], i) => ({
  id: i + 1,
  title,
  assignee: sampleTaskOwner(i)?.name || people[person],
  priority,
  due: dayOffset(offset),
  status,
  description,
  submission: status === 'Pending Review' ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' : '',
  link: '',
  remarks: status === 'Revision Needed' ? 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.' : '',
  kind: 'Assigned task'
})), today);
// Shared SVG paths keep navigation and action icons consistent without another library.
const icons = {
  dashboard: 'M3 10l9-7 9 7v10H3z M9 20v-7h6v7',
  tasks: 'M9 6h12M9 12h12M9 18h12M3 5l1 1 2-2M3 11l1 1 2-2M3 17l1 1 2-2',
  calendar: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
  team: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M18 8a3 3 0 010 6M22 21v-2a4 4 0 00-3-4M12 7a4 4 0 11-8 0 4 4 0 018 0',
  plus: 'M12 5v14M5 12h14',
  check: 'M5 12l4 4L19 6',
  clock: 'M12 8v5l3 2M22 12a10 10 0 11-20 0 10 10 0 0120 0',
  archive: 'M3 3h18v5H3zM5 8v13h14V8M9 12h6',
  report: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  bell: 'M18 8a6 6 0 00-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
  arrow: 'M5 12h14M14 7l5 5-5 5',
  search: 'M21 21l-5-5M18 10a8 8 0 11-16 0 8 8 0 0116 0',
  close: 'M6 6l12 12M6 18L18 6'
};
// Small presentation helpers used throughout the module.
function Icon({
  name,
  size = 20
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icons[name] || icons.tasks} /></svg>;
}
// Shared status cue uses an icon and text so the meaning does not rely on color alone.
function ReportStatus({ status, count }) {
  const cue = reportStatus(status);
  return <span className={`tm-report-state tm-report-state-${cue.tone}`}><Icon name={cue.icon} size={16} />{cue.label}{count != null ? ` · ${count}` : ''}</span>;
}
// Convert a status or priority label into its matching scoped CSS class.
function Badge({
  value
}) {
  return <span className={`tm-badge tm-${value.toLowerCase().replaceAll(' ', '-')}`}>{value}</span>;
}
// Show initials for sample assignees without requiring profile images.
function Avatar({
  name
}) {
  return <span className="tm-avatar">{name.split(' ').map(p => p[0]).slice(0, 2).join('')}</span>;
}
// Keep dashboard sections consistent with a shared title and optional action button.
function Panel({
  title,
  action,
  onAction,
  children,
  className = ''
}) {
  return <section className={`tm-panel ${className}`}><div className="tm-panel-heading"><h2>{title}</h2>{action && <button className="tm-text-button" onClick={onAction}>{action} <span aria-hidden="true">↗</span></button>}</div>{children}</section>;
}

// UI prototype only: task changes stay in browser storage until backend integration.
export default function TaskModule() {
  const { taskDirectory } = usePage().props;
  if (taskDirectory && !companySettings(loadSettings(),taskDirectory).employees.length) {
    return <SidebarLayout><Head title="Task Module" /><div className="tm-empty"><h2>No employees available</h2><p>No staff records are available for the Task Module.</p></div></SidebarLayout>;
  }
  return <TaskWorkspace />;
}
function TaskWorkspace() {
  const {
    auth, taskDirectory, taskAdmin
  } = usePage().props;
  const canManageSetup = taskAdmin === true;
  const {
    url
  } = usePage();
  // Separate sample task storage by the signed-in portal user.
  const storageKey = `purrtal-task-ui-v2-${auth.user.id}${taskDirectory ? '-company-v1' : ''}`;
  const initialTasks = taskDirectory ? [] : seed;
  const settingsForDirectory = raw => companySettings(loadSettings(raw), taskDirectory);
  const [today, setToday] = useState(() => clinicDate());
  // Refresh at midnight in Asia/Manila, and when returning to a suspended browser tab.
  useEffect(() => {
    const refresh = () => setToday(clinicDate());
    const timer = setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);
  const [config, setConfig] = useState(() => {
    try {
      return settingsForDirectory(JSON.parse(localStorage.getItem(storageKey + '-settings')));
    } catch {
      return settingsForDirectory();
    }
  });
  const {
    branches,
    departments,
    employees,
    operationsManagers,
    teamLeaders
  } = config;
  const allAssignees = useMemo(() => assignmentDirectory(config), [config]);
  const directoryByName = useMemo(() => new Map(allAssignees.map(person => [person.name, person])), [allAssignees]);
  const people = employees.map(person => person.name);
  const roles = sortPreviewRoles(config.roles).map(item => item.name);
  const employeeByName = name => directoryByName.get(name);
  const managerForBranch = branch => operationsManagers.find(person => person.branch === branch) || {
    name: 'Not assigned'
  };
  const leaderForDepartment = department => teamLeaders.find(person => person.department === department) || employees.find(person => person.department === department && person.employeeType === 'Supervisor') || {
    name: 'Not assigned'
  };
  useEffect(() => {
    try {
      localStorage.setItem(storageKey + '-settings', JSON.stringify(config));
    } catch {}
  }, [config, storageKey]);
  function cleanIncorrectCollaborations(savedTasks) {
    const cleanupKey = `${storageKey}-incorrect-collaborations-removed-v1`;
    if (localStorage.getItem(cleanupKey)) return savedTasks;
    const cleaned = removeIncorrectCollaborations(savedTasks);
    try {
      if (cleaned !== savedTasks) {
        const kept = new Set(cleaned.map(task => task.id));
        const removed = new Set(savedTasks.filter(task => !kept.has(task.id)).map(task => task.id));
        localStorage.setItem(storageKey, JSON.stringify(cleaned));
        const notificationKey = `${storageKey}-notifications`;
        const notifications = JSON.parse(localStorage.getItem(notificationKey) || '[]');
        localStorage.setItem(notificationKey, JSON.stringify(notifications.filter(item => !removed.has(item.taskId))));
      }
      localStorage.setItem(cleanupKey, 'done');
    } catch {}
    return cleaned;
  }
  const [tasks, setTasks] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey));
      if (!Array.isArray(data) || !data.every(t => t.id && t.title && t.due && t.status)) return ensureDailyTasks(cleanIncorrectCollaborations(initialTasks), config, today);
      // Update old placeholder titles without resetting saved task progress or custom tasks.
      return ensureDailyTasks(cleanIncorrectCollaborations((taskDirectory ? reconcileRosterTasks(data, config) : data).map(task => {
        const sample = seed.find(item => item.id === task.id);
        const restored = sample && task.title === `Lorem ipsum task ${task.id}` ? {
          ...task,
          title: sample.title
        } : task;
        const person = employeeByName(restored.assignee);
        // Work location is independent from home location; never overwrite a saved work branch.
        return {
          ...restored,
          department: restored.department || person?.department || config.departments[0],
          assigneeRole: person?.role || restored.assigneeRole,
          branch: restored.branch || person?.branch || config.branches[0]
        };
      })), config, today);
    } catch {
      return ensureDailyTasks(cleanIncorrectCollaborations(initialTasks), config, today);
    }
  });
  const previousNotificationTasks = useRef(tasks);
  useEffect(() => {
    const key=`${storageKey}-role-samples-v1`;
    if(localStorage.getItem(key))return;
    setTasks(previous=>addRoleSampleTasks(previous,config,today));
    localStorage.setItem(key,'added');
  }, [storageKey]);
  const previousDirectory = useRef(taskDirectory);
  useEffect(() => {
    if (!taskDirectory || previousDirectory.current === taskDirectory) return;
    previousDirectory.current = taskDirectory;
    const next = companySettings(config,taskDirectory);
    setConfig(next);
    setTasks(current => reconcileRosterTasks(current,next));
  }, [taskDirectory]);
  useEffect(() => {
    if (!taskDirectory) return;
    let refreshedAt = 0;
    const refreshDirectory = () => {
      if (document.visibilityState === 'hidden' || Date.now()-refreshedAt < 1000) return;
      refreshedAt = Date.now();
      router.reload({only:['taskDirectory'],preserveState:true,preserveScroll:true});
    };
    window.addEventListener('focus',refreshDirectory);
    return () => window.removeEventListener('focus',refreshDirectory);
  }, []);
  useEffect(() => {
    const events = taskNotificationChanges(previousNotificationTasks.current, tasks, { name: actor?.name, role: roleLabel });
    previousNotificationTasks.current = tasks;
    try { publishTaskNotifications(storageKey, events); } catch { /* Tasks remain usable when browser storage is full. */ }
  }, [tasks, storageKey]);
  useEffect(() => {
    try { publishTaskNotifications(storageKey, overdueNotifications(tasks, today)); } catch {}
  }, [tasks, today, storageKey]);
  // New days get new instances; completed reports remain in history and are never reset.
  useEffect(() => {
    setTasks(previous => ensureDailyTasks(backfillRequestApprovals(previous,config), config, today));
  }, [config, today]);
  // Preview role changes presentation only; it does not grant server permissions.
  const [roleLabel, setRole] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey + '-role');
      if (saved === 'Supervisor') return 'Employee';
      if (Object.values(corporatePositions).includes(saved)) return 'Corporate Services';
      return roles.includes(saved) ? saved : roles.includes('Team Leader') ? 'Team Leader' : roles[0];
    } catch {
      return roles.includes('Team Leader') ? 'Team Leader' : roles[0];
    }
  });
  const role = config.roles.find(item => item.name === roleLabel)?.baseRole || 'Employee';
  // Preserve the selected preview role across shared sidebar navigation.
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey + '-role', roleLabel);
    } catch {}
  }, [roleLabel, storageKey]);
  const [previewEmployee, setPreviewEmployee] = useState(() => {
    try {
      if (sessionStorage.getItem(storageKey + '-role') === 'Supervisor') {
        const department = sessionStorage.getItem(storageKey + '-tl-department');
        const supervisor = employees.find(person => person.department === department && person.employeeType === 'Supervisor');
        if (supervisor) return supervisor.name;
      }
      const name = sessionStorage.getItem(storageKey + '-employee');
      return employeeByName(name) ? name : people[0];
    } catch {
      return people[0];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey + '-employee', previewEmployee);
    } catch {}
  }, [previewEmployee, storageKey]);
  const currentEmployee = employeeByName(previewEmployee) || employees[0];
  const [workBranch, setWorkBranch] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey + '-work-branch') || currentEmployee.branch;
    } catch {
      return currentEmployee.branch;
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey + '-work-branch', workBranch);
    } catch {}
  }, [workBranch, storageKey]);
  // Leadership identities are unique to a branch (OM) or department (TL), and survive sidebar navigation.
  const [omBranch, setOmBranch] = useState(() => {
    try {
      const branch = sessionStorage.getItem(storageKey + '-om-branch');
      return branches.includes(branch) ? branch : 'Makati';
    } catch {
      return 'Makati';
    }
  });
  const [tlDepartment, setTlDepartment] = useState(() => {
    try {
      const department = sessionStorage.getItem(storageKey + '-tl-department');
      return departments.includes(department) ? department : 'IT';
    } catch {
      return 'IT';
    }
  });
  const [previewLeaderName, setPreviewLeaderName] = useState(() => {
    try { return sessionStorage.getItem(storageKey + '-tl-person') || ''; } catch { return ''; }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey + '-om-branch', omBranch);
      sessionStorage.setItem(storageKey + '-tl-department', tlDepartment);
      sessionStorage.setItem(storageKey + '-tl-person', previewLeaderName);
    } catch {}
  }, [omBranch, tlDepartment, previewLeaderName, storageKey]);
  const [vetBranch, setVetBranch] = useState(() => {
    try {
      const saved = sessionStorage.getItem(storageKey + '-vet-branch');
      return branches.includes(saved) ? saved : branches[0];
    } catch {
      return branches[0];
    }
  });
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey + '-vet-branch', vetBranch);
    } catch {}
  }, [vetBranch, storageKey]);
  const [previewRoleMember, setPreviewRoleMember] = useState(() => {
    try {
      const previousRole = sessionStorage.getItem(storageKey + '-role');
      return sessionStorage.getItem(storageKey + '-role-member') || config.roleHolders.find(person => person.role === 'Corporate Services' && person.position === previousRole)?.name || '';
    } catch { return ''; }
  });
  useEffect(() => { try { sessionStorage.setItem(storageKey + '-role-member',previewRoleMember); } catch {} }, [previewRoleMember,storageKey]);
  const availableDepartmentLeaders = sortPreviewPeople(teamLeaders.filter(person => (person.role || 'Team Leader') === roleLabel));
  const selectedDepartmentLeader = availableDepartmentLeaders.find(person => person.name === previewLeaderName) || availableDepartmentLeaders.find(person => person.department === tlDepartment) || availableDepartmentLeaders[0];
  const roleMembers = sortPreviewPeople(allAssignees.filter(person => person.role === roleLabel));
  const actor = role === 'Employee' ? currentEmployee : role === 'Team Leader' ? allAssignees.find(person => person.name === selectedDepartmentLeader?.name) : role === 'Operations Manager' ? allAssignees.find(person => person.name === managerForBranch(omBranch).name) : previewMember(roleMembers,previewRoleMember,role === 'Chief Vet' ? vetBranch : undefined);
  const leadershipBranch = role === 'Chief Vet' ? actor?.branch || vetBranch : omBranch;
  useEffect(() => { if (role === 'Chief Vet' && actor?.branch && vetBranch !== actor.branch) setVetBranch(actor.branch); }, [role,actor?.branch,vetBranch]);
  useEffect(() => {
    if (role === 'Team Leader' && selectedDepartmentLeader) {
      if (selectedDepartmentLeader.department !== tlDepartment) setTlDepartment(selectedDepartmentLeader.department);
      if (selectedDepartmentLeader.name !== previewLeaderName) setPreviewLeaderName(selectedDepartmentLeader.name);
    }
  }, [role, roleLabel, tlDepartment, previewLeaderName, config]);
  const previewScope = useMemo(() => ({
    actor: actor?.name,
    role,
    roleName: roleLabel,
    itDepartment: config.itDepartment,
    branch: leadershipBranch,
    department: role === 'Team Leader' ? selectedDepartmentLeader?.department || tlDepartment : tlDepartment,
    employee: previewEmployee,
    employeeDepartment: currentEmployee.department,
    employeeType: currentEmployee.employeeType
  }), [actor?.name, role, roleLabel, config.itDepartment, leadershipBranch, selectedDepartmentLeader?.department, tlDepartment, previewEmployee, currentEmployee.employeeType, currentEmployee.department]);
  const weeklyReportsAllowed = canAccessWeeklyReports(previewScope);
  const weeklyReviewAllowed = canReviewWeeklyReports(previewScope);
  const assignableEmployees = eligibleAssignees(config, previewScope);
  const allowedDepartments = [...new Set(assignableEmployees.map(employee => employee.department))];
  const allowedBranches = canAssignAcrossRoles(role) ? branches : branchScopedRole(role) ? [leadershipBranch] : [...new Set(assignableEmployees.flatMap(employee => employee.availableBranches || [employee.branch]))];
  // Reconcile selectors after setup renames or removes an unused configuration value.
  useEffect(() => {
    if (!roles.includes(roleLabel)) setRole(roles[0]);
    if (!employeeByName(previewEmployee)) setPreviewEmployee(people[0]);
    if (!branches.includes(omBranch)) setOmBranch(branches[0]);
    if (!branches.includes(vetBranch)) setVetBranch(branches[0]);
    if (!departments.includes(tlDepartment)) setTlDepartment(departments[0]);
    if (!canWorkAt(currentEmployee, workBranch)) setWorkBranch(currentEmployee.branch);
  }, [config, previewEmployee, workBranch, roleLabel, omBranch, vetBranch, tlDepartment]);
  // Assignment controls stay synchronized: a task belongs to its assignee's department and branch.
  const [taskPurpose, setTaskPurpose] = useState('Assigned task');
  const [assignment, setAssignment] = useState({
    ...employees[0],
    template: 'standard'
  });
  const chooseAssignment = changes => {
    setAssignment(previous => {
      let next = {
        ...previous,
        ...changes
      };
      const choosingMonitor = next.template === 'collaborative' && modal === 'create';
      const available = choosingMonitor ? allAssignees.filter(canMonitorCollaborative) : formAssignees;
      if (choosingMonitor) next.roleFilter = 'All';
      const candidatePool = available.filter(person => !next.roleFilter || next.roleFilter === 'All' || person.role === next.roleFilter);
      if (changes.roleFilter || changes.template === 'collaborative') {
        const first = candidatePool.find(person => canWorkAt(person, next.branch)) || candidatePool[0];
        if (first) next = { ...next, name: first.name, department: first.department, branch: canWorkAt(first, next.branch) ? next.branch : first.branch };
      }
      if (changes.name) {
        const person = employeeByName(changes.name);
        next = {
          ...next,
          ...person,
          department: choosingMonitor ? next.department : person.department,
          branch: canWorkAt(person, next.branch) ? next.branch : person.branch
        };
      }
      if (next.template === 'it-opening-rounds') next.department = config.itDepartment;
      if (modal !== 'edit' && branchScopedRole(role) && !canAssignAcrossRoles(role)) next.branch = leadershipBranch;
      const matches = person => choosingMonitor ? monitorMatchesAssignment(person, next) : person.department === next.department && canWorkAt(person, next.branch);
      const person = candidatePool.find(person => person.name === next.name && matches(person)) || candidatePool.find(matches);
      return person ? {
        ...next,
        ...person,
        department: choosingMonitor ? next.department : person.department,
        branch: next.branch
      } : {
        ...next,
        name: ''
      };
    });
  };
  const [view, setView] = useState('Dashboard');
  const [teamProgressView, setTeamProgressView] = useState('People');
  const [reportSection, setReportSection] = useState('Reports');
  const [reportDate, setReportDate] = useState(today);
  const [logFrom,setLogFrom]=useState('');
  const [logTo,setLogTo]=useState('');
  // Read sidebar destinations from the URL so the shared portal navigation can open each screen.
  useEffect(() => {
    const requested = new URLSearchParams(url.split('?')[1]).get('view') || 'Dashboard';
    const aliases = {
      Approvals: 'Review Queue',
      Notifications: 'Activity',
      Reports: separateDailyReports ? 'Daily Reports' : reportTypes.length ? 'Daily Tasks' : 'Weekly Reports'
    };
    const next = aliases[requested] || (requested === 'Submissions' && role !== 'Employee' ? 'Review Queue' : requested === 'Team Tasks' && role === 'Employee' ? 'My Tasks' : requested);
    resetFilters();
    if (next === 'Workspace Setup' && !canManageSetup) {
      setView('Dashboard');
      return;
    }
    if (next === 'Create Task' && role !== 'Employee') {
      setModal('create');
      setView('Dashboard');
    } else setView(next === 'Create Task' ? 'Dashboard' : next);
  }, [url,canManageSetup]);
  // Search, filters, calendar selection, and dialogs are local interface state.
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All Tasks');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [assigneeFilter, setAssigneeFilter] = useState('All');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [branchFilter, setBranchFilter] = useState('All');
  const [dueFilter, setDueFilter] = useState('All');
  const [sort, setSort] = useState('due');
  const [dailyDate, setDailyDate] = useState(today);
  const [dailyTemplate, setDailyTemplate] = useState('All');
  const [dailyReportGroup, setDailyReportGroup] = useState('it-opening-rounds');
  useEffect(() => {
    setDailyDate(today);
  }, [today]);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(null);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const formAssignees = modal === 'edit' ? taskEditAssignees(config, previewScope, selected) : taskPurpose === 'Self-created request' && assignment.template !== 'collaborative' ? allAssignees.filter(person=>person.name===actor?.name) : assignableEmployees;
  const matchingFormAssignees=formAssignees.filter(person=>person.department===assignment.department && canWorkAt(person,assignment.branch) && (!assignment.roleFilter||assignment.roleFilter==='All'||person.role===assignment.roleFilter));
  const formDepartments = modal !== 'edit' && taskPurpose === 'Self-created request' ? [...new Set(formAssignees.map(person=>person.department))] : modal === 'edit' ? [...new Set([...allowedDepartments, selected?.department].filter(Boolean))] : allowedDepartments;
  const formBranches = modal !== 'edit' && taskPurpose === 'Self-created request' ? [...new Set(formAssignees.flatMap(person=>person.availableBranches || [person.branch]))] : modal === 'edit' ? [...new Set([...allowedBranches, selected?.branch].filter(Boolean))] : allowedBranches;
  const [calendarEmployee, setCalendarEmployee] = useState(null);
  const [calendarSearch, setCalendarSearch] = useState('');
  const [notice, setNotice] = useState('');
  // Preserve the activity feed alongside task history across refreshes.
  const [activity, setActivity] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey + '-activity'));
      if (Array.isArray(saved) && saved.every(event => typeof event.text === 'string' && typeof event.time === 'string')) return saved;
    } catch {}
    return taskDirectory ? [] : [{
      text: 'John Doe 4 submitted “Review client follow-ups” for review.',
      branch: 'Makati',
      department: 'Reception',
      assignee: 'John Doe 4',
      time: 'Sample activity'
    }, {
      text: 'Clean and sanitize treatment area was approved.',
      branch: 'Alabang',
      department: 'Clinic Assistant',
      assignee: 'John Doe 5',
      time: 'Sample activity'
    }, {
      text: 'Prepare staff meeting agenda returned for revision.',
      branch: 'Makati',
      department: 'HR',
      assignee: 'John Doe 44',
      time: 'Sample activity'
    }];
  });
  useEffect(() => {
    try {
      localStorage.setItem(storageKey + '-activity', JSON.stringify(activity));
    } catch {}
  }, [activity, storageKey]);
  const activityTime = value => value === 'Sample activity' ? value : new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila'
  });
  // Derive dashboard totals from the currently visible sample tasks.
  const isEmployee = role === 'Employee';
  const internEmployee = isEmployee && isIntern(currentEmployee, config);
  const isReportTask = task => isDailyTemplate(task) || isWeeklyReport(task);
  const reportTypes = dailyReportTypes({ role, department: isEmployee ? currentEmployee.department : tlDepartment, config });
  const reportTypeIds = reportTypes.map(([template]) => template);
  // Hide unrelated legacy reports from employee and department views as well as their shortcuts.
  const workspaceTasks = useMemo(() => tasksForPreview(tasks, previewScope).filter(task => role !== 'Operations Manager' || !isDailyTemplate(task)).filter(task => !isDailyTemplate(task) || !['Employee', 'Team Leader'].includes(role) || task.department === (isEmployee ? currentEmployee.department : tlDepartment)), [tasks, previewScope, role, isEmployee, currentEmployee.department, tlDepartment]);
  // Leaders review daily reports in a dedicated workspace; regular task counts stay independent.
  const separateDailyReports = ['EVP', 'Team Leader'].includes(role);
  const visible = useMemo(() => workspaceTasks.filter(task => !isReportTask(task)), [workspaceTasks]);
  const taskIndex = useMemo(() => indexTasks(tasks), [tasks]);
  const visibleIndex = useMemo(() => indexTasks(visible), [visible]);
  const workspaceIndex = useMemo(() => indexTasks(workspaceTasks), [workspaceTasks]);
  const reports = useMemo(() => tasks.filter(isReportTask), [tasks]);
  const dailyReportGroups = [...new Set([...reportTypeIds, ...workspaceTasks.filter(isDailyTemplate).map(task => task.template)])].map(id => ({id, label: id === 'it-opening-rounds' ? 'Opening Reports' : id === 'narrative-report' ? 'Narrative Reports' : reportTypes.find(([template]) => template === id)?.[1] || workspaceTasks.find(task => task.template === id)?.reportDefinition?.name || workspaceTasks.find(task => task.template === id)?.title || 'Other Reports'})).sort((a,b) => (a.id === 'it-opening-rounds' ? -2 : a.id === 'narrative-report' ? -1 : 0) - (b.id === 'it-opening-rounds' ? -2 : b.id === 'narrative-report' ? -1 : 0));
  const activeDailyReportGroup = dailyReportGroups.some(group => group.id === dailyReportGroup) ? dailyReportGroup : dailyReportGroups[0]?.id;
  const dailyReportTabs = <div className="tm-daily-type-tabs" role="group" aria-label="Daily report type">{dailyReportGroups.map(group => <button type="button" key={group.id} aria-pressed={activeDailyReportGroup === group.id} onClick={() => { setDailyReportGroup(group.id); setDailyTemplate('All'); }}>{group.label}</button>)}</div>;
  const reportEntries = useMemo(() => reportSectionTasks(workspaceTasks, { weekly: view === 'Weekly Reports', section: reportSection, date: reportDate }).filter(task => (view !== 'Daily Reports' || task.template === activeDailyReportGroup) && (reportSection !== 'Review Queue' || task.assignee !== actor?.name)), [workspaceTasks, view, reportSection, reportDate, actor?.name, activeDailyReportGroup]);
  useEffect(() => {
    if (dailyTemplate !== 'All' && !reportTypeIds.includes(dailyTemplate)) setDailyTemplate('All');
  }, [role, currentEmployee.department, tlDepartment, config, dailyTemplate]);
  useEffect(() => {
    if (isEmployee && reportSection === 'Review Queue') setReportSection('Reports');
  }, [isEmployee, reportSection]);
  // Older unscoped activity stays stored but is not attributed to a branch or department without evidence.
  const visibleActivity = activity.filter(event => !['Employee', 'Operations Manager', 'Team Leader', 'Chief Vet'].includes(role) || event.branch && event.department && tasksForPreview([event], previewScope).length > 0);
  const categorizedActivity = useMemo(() => visibleActivity.map(event => ({ event, report: activityReport(event, taskIndex.byId, reports) })), [activity, workspaceTasks, previewScope, taskIndex, reports]);
  const logMatchesDate=event=>{const parsed=new Date(event.time);const date=Number.isNaN(parsed.getTime())?'':clinicDate(parsed);return (!logFrom||date>=logFrom)&&(!logTo||date<=logTo);};
  const reportActivity = categorizedActivity.filter(({ report }) => report && (view === 'Weekly Reports' ? isWeeklyReport(report) : isDailyTemplate(report) && report.template === activeDailyReportGroup) && reportMatchesDate(report, reportDate)).map(({ event }) => event).filter(logMatchesDate);
  const scopedActivity = categorizedActivity.filter(({ report }) => !report).map(({ event }) => event).filter(logMatchesDate);
  const overdue = task => isOverdue(task, today);
  const overdueCounts = employeeOverdueCounts(visible, today);
  const participants = [...visibleIndex.byAssignee.keys()];
  const completed = visible.filter(t => t.status === 'Completed').length;
  const progress = visible.filter(t => t.status === 'In Progress').length;
  const late = visible.filter(overdue).length;
  const dailyToday = dashboardDailyTasks(workspaceTasks, today, reportTypeIds);
  const pending = visible.filter(t => t.assignee !== actor?.name && ['Pending Review', 'Pending Approval'].includes(t.status));
  const scopeLabel = role === 'Team Leader' ? tlDepartment : role === 'Operations Manager' ? omBranch : role === 'Employee' ? currentEmployee.department : role === 'Chief Vet' ? vetBranch : 'All departments & branches';
  const displayRoleLabel = internEmployee ? 'Intern' : isEmployee && currentEmployee.employeeType === 'Supervisor' ? 'Supervisor' : roleLabel;
  const reportsPage = ['Daily Reports', 'Daily Tasks', 'Weekly Reports'].includes(view);
  const title = pageTitle({
    view: reportsPage ? 'Reports' : view,
    role,
    roleLabel: displayRoleLabel,
    scope: internEmployee && view !== 'Dashboard' ? `${scopeLabel} · Intern` : scopeLabel
  });
  // Direct URLs and preview switches follow the same rule as the navigation and task actions.
  useEffect(() => {
    if (view === 'Weekly Reports' && !weeklyReportsAllowed) setView(separateDailyReports ? 'Daily Reports' : reportTypes.length ? 'Daily Tasks' : 'Dashboard');
    if (selected && isWeeklyReport(selected) && !canViewWeeklyReport(selected, previewScope)) { setSelected(null); setModal(null); }
  }, [view, weeklyReportsAllowed, selected, previewScope]);
  const saveSetting = action => {
    if (!canManageSetup) throw new Error('Workspace Setup is available to administrators only.');
    if(action.entity==='people'&&taskDirectory){
      if(action.action==='edit'||action.action==='add'){
        const next=editWorkspacePerson(config,action.original,action.value,tasks);
        setConfig(next);setTasks(current=>reconcileRosterTasks(current,next));setNotice('Person updated in this Task Module workspace only.');return;
      }
      const person=workspacePeople(config,taskDirectory).find(person=>String(person.id)===String(action.original));
      if(!person)throw new Error('Person not found.');
      const next=action.action==='reset'?resetTaskPerson(config,taskDirectory,person.id):companySettings({...config,taskPeopleOverrides:{...(config.taskPeopleOverrides||{}),[person.id]:{...(config.taskPeopleOverrides?.[person.id]||{}),hidden:action.action==='hide'}}},taskDirectory);
      setConfig(next);setTasks(current=>reconcileRosterTasks(current,next));
      setNotice(action.action==='reset'?'Employee Management values restored.':action.action==='hide'?'Person hidden from new task choices. Task history stays saved.':'Person restored to task choices.');
      return;
    }
    if (action.action === 'hide' && taskDirectory) {
      const person=(config[action.entity]||[]).find(person=>person.name===action.original);
      if(!person)throw new Error('Person not found.');
      setConfig(previous=>companySettings({...previous,taskPeopleOverrides:{...(previous.taskPeopleOverrides||{}),[person.id]:{...(previous.taskPeopleOverrides?.[person.id]||{}),hidden:true}}},taskDirectory));
      setNotice(`${person.name} hidden from Task Module choices. Task history is preserved.`);
      return;
    }
    const result = changeSetting(config, tasks, action);
    setConfig(taskDirectory ? rememberTaskDirectoryChanges(config,result.config) : result.config);
    setTasks(result.tasks);
    if (action.action === 'edit') {
      const renamed = String(action.value.name).trim();
      if (action.entity === 'branches') {
        if (omBranch === action.original) setOmBranch(renamed);
        if (vetBranch === action.original) setVetBranch(renamed);
        if (workBranch === action.original) setWorkBranch(renamed);
      }
      if (action.entity === 'departments' && tlDepartment === action.original) setTlDepartment(renamed);
      if (action.entity === 'employees' && previewEmployee === action.original) setPreviewEmployee(renamed);
      if (action.entity === 'roles' && roleLabel === action.original) setRole(renamed);
      const key = {
        branches: 'branch',
        departments: 'department',
        employees: 'assignee'
      }[action.entity];
      if (key) setActivity(previous => previous.map(event => event[key] === action.original ? {
        ...event,
        [key]: renamed
      } : event));
    }
    setNotice('Workspace settings updated.');
  };
  const saveWorkAssignment = (date, branch) => {
    if (role !== 'Employee' || currentEmployee.department !== config.itDepartment || !date || date < today || (branch !== null && branch !== 'Off' && !canWorkAt(currentEmployee, branch))) return;
    const branchSchedule = { ...currentEmployee.branchSchedule };
    if (branch === null) delete branchSchedule[date]; else branchSchedule[date] = branch;
    const updated = { ...currentEmployee, branchSchedule };
    const place = scheduledBranch(updated, date);
    setConfig(previous => ({ ...previous, employees: previous.employees.map(person => person.name === updated.name ? updated : person) }));
    setTasks(previous => applyBranchAssignment(previous, updated, date, place));
    if (date === today) setWorkBranch(place === 'Off' ? currentEmployee.branch : place);
    setNotice('Work assignment saved. Submitted reports keep their recorded branch.');
  };
  useEffect(() => {
    const place = scheduledBranch(currentEmployee, today);
    setWorkBranch(place === 'Off' ? currentEmployee.branch : place);
  }, [previewEmployee, today, currentEmployee.branch, currentEmployee.branchSchedule]);
  // Keep task edits across refreshes; inform the user if browser storage is unavailable.
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(tasks));
    } catch {
      setNotice('Browser storage is unavailable. Changes will last for this visit only.');
    }
  }, [tasks, storageKey]);
  // Dismiss transient feedback automatically instead of leaving old messages on screen.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  // Keep keyboard focus inside the dialog, support Escape, and restore focus when it closes.
  useEffect(() => {
    if (!modal) return;
    const previousFocus = document.activeElement;
    const dialog = document.querySelector('.tm-modal');
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = event => {
      if (event.key === 'Escape') {
        setModal(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, input, textarea, select, a[href]')].filter(el => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [modal]);
  // Screen transitions clear filters; task updates also refresh the open detail panel and activity feed.
  // All screen transitions begin with a clean filter state.
  function resetFilters() {
    setSearch('');
    setFilter('All Tasks');
    setPriorityFilter('All');
    setAssigneeFilter('All');
    setDepartmentFilter('All');
    setBranchFilter('All');
    setDueFilter('All');
    setSort('due');
    setDailyDate(today);
    setDailyTemplate('All');
    setSelectedDay(null);
  }
  const changePreviewScope = (nextRole = role, person = currentEmployee) => {
    // Scope changes keep calendar month/date and the current page while clearing stale person/department filters.
    setModal(null);
    setSelected(null);
    setCalendarEmployee(null);
    setDepartmentFilter('All');
    setBranchFilter('All');
    setAssigneeFilter('All');
    setCalendarSearch('');
    setView(previous => previewView(previous, nextRole, isIntern(person, config)));
  };
  const go = next => {
    if (next === 'Weekly Reports' && !weeklyReportsAllowed) { setNotice('Weekly report review is available to EVP and the IT Team Leader only.'); return; }
    if (next === 'Workspace Setup' && !canManageSetup) {
      setNotice('Workspace Setup is available to administrators only.');
      return;
    }
    resetFilters();
    setView(next === 'Reports' ? separateDailyReports ? 'Daily Reports' : reportTypes.length ? 'Daily Tasks' : 'Weekly Reports' : next);
  };
  const attention = (due, review = false) => {
    go(review && !isEmployee ? 'Review Queue' : isEmployee ? 'My Tasks' : 'Team Tasks');
    setDueFilter(due);
  };
  const reportEditable = task => canEditDailyReport(task, { role, employee: currentEmployee, config });
  const pingContext = { ...previewScope, sender: actor?.name || roleLabel };
  const canReviewTask = task => task.status==='Pending Approval'&&task.approvalReviewer ? canApproveTaskRequest(task,previewScope) : (!isWeeklyReport(task) || weeklyReviewAllowed) && task.assignee !== actor?.name && (!isEmployee || canReviewCollaborativeChild(task, tasks, previewScope));
  const update = (task, changes, message) => {
    if(approvalBlocksWork(task)&&(Object.hasOwn(changes,'submission')||['In Progress','Pending Review'].includes(changes.status))){setNotice('This request must be approved before you can start or submit work.');return;}
    if(task.status==='Pending Approval'&&changes.status==='Not Started'){
      if(!canReviewTask(task)){setNotice('Only the designated higher-up can approve this request.');return;}
      changes={...changes,approvalGrantedAt:new Date().toISOString(),approvalGrantedBy:actor?.name};
    }
    if(task.status==='Pending Approval'&&task.approvalReviewer&&changes.status&&!canApproveTaskRequest(task,previewScope)){setNotice(`Waiting for approval from ${task.approvalReviewer}.`);return;}
    const submissionError=validateCollaborativeSubmission(task,changes);if(submissionError){setNotice(submissionError);return;}
    if (isWeeklyReport(task) && !canViewWeeklyReport(task, previewScope)) { setNotice('Weekly reports are restricted to EVP, the IT Team Leader, and the assigned intern.'); return; }
    const blocked = dependencyBlockers(task, tasks);
    if (blocked.length && (['Pending Review', 'Completed'].includes(changes.status) || task.parentId && changes.status === 'In Progress')) {
      setNotice(`This task is blocked until: ${blocked.map(item => item.title).join(', ')}.`);
      return;
    }
    if (['Completed', 'Denied', 'Revision Needed'].includes(changes.status) && !canReviewTask(task) && !(changes.status === 'Completed' && canCompleteMainTask(task, tasks, previewScope))) {
      setNotice('You can only review child tasks delegated under your own collaborative main task.');
      return;
    }
    if (changes.status === 'Dismissed') {
      try { changes = dismissOpeningReport(task, previewScope, today); }
      catch(error) { setNotice(error.message); return; }
    }
    if (Object.hasOwn(changes, 'pings') && !validPingChange(task, changes.pings, pingContext)) {
      setNotice('You do not have permission to send or acknowledge this follow-up.');
      return;
    }
    // Validate standard task authorship at the write boundary as well as hiding unauthorized controls.
    if (!isReportTask(task) && (Object.hasOwn(changes, 'submission') || changes.status === 'In Progress' && task.status !== 'In Progress') && !canSubmitAssignedTask(task, { role, employee: currentEmployee, actor })) {
      setNotice('Only the assigned employee can start this task or submit its work.');
      return;
    }
    if (isWeeklyReport(task) && ['weeklyReport', 'submission'].some(key => Object.hasOwn(changes, key)) && !canEditWeeklyReport(task, currentEmployee, config, role)) {
      setNotice('Only the assigned intern can add or edit this weekly report.');
      return;
    }
    if (changes.status === 'Completed' && task.status !== 'Completed') changes = { ...changes, completedAt: new Date().toISOString() };
    // Check report writes here as well as disabling the form, preserving manager review actions.
    if (isDailyTemplate(task) && ['rounds', 'narrative', 'operations', 'customReport', 'submission'].some(key => Object.hasOwn(changes, key)) && !reportEditable(task)) {
      setNotice('Only the assigned employee in the report’s department can add or edit this report.');
      return;
    }
    setTasks(prev => prev.map(t => t.id === task.id ? {
      ...t,
      ...changes,
      history: [{
        text: message,
        at: new Date().toISOString()
      }, ...(t.history || [])]
    } : t));
    setSelected(prev => prev?.id === task.id ? {
      ...prev,
      ...changes,
      history: [{
        text: message,
        at: new Date().toISOString()
      }, ...(prev.history || [])]
    } : prev);
    setActivity(prev => [{
      text: message,
      taskId: task.id,
      template: task.template,
      scheduledDate: task.scheduledDate,
      branch: changes.branch || task.branch,
      department: changes.department || task.department,
      assignee: changes.assignee || task.assignee,
      time: new Date().toISOString()
    }, ...prev]);
    setNotice(message);
  };
  const deleteSelectedTask = () => {
    const result = deleteTaskTree(selected, tasks, previewScope);
    setTasks(result.tasks);
    setActivity(previous => [{ text: `${actor?.name || roleLabel} deleted “${selected.title}”${result.removedIds.size > 1 ? ' and its child tasks' : ''}.`, branch: selected.branch, department: selected.department, assignee: selected.assignee, time: new Date().toISOString() }, ...previous]);
    try {
      const key = `${storageKey}-notifications`;
      const saved = JSON.parse(localStorage.getItem(key) || '[]');
      localStorage.setItem(key, JSON.stringify(saved.filter(event => !result.removedIds.has(event.taskId))));
      publishTaskNotifications(storageKey, [notificationForTask(selected, 'Task deleted', `${actor?.name || roleLabel} removed this task${result.removedIds.size > 1 ? ' and its child tasks' : ''}.`)]);
    } catch {}
    setModal(null); setSelected(null); setNotice('Task deleted.');
  };
  const correctITReport = task => {
    if (!canCorrectITReport(task, { role, employee: currentEmployee, config })) return;
    // Preserve the previous submission as an audit snapshot while the correction is drafted.
    update(task, { status: 'In Progress', correcting: true, previousSubmission: { text: task.submission, status: task.status, at: new Date().toISOString() } }, 'Report reopened for correction; resubmission requires review.');
    setSelected({ ...task, status: 'In Progress', correcting: true });
    setModal('details');
  };
  const openTask = task => {
    if (isWeeklyReport(task) && !canViewWeeklyReport(task, previewScope)) { setNotice('You do not have access to this weekly report.'); return; }
    setSelected(task);
    setModal('details');
  };
  const create = () => {
    if (isEmployee) return;
    setTaskPurpose('Assigned task');
    setAssignment({
      ...(assignableEmployees.find(employee => employee.name === currentEmployee.name) || assignableEmployees[0] || currentEmployee),
      branch: branchScopedRole(role) && !canAssignAcrossRoles(role) ? leadershipBranch : isEmployee ? workBranch : assignableEmployees[0]?.branch || currentEmployee.branch,
      template: 'standard', roleFilter: 'All', startDate: today, due: today
    });
    setSelected(null);
    setModal('create');
  };
  const calendarTasks = useMemo(() => visible.filter(task =>
    (departmentFilter === 'All' || task.department === departmentFilter) &&
    (task.assignee || 'Unassigned').toLowerCase().includes(calendarSearch.trim().toLowerCase())
  ), [visible, departmentFilter, calendarSearch]);
  const calendarIndex = useMemo(() => indexTasks(calendarTasks), [calendarTasks]);
  const calendarDepartments = [...new Set(visible.map(task => task.department).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  // One set of rules powers lists, counts, sorting, and filtered exports.
  const filterSource = ['Daily Reports', 'Weekly Reports'].includes(view) ? reportSectionTasks(workspaceTasks, { weekly: view === 'Weekly Reports', section: reportSection }) : view === 'Daily Tasks' ? workspaceTasks.filter(isDailyTemplate) : taskListScope(visible, view, actor?.name).filter(task => view !== 'Review Queue' || canReviewTask(task));
  const entries = filterTasks(view === 'Calendar' ? calendarTasks : ['Daily Reports', 'Weekly Reports'].includes(view) ? reportEntries : view === 'Daily Tasks' ? workspaceTasks.filter(task => task.template === activeDailyReportGroup && (!task.retiredDailyAssignment || reportSection === 'Archive') && (reportSection !== 'Archive' || ['Completed', 'Denied', 'Dismissed'].includes(task.status))) : filterSource, {
    view,
    search,
    status: filter,
    priority: priorityFilter,
    assignee: assigneeFilter,
    department: departmentFilter,
    branch: branchFilter,
    due: dueFilter,
    selectedDay,
    today,
    sort,
    priorities: config.priorities,
    dailyDate,
    dailyTemplate
  });
  const listViews = ['Daily Reports', 'Weekly Reports', 'Daily Tasks', 'Team Tasks', 'My Tasks', 'Task Archive', 'Submissions', 'Review Queue'];
  const statusTabs = ['Daily Reports', 'Daily Tasks', 'Weekly Reports'].includes(view) ? ['All Tasks', 'Not Started', 'In Progress', 'Pending Review', 'Revision Needed', 'Completed', 'Denied', 'Dismissed'] : view === 'Review Queue' ? ['All Tasks', 'Pending Approval', 'Pending Review'] : view === 'Task Archive' ? ['All Tasks', 'Completed', 'Denied'] : view === 'Submissions' ? ['All Tasks', 'Pending Review', 'Revision Needed', 'Completed', 'Denied'] : ['All Tasks', 'Not Started', 'In Progress', 'Pending Approval', 'Pending Review', 'Revision Needed', ...(view === 'My Tasks' ? ['Completed'] : [])];
  // Creation stays in the page header; review work has a single destination.
  const nav = [['Dashboard', 'dashboard'], ...((separateDailyReports || reportTypes.length || weeklyReportsAllowed) ? [['Reports', 'report']] : []), ...(!isEmployee ? [['My Tasks', 'tasks'], ['Team Tasks', 'team']] : [['My Tasks', 'tasks']]), ...(!isEmployee ? [['Review Queue', 'check'], ['Team Progress', 'team']] : [['Submissions', 'report'], ...(visible.some(task => canReviewCollaborativeChild(task, tasks, previewScope)) ? [['Review Queue', 'check']] : [])]), ['Calendar', 'calendar'], ['Activity', 'clock'], ['Task Archive', 'archive'], ...(canManageSetup ? [['Workspace Setup', 'team']] : [])];
  const filtersActive = search || filter !== 'All Tasks' || priorityFilter !== 'All' || assigneeFilter !== 'All' || departmentFilter !== 'All' || branchFilter !== 'All' || dueFilter !== 'All' || sort !== 'due' || selectedDay;
  const filterControls = <TaskFilters tasks={filterSource} employee={isEmployee} config={config} values={{ department: departmentFilter, branch: branchFilter, priority: priorityFilter, assignee: assigneeFilter, due: dueFilter, sort }} active={filtersActive} onReset={resetFilters} onChange={(key, value) => {
    ({ department: setDepartmentFilter, branch: setBranchFilter, priority: setPriorityFilter, assignee: setAssigneeFilter, due: setDueFilter, sort: setSort })[key](value);
    if (key === 'department' || key === 'branch') setAssigneeFilter('All');
  }} />;
  // Reuse one task table for the dashboard, task list, submissions, and archive.
  const logDateControls = <div className="tm-log-filters"><label>From<input type="date" value={logFrom} onChange={e=>setLogFrom(e.target.value)}/></label><label>To<input type="date" value={logTo} min={logFrom} onChange={e=>setLogTo(e.target.value)}/></label><button type="button" className="tm-text-button" onClick={()=>{setLogFrom('');setLogTo('');}}>Clear dates</button></div>;
  const openingDismissAction = task => canDismissOpeningReport(task,previewScope,today) ? <button type="button" className="tm-opening-dismiss-button" aria-label={`Dismiss Opening Report for ${task.branch} today`} onClick={()=>update(task,{status:'Dismissed'},`Opening Report dismissed for today by ${actor?.name}.`)}>Dismiss for today</button> : null;
  const table = (items, short = false) => short ? <DashboardTaskList tasks={items} onOpen={openTask} prettyDate={prettyDate} badge={value => <Badge value={value} />} showAssignee={!isEmployee} /> : <PagedList items={items} initialSize={10} label={reportsPage ? 'reports' : 'tasks'} resetKey={JSON.stringify([view, roleLabel, scopeLabel, search, filter, priorityFilter, assigneeFilter, departmentFilter, branchFilter, dueFilter, sort, selectedDay, dailyDate, dailyTemplate])}>{pageItems => <div className="tm-table-scroll">{items.length > 0 && <table className="tm-table"><thead><tr><th>{reportsPage ? 'Report' : 'Task title'}</th>{!isEmployee && <th>Assignee</th>}<th>Priority</th><th>Due date</th><th>Status</th><th><span className="tm-sr">Open task</span></th></tr></thead><tbody>{pageItems.map(t => <tr key={t.id}><td><button className="tm-task-title" onClick={() => openTask(t)}>{t.title}</button><OpeningWarning task={t}/><small>{t.recurrence === 'daily' ? `Daily · ${t.scheduledDate}` : isWeeklyReport(t) ? `Weekly · ${t.weekStart} – ${t.weekEnd}` : t.kind} · {t.department} · {t.branch}</small>{t.pings?.some(ping => !ping.acknowledgedAt && ping.assignee === t.assignee) && <small className="tm-ping-label">{t.pings.filter(ping => !ping.acknowledgedAt && ping.assignee === t.assignee).length} pending acknowledgement</small>}</td>{!isEmployee && <td><span className="tm-person"><Avatar name={t.assignee} />{t.assignee}</span><small>{isIntern(employeeByName(t.assignee), config) ? 'Intern' : employeeByName(t.assignee)?.position}</small></td>}<td><Badge value={t.priority} /></td><td className={overdue(t) ? 'tm-late-text' : ''}>{prettyDate(t.due)}</td><td>{isReportTask(t) ? <ReportStatus status={t.status} /> : <Badge value={t.status} />}{overdue(t) && <small className="tm-late-text">Overdue</small>}</td><td><div className="tm-report-row-actions">{openingDismissAction(t)}<button className="tm-icon-button" aria-label={`Open ${t.title}`} onClick={() => openTask(t)}><Icon name="arrow" size={16} /></button></div></td></tr>)}</tbody></table>}{!items.length && <div className="tm-empty"><Icon name="tasks" size={30} /><h3>{reportsPage ? 'No reports here yet' : 'No tasks here yet'}</h3><p>{filtersActive ? 'No tasks match these filters. Clear them to see more.' : view === 'Review Queue' ? 'You’re all caught up. New requests and submissions will appear here.' : view === 'Task Archive' ? 'Completed and denied tasks appear here.' : reportsPage ? 'Reports will appear here when they are assigned or submitted.' : 'New tasks will appear here when they are created.'}</p>{filtersActive && <button className="tm-secondary" onClick={resetFilters}>Clear filters</button>}</div>}</div>}</PagedList>;
  const creativeList = () => <TaskCollection renderActions={openingDismissAction} tasks={entries} view={view} today={today} onOpen={openTask} prettyDate={prettyDate} renderStatus={task=>task.sharedBranchReport && task.status === 'Completed' ? 'Completed' : isReportTask(task)?reportStatus(task.status).label:task.status} renderTable={items=>table(items)} resetKey={JSON.stringify([view,roleLabel,scopeLabel,search,filter,priorityFilter,assigneeFilter,departmentFilter,branchFilter,dueFilter,sort,reportDate,dailyDate,dailyTemplate,reportSection,activeDailyReportGroup])} onClear={resetFilters} filtersActive={filtersActive} />;
  // Calculate each sample member’s completion rate directly from their assigned tasks.
  const teamPanel = view === 'Team Progress' ? <TeamProgressCards participants={participants} index={visibleIndex} employeeByName={employeeByName} overdueCounts={overdueCounts} avatar={name=><Avatar name={name}/>} overdueBadge={(name,count)=><OverdueBadge name={name} count={count}/>} /> : <div className="tm-team-list">{!participants.length && <p className="tm-daily-caption">Team progress will appear when tasks are assigned.</p>}{participants.map(name => {
      const all = visibleIndex.byAssignee.get(name) || [];
      const done = all.filter(t => t.status === 'Completed').length;
      const percent = all.length ? Math.round(done / all.length * 100) : 0;
      return <div className="tm-member" key={name}><Avatar name={name} /><div><strong>{name}<OverdueBadge name={name} count={overdueCounts[name]} /></strong><small>{employeeByName(name)?.department || 'Operations'} · {employeeByName(name)?.branch || 'Makati'}<br />{done} of {all.length} tasks completed</small><div className="tm-track"><span style={{
              width: `${percent}%`
            }} /></div></div><b>{percent}%</b></div>;
    })}</div>;
  // Render month navigation and deadline markers; selecting a date filters the task list.
  const calendar = (large = false) => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-`;
    const legend = employeeTaskGroups((large ? calendarTasks : visible).filter(task => task.due.startsWith(monthPrefix)));
    return <>{large && <div className="tm-calendar-people-tools">{['EVP', 'Operations Manager'].includes(role) && <label>Department<select value={departmentFilter} onChange={event => { setDepartmentFilter(event.target.value); setCalendarEmployee(null); }}><option value="All">All departments</option>{calendarDepartments.map(department => <option key={department} value={department}>{department}</option>)}</select></label>}<label>Find employee<input type="search" value={calendarSearch} onChange={event => setCalendarSearch(event.target.value)} placeholder="Filter calendar by employee…" /></label>{calendarSearch && <button type="button" className="tm-text-button" onClick={() => setCalendarSearch('')}>Clear</button>}<details className="tm-calendar-legend-toggle"><summary>Employee colors ({legend.length})</summary><div className="tm-calendar-legend" aria-label="Employee color legend">{legend.map(person => <span key={person.name}><i style={{ backgroundColor: person.color }} aria-hidden="true" />{person.name}<OverdueBadge name={person.name} count={overdueCounts[person.name]} /></span>)}{!legend.length && <span>No matching tasks this month.</span>}</div></details><details className="tm-calendar-guide"><summary>How to read the calendar</summary><CalendarHelp /></details></div>}<div className="tm-calendar-nav"><button aria-label="Previous month" onClick={() => {
          setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1));
          setSelectedDay(null);
        }}>‹</button><strong>{month.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
          })}</strong><button aria-label="Next month" onClick={() => {
          setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1));
          setSelectedDay(null);
        }}>›</button></div><div className={`tm-calendar ${large ? 'tm-calendar-large' : ''}`}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <span className="tm-weekday" key={d}>{d}</span>)}{Array.from({
          length: start
        }, (_, i) => <span key={`blank${i}`} />)}{Array.from({
          length: count
        }, (_, i) => {
          const key = dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1));
          const dayTasks = ((large ? calendarIndex : visibleIndex).byDate.get(key) || []);
          const dayPreview = calendarDayPreview(dayTasks);
          const dayClass = `${key === today ? 'tm-today' : ''} ${selectedDay === key ? 'tm-selected-day' : ''}`;
          if (large) return <div key={key} className={`tm-calendar-day ${dayClass}`}><button type="button" className="tm-calendar-date-button" aria-label={`Show all ${dayTasks.length} tasks due ${key}`} aria-pressed={selectedDay === key} onClick={() => setSelectedDay(selectedDay === key ? null : key)}>{i + 1}</button><div className="tm-calendar-employee-bars">{dayPreview.shown.map(person => <button type="button" className="tm-calendar-employee-bar" key={person.name} style={{ backgroundColor: person.color }} aria-label={`${person.name}: ${person.count} tasks due ${key}. View task details.`} title={`${person.name}: ${person.count} tasks due ${key}`} onClick={() => { setCalendarEmployee({ name: person.name, date: key }); setSelected(null); setModal('calendar-employee'); }}><span>{person.name}</span><OverdueBadge name={person.name} count={overdueCounts[person.name]} /><b>{person.count}</b></button>)}</div>{dayPreview.more > 0 && <button type="button" className="tm-calendar-more" onClick={() => { setCalendarEmployee({ name: '', date: key }); setSelected(null); setModal('calendar-day'); }}>+{dayPreview.more} more employees</button>}</div>;
          return <button key={key} aria-label={`${key}, ${dayTasks.length} tasks`} aria-pressed={selectedDay === key} className={dayClass} onClick={() => { setSelectedDay(selectedDay === key ? null : key); setView('Calendar'); }}><span>{i + 1}</span>{dayTasks.length > 0 && <i className={dayTasks.some(t => t.priority === config.priorities[0]) ? 'tm-dot-red' : ''} />}</button>;
        })}</div></>;
  };
  const exportCurrentView=()=>{
    if(view==='Activity'||reportsPage&&reportSection==='Activity'){
      downloadCsv('task-activity.csv',['timestamp','description','assignee','department','branch'],(view==='Activity'?scopedActivity:reportActivity).map(event=>[event.time,event.text,event.assignee,event.department,event.branch]));return;
    }
    downloadCsv('task-module-export.csv',['title','description','assignee','department','branch','priority','starting_date','deadline','reference_link','status','submission'],(listViews.includes(view)||view==='Calendar'?entries:visible).map(task=>[task.title,task.description,task.assignee,task.department,task.branch,task.priority,task.startDate||'',task.due,task.link||'',task.status,task.submission||'']));
  };
  const importTaskRows = rows => {
    const imported=prepareTaskImport(rows,tasks,config,previewScope,today);
    setTasks(previous=>[...imported,...previous]);setActivity(previous=>[...imported.map(task=>({text:`${task.title} imported from CSV.`,taskId:task.id,branch:task.branch,department:task.department,assignee:task.assignee,time:new Date().toISOString()})),...previous]);setNotice(`${imported.length} tasks imported. Approval rules still apply.`);
  };
  // Export visible sample tasks as CSV; escape quotes and neutralize spreadsheet formula prefixes.
  const exportReport = (items = visible) => {
    const rows = [['Task', 'Assignee', 'Department', 'Branch', 'Priority', 'Due date', 'Status'], ...items.map(t => [t.title, t.assignee, t.department, t.branch, t.priority, t.due, t.status])];
    const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], {
      type: 'text/csv;charset=utf-8;'
    }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'task-module-preview.csv';
    a.click();
    URL.revokeObjectURL(url);
    setNotice('Sample task report exported.');
  };

  // Adapt module destinations to the shared SidebarLayout link and icon format.
  const sidebarLinks = nav.map(([label, icon]) => ({
    label,
    href: route('tasks.index', {
      view: label
    }),
    active: view === label || label === 'Reports' && reportsPage,
    icon: () => <Icon name={icon} size={16} />
  }));
  return <SidebarLayout notificationSlot={<TaskNotifications storageKey={storageKey} scope={previewScope} taskLookup={taskIndex.byId} onOpen={id => { const task = workspaceIndex.byId.get(id); if (task) openTask(task); else setNotice('This task is no longer available in your current view.'); }} />} activeModule="Tasks" sidebarLinks={sidebarLinks} header={<h2 className="text-xl font-semibold leading-tight text-gray-800">Task Module{internEmployee ? ' · Intern' : ''}{role !== 'EVP' && view !== 'Workspace Setup' ? ` · ${scopeLabel}` : ''}</h2>}><Head title={title} /><div className="tm-app">
        <main className="tm-main"><details className="tm-preview-panel"><summary>Role preview <span>{roleLabel} · {actor?.name || 'No person selected'}</span></summary><div className="tm-preview"><span><b>TEST A ROLE</b> Preview controls do not change your signed-in account. Task changes stay in this browser.</span><label>Preview as <select aria-label="Preview role" value={roleLabel} onChange={e => {
              setPreviewRoleMember('');
              const selectedRole = config.roles.find(item => item.name === e.target.value);
              if (selectedRole?.baseRole === 'Employee') {
                const person = employees.find(employee => employee.role === selectedRole.name);
                if (person) { setPreviewEmployee(person.name); setWorkBranch(person.branch); }
              }
              setRole(e.target.value);
              changePreviewScope(selectedRole?.baseRole || 'Employee', employees.find(employee => employee.role === selectedRole?.name) || currentEmployee);
            }}>{roles.map(r => <option key={r}>{r}</option>)}</select></label>{['EVP', 'Chief Vet'].includes(role) && roleMembers.length > 0 && <label>{roleLabel === 'Corporate Services' ? 'Corporate position / person' : 'Role member'}<select value={actor?.name || ''} onChange={event => { setPreviewRoleMember(event.target.value); changePreviewScope(); }}>{roleMembers.map(person => <option value={person.name} key={person.name}>{roleLabel === 'Corporate Services' ? `${person.position} · ${person.name}` : role === 'Chief Vet' ? `${person.branch} · ${person.name}` : person.name}</option>)}</select></label>}{role === 'Operations Manager' && <label>Operations Manager<select aria-label="Operations Manager branch" value={omBranch} onChange={event => {
              setOmBranch(event.target.value);
              changePreviewScope();
            }}>{operationsManagers.map(manager => <option key={manager.branch} value={manager.branch}>{manager.branch} · {manager.name}</option>)}</select></label>}
{role === 'Team Leader' && <label>{roleLabel}<select aria-label="Team Leader position" value={actor?.name || ''} onChange={event => {
              const leader = availableDepartmentLeaders.find(person => person.name === event.target.value);
              if (leader) { setPreviewLeaderName(leader.name); setTlDepartment(leader.department); }
              changePreviewScope();
            }}>{groupPreviewPeople(availableDepartmentLeaders).map(group => <optgroup key={group.department} label={group.department}>{group.people.map(leader => <option key={leader.name} value={leader.name}>{leader.position} · {leader.branch || 'All branches'} · {leader.name}</option>)}</optgroup>)}</select></label>}
{isEmployee && <label>{internEmployee ? 'Intern' : 'Employee'}<select aria-label={internEmployee ? 'Intern' : 'Employee'} value={previewEmployee} onChange={event => {
              setPreviewEmployee(event.target.value);
              setRole(employeeByName(event.target.value).role);
              setWorkBranch(employeeByName(event.target.value).branch);
              changePreviewScope('Employee', employeeByName(event.target.value));
            }}>{groupPreviewPeople(employees).map(({department,people}) => <optgroup key={department} label={department}>{people.map(employee => <option key={employee.name} value={employee.name}>{employee.name} · {employee.position} · {employee.branch}{isIntern(employee, config) ? ' · Intern' : ''}</option>)}</optgroup>)}</select></label>}{isEmployee && <label>Today’s work branch<select aria-label="Today’s work branch" value={workBranch} onChange={event => { if (currentEmployee.department === config.itDepartment) saveWorkAssignment(today, event.target.value); else setWorkBranch(event.target.value); }}>{(currentEmployee.availableBranches || [currentEmployee.branch]).map(branch => <option key={branch}>{branch}</option>)}</select></label>}<span className="tm-employee-context">{isEmployee ? `${internEmployee ? 'Intern' : currentEmployee.position} · ${currentEmployee.department} · Home: ${currentEmployee.branch} · Working at: ${workBranch}` : role === 'Operations Manager' ? `${managerForBranch(omBranch).name} · Operations Manager · ${omBranch} branch · all departments` : role === 'Team Leader' ? `${actor?.name} · ${actor?.position || roleLabel} · ${branches.join(', ')}` : role === 'Chief Vet' ? `Chief Vet · ${vetBranch} branch` : `${operationsManagers.length} Operations Managers · ${teamLeaders.length} department leaders · ${employees.length} sample employees`}</span>{isEmployee && <span className="tm-employee-context">Department lead: {leaderForDepartment(currentEmployee.department).name === 'Not assigned' ? `Branch OM · ${managerForBranch(workBranch).name}` : `${leaderForDepartment(currentEmployee.department).position} · ${leaderForDepartment(currentEmployee.department).name}`} · Work branch OM: {managerForBranch(workBranch).name}</span>}</div></details><div className="tm-page-heading"><div><h1>{title}</h1><p>{view === 'Dashboard' ? isEmployee ? 'A clear view of your day. Let’s make progress.' : 'Keep your team aligned and every responsibility on track.' : view === 'My Tasks' ? 'Time to pounce on today’s tasks.' : view === 'Team Tasks' ? 'Round up the cat crew and keep every task on track.' : view === 'Review Queue' ? 'Put your whiskers to work. Review requests and submitted tasks.' : reportsPage ? 'The latest from the cat crew, all in one place.'  : 'Plan, follow through, and keep everyone in the loop.'}</p></div><div className="tm-heading-actions">{view !== 'Workspace Setup' && <label className="tm-search"><Icon name="search" size={18} /><input aria-label={reportsPage ? 'Search reports' : 'Search tasks'} placeholder={reportsPage ? 'Search reports...' : 'Search tasks...'} value={search} onChange={e => {
                setSearch(e.target.value);
                if (e.target.value && !listViews.includes(view) && view !== 'Calendar') setView(isEmployee ? 'My Tasks' : 'Team Tasks');
              }} /></label>}<span className="tm-date"><Icon name="calendar" size={17} />{new Date().toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}</span>{view !== 'Workspace Setup' && !reportsPage && !isEmployee && <button className="tm-primary" onClick={create}><Icon name="plus" size={17} />{'Create task'}</button>}</div></div>
        {view !== 'Workspace Setup' && <div className="tm-transfer-tools"><button type="button" className="tm-secondary" onClick={exportCurrentView}>Export current view</button>{!isEmployee && ['Dashboard','My Tasks','Team Tasks'].includes(view) && <CsvImportControl label="Import tasks" columns={['title','description','assignee','department','branch','priority','starting_date','deadline','reference_link']} sample={['Check inventory','Verify stock quantities',assignableEmployees[0]?.name||'Employee name',assignableEmployees[0]?.department||'IT',assignableEmployees[0]?.branch||'Makati','Medium',today,today,'']} onImport={importTaskRows} description="Imports create standard tasks with normal permissions and approval requirements. Exported status and submission columns do not grant approval."/>}</div>}
        {view === 'Workspace Setup' && canManageSetup && <WorkspaceSetup config={config} directory={taskDirectory} onChange={saveSetting} canEdit={canManageSetup} />}
        {/* Dashboard statistics, tasks, deadlines, activity, and attention shortcuts. */}
{view === 'Dashboard' && <div className="tm-dashboard-design"><div className="tm-dashboard-kicker"><span aria-hidden="true">ฅ</span><span>{isEmployee ? 'Your day at a glance' : 'The clinic at a glance'}</span><small>One task at a time. All paws on deck.</small></div><div className="tm-stats">{[[isEmployee ? 'My tasks' : role === 'EVP' ? 'Organization tasks' : 'Team tasks', visible.length, 'tasks', 'blue', 'Across your workspace'], ['In progress', progress, 'clock', 'amber', 'Moving things forward'], ['Completed', completed, 'check', 'green', `${visible.length ? Math.round(completed / visible.length * 100) : 0}% completion rate`], [isEmployee ? 'Due today' : 'Overdue', isEmployee ? visible.filter(t => t.due === today && !['Completed', 'Denied'].includes(t.status)).length : late, 'calendar', 'red', isEmployee ? 'Your priorities for today' : 'Needs a little attention']].map(([label, count, icon, color, note]) => <section className="tm-stat" key={label}><span className={`tm-stat-icon ${color}`}><Icon name={icon} size={24} /></span><div><h2>{label}</h2><strong>{count}</strong><small className={color === 'red' ? 'tm-late-text' : ''}>{note}</small></div></section>)}</div><div className="tm-dashboard-tools">{separateDailyReports && <div className="tm-dashboard-weekly"><span><Icon name="report" size={17} />Daily reports</span><button className="tm-secondary" onClick={() => go('Daily Reports')}>View reports</button></div>}{weeklyReportsAllowed && !internEmployee && !(weeklyReviewAllowed && role === 'Team Leader') && <div className="tm-dashboard-weekly"><span><Icon name="report" size={17} />Weekly reports</span><button className="tm-secondary" onClick={() => go('Weekly Reports')}>View reports</button></div>}{isEmployee && (internEmployee || currentEmployee.department === config.itDepartment) && <details className="tm-dashboard-tool"><summary><Icon name="calendar" size={17} />My reporting schedule</summary><EmployeeSchedule key={currentEmployee.name + today} employee={currentEmployee} today={today} intern={internEmployee} it={currentEmployee.department === config.itDepartment} onAssignment={saveWorkAssignment} /></details>}{weeklyReviewAllowed && role === 'Team Leader' && <div className="tm-dashboard-weekly"><span><Icon name="report" size={17} />Intern weekly reports</span><small>{workspaceTasks.filter(task => isWeeklyReport(task) && task.status === 'Pending Review').length} for review</small><button className="tm-secondary" onClick={() => go('Weekly Reports')}>View reports</button></div>}{internEmployee && <div className="tm-dashboard-weekly"><span><Icon name="report" size={17} />Intern weekly report</span><small>Due Friday</small><button className="tm-secondary" onClick={() => { const latest = workspaceTasks.filter(isWeeklyReport).sort((a, b) => b.weekStart.localeCompare(a.weekStart))[0]; if (latest) openTask(latest); else go('Weekly Reports'); }}>Open report</button></div>}{!separateDailyReports && reportTypes.length > 0 && <details className="tm-dashboard-tool"><summary><Icon name="tasks" size={17} />Daily reports<span className="tm-dashboard-tool-count">{dailyToday.filter(task => ['Pending Review', 'Completed'].includes(task.status)).length}/{dailyToday.length} submitted</span></summary><Panel title="Daily reports" className="tm-rounds-dashboard" action="View daily tasks" onAction={() => go('Daily Tasks')}><p className="tm-daily-caption">{today} · New tasks every day · Previous reports stay in history</p><div className="tm-daily-pair">{reportTypes.map(([template, label, description]) => {
                const assigned = dailyToday.filter(task => task.template === template);
                const done = isEmployee && assigned.length === 1 && itReportDone(assigned[0]);
                return <div className={`tm-daily-card ${assigned.length === 1 ? 'tm-report-card-' + reportStatus(assigned[0].status).tone : ''}`} key={template}><div className="tm-report-states">{assigned.length === 1 ? <ReportStatus status={assigned[0].status} /> : [...new Set(assigned.map(task => task.status))].map(status => <ReportStatus key={status} status={status} count={assigned.filter(task => task.status === status).length} />)}</div><span className="tm-daily-label">DAILY</span><h3>{label}</h3><p>{description}</p><small>{assigned.length ? assigned.length + ' assigned · ' + assigned.filter(task => task.status === 'Completed').length + ' completed' : template === 'daily-operations' ? 'Cashier only · no assignments in this scope' : 'IT only · no assignments in this scope'}</small><button className="tm-secondary" disabled={!assigned.length} onClick={() => {
                    if (isEmployee && assigned.length === 1) openTask(assigned[0]);else {
                      go('Daily Tasks');
                      setDailyReportGroup(template);
                      setDailyTemplate('All');
                    }
                  }}>{isEmployee ? done ? 'View report' : 'Open report' : 'View reports'}</button>{done && canCorrectITReport(assigned[0], { role, employee: currentEmployee, config }) && <button className="tm-secondary" onClick={() => correctITReport(assigned[0])}>Edit report</button>}</div>;
              })}</div></Panel></details>}</div><div className="tm-dashboard-grid">{!isEmployee && visible.some(task => task.assignee === actor?.name && !['Completed', 'Denied'].includes(task.status)) && <Panel className="tm-own-task-panel" title="My Assigned Tasks" action="View my tasks" onAction={() => go('My Tasks')}><p className="tm-daily-caption">Tasks assigned to {actor?.name}, including your own monitoring responsibilities.</p>{table(visible.filter(task => task.assignee === actor?.name && !['Completed', 'Denied'].includes(task.status)), true)}</Panel>}<Panel title={isEmployee ? 'My tasks' : 'Team tasks'} action="View all tasks" onAction={() => go(isEmployee ? 'My Tasks' : 'Team Tasks')} className="tm-task-panel"><div className="tm-tabs">{['All Tasks', 'In Progress', 'Pending Review', 'Overdue'].map(f => <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>{table(entries.filter(t => t.status !== 'Completed' && (isEmployee || t.assignee !== actor?.name)), true)}</Panel><Panel title="Upcoming deadlines" action="Calendar" onAction={() => go('Calendar')} className="tm-deadline-panel">{calendar()}<div className="tm-deadlines">{visible.filter(t => !['Completed', 'Denied'].includes(t.status)).sort((a, b) => a.due.localeCompare(b.due)).slice(0, 3).map(t => <button key={t.id} onClick={() => openTask(t)}><i className={t.priority === config.priorities[0] ? 'tm-dot-red' : ''} /><span>{prettyDate(t.due)}</span><strong>{t.title}</strong><Badge value={t.priority} /></button>)}</div></Panel><Panel className="tm-dashboard-activity-panel" title="Recent activity" action="View all" onAction={() => go('Activity')}><div className="tm-activity">{!scopedActivity.length && <p>No activity recorded for this scope yet.</p>}{scopedActivity.slice(0, 3).map((a, i) => <div key={i}><span className={`tm-activity-icon ${['green', 'blue', 'amber'][i % 3]}`}><Icon name={i === 0 ? 'check' : 'tasks'} size={15} /></span><div><p>{a.text}</p><small>{activityTime(a.time)}</small></div></div>)}</div></Panel><Panel className="tm-dashboard-progress-panel" title={isEmployee ? 'My progress' : 'Team progress'} action={isEmployee ? undefined : 'View team'} onAction={() => go('Team Progress')}>{isEmployee ? <div className="tm-personal-progress"><strong>{visible.length ? Math.round(completed / visible.length * 100) : 0}%</strong><p>of your tasks completed</p><div className="tm-track"><span style={{
                    width: `${visible.length ? completed / visible.length * 100 : 0}%`
                  }} /></div><small>Every completed task moves the team forward.</small></div> : teamPanel}</Panel><Panel className="tm-dashboard-attention-panel" title="Needs attention"><div className="tm-attention">
  <button onClick={() => attention('Today')}><span><Icon name="calendar" size={18} />Due today</span><b>{visible.filter(t => t.due === today && !['Completed', 'Denied'].includes(t.status)).length}</b></button>
  <button onClick={() => attention('Overdue')}><span><Icon name="clock" size={18} />Overdue tasks</span><b>{late}</b></button>
  {!isEmployee && <button onClick={() => attention('All', true)}><span><Icon name="check" size={18} />Awaiting your review</span><b>{pending.length}</b></button>}
  <button onClick={() => {
                  go(isEmployee ? 'My Tasks' : 'Team Tasks');
                  setFilter('Revision Needed');
                }}><span><Icon name="tasks" size={18} />Needs revision</span><b>{visible.filter(t => t.status === 'Revision Needed').length}</b></button>
</div></Panel></div></div>}
        {/* List screens share the same search, filters, and task detail interaction. */}
{/* Daily and weekly destinations share one Reports page while retaining their own filters. */}
{reportsPage && <div className="tm-report-tabs" role="tablist" aria-label="Report frequency">
  {(separateDailyReports || reportTypes.length > 0) && <button type="button" role="tab" aria-selected={view !== 'Weekly Reports'} className={view !== 'Weekly Reports' ? 'active' : ''} onClick={() => go(separateDailyReports ? 'Daily Reports' : 'Daily Tasks')}>Daily reports</button>}
  {weeklyReportsAllowed && <button type="button" role="tab" aria-selected={view === 'Weekly Reports'} className={view === 'Weekly Reports' ? 'active' : ''} onClick={() => go('Weekly Reports')}>Weekly reports</button>}
</div>}
{view === 'Daily Reports' && dailyReportTabs}
{['Daily Reports','Weekly Reports'].includes(view) && <div className="tm-report-list-controls"><label>{view === 'Weekly Reports' ? 'Date within the reporting week' : 'Report date'}<input type="date" value={reportDate} onChange={event => setReportDate(event.target.value)} /></label><button type="button" className="tm-text-button" onClick={() => setReportDate(today)}>Today</button>{reportDate && <button className="tm-text-button" onClick={() => setReportDate('')}>All dates</button>}</div>}
{view === 'Weekly Reports' && internEmployee && <p className="tm-daily-caption">Weekly reports are due every Friday and include completed tasks from Saturday through Friday.</p>}
{listViews.includes(view) && view !== 'Daily Tasks' && <Panel title={view} className={reportsPage?'tm-collection-panel tm-reports-compact':isCreativeTaskPage(view)?'tm-collection-panel tm-tasks-compact':''}>
  {['Daily Reports', 'Weekly Reports'].includes(view) && <><div className="tm-tabs">{['Reports', ...(!isEmployee ? ['Review Queue'] : []), 'Archive', 'Activity'].map(section => <button key={section} className={reportSection === section ? 'active' : ''} onClick={() => { setReportSection(section); resetFilters(); }}>{section}</button>)}</div></>}
  {['Daily Reports', 'Weekly Reports'].includes(view) && reportSection === 'Activity' ? <>{logDateControls}<PagedList items={reportActivity} initialSize={10} label="report activity">{items => <div className="tm-activity">{!items.length && <p>No report activity yet.</p>}{items.map((event, index) => <div key={index}><div><p>{event.text}</p><small>{activityTime(event.time)}</small></div>{!isEmployee && <button type="button" className="tm-text-button" onClick={()=>{if(window.confirm('Delete this report log entry?'))setActivity(previous=>previous.filter(item=>item!==event));}}>Delete log</button>}</div>)}</div>}</PagedList></> : <><div className="tm-list-summary"><span>{entries.length} {reportsPage ? entries.length === 1 ? 'report' : 'reports' : entries.length === 1 ? 'task' : 'tasks'}</span>{!isEmployee && <button className="tm-text-button" onClick={() => exportReport(entries)}>Export this list</button>}</div>
  {reportsPage ? <details className="tm-report-filter-drawer"><summary>Filter & sort reports{(filtersActive || reportDate) && <span>Filters active</span>}</summary><div className="tm-tabs">{statusTabs.map(f => <button className={filter === f ? 'active' : ''} key={f} onClick={() => setFilter(f)}>{reportsPage && f === 'All Tasks' ? 'All reports' : f}</button>)}</div>
  {filterControls}</details> : <><div className="tm-tabs">{statusTabs.map(f => <button className={filter === f ? 'active' : ''} key={f} onClick={() => setFilter(f)}>{reportsPage && f === 'All Tasks' ? 'All reports' : f}</button>)}</div>
  {isCreativeTaskPage(view) ? <details className="tm-report-filter-drawer"><summary>Filter & sort tasks{filtersActive && <span>Filters active</span>}</summary>{filterControls}</details> : filterControls}</>}{isCreativeTaskPage(view)?creativeList():table(entries)}</>}
</Panel>}
        {view === 'Daily Tasks' && <Panel title="Daily task schedule" className="tm-collection-panel tm-reports-compact">{dailyReportTabs}<div className="tm-tabs" role="group" aria-label="Daily report section">{['Reports', 'Archive'].map(section => <button type="button" key={section} className={reportSection === section ? 'active' : ''} aria-pressed={reportSection === section} onClick={() => {setReportSection(section); resetFilters();}}>{section}</button>)}</div><div className="tm-daily-controls"><label>Report date<input type="date" value={dailyDate} onChange={event => setDailyDate(event.target.value)} /></label><button className="tm-text-button" onClick={() => {
              setDailyDate(today);
              setDailyTemplate('All');
            }}>Today</button></div><p className="tm-daily-caption">{entries.length} daily tasks · Select an earlier date to view saved reports. New work is created for the current day when the workspace opens.</p><details className="tm-report-filter-drawer"><summary>Filter & sort reports{filtersActive && <span>Filters active</span>}</summary><div className="tm-tabs">{statusTabs.map(status => <button key={status} className={filter === status ? 'active' : ''} onClick={() => setFilter(status)}>{status}</button>)}</div>{filterControls}</details>{creativeList()}</Panel>}
        {/* Expanded calendar and the task list for the selected day. */}
{view === 'Calendar' && <Panel title="Task calendar" className="tm-calendar-design" action={selectedDay ? 'Clear date filter' : 'Today'} onAction={() => {
          setSelectedDay(null);
          setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
        }}>{calendar(true)}<div className="tm-calendar-list-heading">{selectedDay ? `Tasks for ${prettyDate(selectedDay)}` : 'All scheduled tasks'}</div>{table(entries)}</Panel>}
        {/* Team completion and workload summary. */}
{view === 'Team Progress' && <Panel title="Team progress" className="tm-progress-design" action="Export team report" onAction={() => exportReport()}><div className="tm-tabs" role="group" aria-label="Team progress view">{['People', 'Summary'].map(mode => <button type="button" key={mode} className={teamProgressView === mode ? 'active' : ''} aria-pressed={teamProgressView === mode} onClick={() => setTeamProgressView(mode)}>{mode}</button>)}</div>{teamProgressView === 'People' ? teamPanel : <div className="tm-table-scroll"><table className="tm-table"><thead><tr><th>Team member</th><th>Total</th><th>Completed</th><th>Overdue</th></tr></thead><tbody>{participants.map(name => {
                    const all = visibleIndex.byAssignee.get(name) || [];
                    return <tr key={name}><td>{name}<OverdueBadge name={name} count={overdueCounts[name]} /><small>{employeeByName(name)?.department} · {employeeByName(name)?.branch}</small></td><td>{all.length}</td><td>{all.filter(t => t.status === 'Completed').length}</td><td className="tm-late-text">{all.filter(overdue).length}</td></tr>;
                  })}</tbody></table></div>}</Panel>}
        {/* Browser-persisted task activity; portal notifications remain in the shared header. */}
{view === 'Activity' && <Panel title="Task activity">{logDateControls}<PagedList items={scopedActivity} label="activity entries" initialSize={10} resetKey={roleLabel + scopeLabel}>{items => <div className="tm-activity">{!items.length && <p>No task activity yet.</p>}{items.map((event, index) => <div key={`${event.time}-${index}`}><span className="tm-activity-icon blue"><Icon name="bell" size={17} /></span><div><p>{event.text}</p><small>{activityTime(event.time)}</small></div>{!isEmployee && <button type="button" className="tm-text-button" onClick={()=>{if(window.confirm('Delete this activity entry?'))setActivity(previous=>previous.filter(item=>item!==event));}}>Delete log</button>}</div>)}</div>}</PagedList></Panel>}
        <footer className="tm-footer"><span>The Cat Clinic · Task Module</span>{!taskDirectory && <button className="tm-text-button" onClick={() => setModal('reset')}>Reset sample workspace</button>}</footer></main>
        {/* Accessible status feedback for task actions. */}
{notice && <div className="tm-toast" role="status"><Icon name="check" size={18} />{notice}</div>}
        {/* Task creation and detail dialogs, including submission and review controls. */}
{modal && <div className="tm-modal-backdrop" onClick={e => {
        if (e.target === e.currentTarget) setModal(null);
      }} onKeyDown={e => {
        if (e.key === 'Escape') setModal(null);
      }}><section className={`tm-modal ${selected && modal === 'details' ? 'tm-task-dialog' : ['create','edit'].includes(modal) ? 'tm-task-form-dialog' : ''}`}  role="dialog" aria-modal="true" aria-labelledby="tm-modal-title"><header><div><h2 id="tm-modal-title">{modal === 'calendar-day' ? `Employees · ${calendarEmployee.date}` : modal === 'calendar-employee' ? `${calendarEmployee.name} · ${calendarEmployee.date}` : modal === 'reset' ? 'Reset sample workspace?' : modal === 'edit' ? 'Edit task' : modal === 'create' ? assignment.template === 'collaborative' ? 'Create collaborative workflow' : isEmployee ? 'Request a new task' : 'Create a new task' : selected?.title}</h2></div><button autoFocus className="tm-icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><Icon name="close" /></button></header>
        {modal === 'calendar-day' ? <CalendarEmployeeList overdueCounts={overdueCounts} tasks={calendarTasks} date={calendarEmployee.date} onEmployee={name => { setCalendarEmployee({ name, date: calendarEmployee.date }); setModal('calendar-employee'); }} /> : modal === 'calendar-employee' ? <div><button type="button" className="tm-text-button" onClick={() => setModal('calendar-day')}>← All employees for this day</button><p className="tm-daily-caption">Tasks due on {calendarEmployee.date}. Select a task to view its full details.</p><CalendarTaskList tasks={calendarTasks.filter(task => (task.assignee || 'Unassigned') === calendarEmployee.name && task.due === calendarEmployee.date)} onOpen={openTask} overdue={overdue} renderPriority={task => <Badge value={task.priority} />} renderStatus={task => isReportTask(task) ? <ReportStatus status={task.status} /> : <Badge value={task.status} />} /></div> : modal === 'reset' ? <div><p className="tm-reset-note">This restores the original sample tasks, progress, and workspace settings in this browser. Your real portal records are unaffected.</p><div className="tm-modal-actions"><button className="tm-secondary" onClick={() => setModal(null)}>Keep my changes</button><button className="tm-primary" onClick={() => {
                setTasks(initialTasks);
                setConfig(settingsForDirectory());
                setActivity([{
                  text: 'Sample workspace restored.',
                  time: new Date().toISOString()
                }]);
                setModal(null);
                go('Dashboard');
                setNotice('Sample tasks restored.');
              }}>Reset sample tasks</button></div></div> : ['create', 'edit'].includes(modal) ? <form className={`tm-task-create-form ${assignment.template === 'collaborative' ? 'tm-task-create-collaborative' : ''}`} key={modal + (selected?.id || '')} onSubmit={e => {
            e.preventDefault();
            if (isEmployee) {
              setNotice('Employees can submit assigned tasks but cannot request new tasks.');
              return;
            }
            const data = new FormData(e.currentTarget);
            if (modal !== 'edit' && data.get('kind') !== 'Assigned task' && !canRequestTask(role)) {
              setNotice('This role cannot create a task request.');
              return;
            } /* Requests begin in approval; ordinary assignments begin as not started. No database write occurs here. */
            let task = {
              id: Date.now(),
              title: assignment.template === 'it-opening-rounds' ? 'Opening Rounds' : data.get('title').trim(),
              description: data.get('description').trim(),
              assignee: isEmployee ? previewEmployee : assignment.name,
              department: assignment.department,
              branch: assignment.branch,
              template: assignment.template,
              priority: data.get('priority'),
              startDate: data.get('startDate') || today,
              due: data.get('due'),
              requestedBy: pingContext.sender,
              originBranch: role === 'Operations Manager' ? omBranch : undefined,
              assigneeRole: employeeByName(assignment.name)?.role,
              kind: assignment.template === 'collaborative' ? 'Collaborative main task' : data.get('kind'),
              status: data.get('kind') !== 'Assigned task' ? 'Pending Approval' : 'Not Started',
              submission: '',
              link: data.get('link'),
              remarks: ''
            };
            if (modal !== 'edit' && task.template === 'collaborative' && data.get('kind') !== 'Assigned task') { setNotice('Collaborative tasks must be assigned by a higher-up, not self-requested.'); return; }
            if (task.template === 'it-opening-rounds' && (task.department !== config.itDepartment || employeeByName(task.assignee)?.department !== config.itDepartment)) {
              setNotice('Opening Rounds must be assigned to an IT employee.');
              return;
            }
            if (!(task.template === 'collaborative' && modal === 'create' ? allAssignees.filter(canMonitorCollaborative) : formAssignees).some(employee => employee.name === task.assignee && (task.template === 'collaborative' && modal === 'create' ? monitorMatchesAssignment(employee, task) : canWorkAt(employee, task.branch) && employee.department === task.department))) {
              setNotice('Choose a person available to your role and selected work branch.');
              return;
            }
            if (!task.startDate || task.startDate > task.due) {setNotice('Choose a starting date on or before the deadline.'); return;}
            if (modal !== 'edit' && task.kind === 'Self-created request' && task.assignee !== actor?.name) {setNotice('A self-created request must be assigned to you.');return;}
            if (!task.title) return;
            if (!task.description) {
              setNotice('Add a description before saving.');
              return;
            }
            if (modal === 'edit') {
              if (isCollaborativeTask(selected) && childTasks(selected, tasks).some(child => child.due >= task.due || selected.assignee !== task.assignee)) { setNotice('Keep the coordinator and a main deadline that covers all existing child tasks.'); return; }
              if (selected.parentId) { const parent = tasks.find(item => item.id === selected.parentId); if (parent && task.due >= parent.due) { setNotice('The child deadline must be earlier than its parent task deadline.'); return; } }
              update(selected, {
                title: task.title,
                description: task.description,
                assignee: task.assignee,
                assigneeRole: employeeByName(task.assignee)?.role || selected.assigneeRole,
                department: task.department,
                branch: task.branch,
                priority: task.priority,
                startDate: task.startDate,
                due: task.due,
                link: task.link
              }, 'Task details updated.');
              setModal('details');
              return;
            }
            try { task=routeTaskApproval(task,config,previewScope); } catch(error){setNotice(error.message);return;}
            task.history = [{
              text: 'Task created.',
              at: new Date().toISOString()
            }];
            let added = [task];
            if (task.template === 'collaborative') {
              try { added = createCollaborativeMain(task, tasks, config, previewScope, { assignee: assignment.name, mainOwner: data.get('mainOwner'), title: data.get('monitoringTitle'), description: data.get('monitoringDescription'), due: data.get('monitoringDue') }); }
              catch (error) { setNotice(error.message); return; }
            }
            setTasks(prev => [...added, ...prev]);
            setActivity(prev => [{
              text: `${task.title} was ${task.status === 'Pending Approval' ? 'submitted for approval' : 'created'}.`,
              branch: task.branch,
              department: task.department,
              assignee: task.assignee,
              time: new Date().toISOString()
            }, ...prev]);
            setNotice(task.template === 'collaborative' ? 'Collaborative workflow created.' : task.status === 'Pending Approval' ? 'Request submitted in this preview.' : 'Task created in this preview.');
            setModal(null);
            go(task.template === 'collaborative' || isEmployee ? 'My Tasks' : 'Team Tasks');
          }}><div className="tm-task-template-choice"><p className="tm-create-intro">{modal === 'edit' ? 'Update the details and keep everyone on the same page.' : 'A new task to pounce on. Start with who, what and when.'}</p><label>Task template<select value={assignment.template} disabled={modal === 'edit'} onChange={event => chooseAssignment({
                  template: event.target.value
                })}><option value="standard">Standard task</option>{canCreateCollaborative(role) && <option value="collaborative">Collaborative / Dependency Task</option>}{allowedDepartments.includes(config.itDepartment) && <option value="it-opening-rounds" disabled>Opening Rounds · assigned daily automatically</option>}</select></label></div>{assignment.template === 'collaborative' && modal === 'create' ? <CollaborationCreateFields config={config} people={allAssignees} actor={actor} assignment={assignment} onAssignment={chooseAssignment} today={today} departments={departments} branches={allowedBranches} /> : <>{!formAssignees.length && <p className="tm-form-note">No people are available for this role. Ask an administrator to check employee status, department and allowed branches in Employee Management.</p>}{formAssignees.length > 0 && !matchingFormAssignees.length && <div className="tm-form-note" role="status">No person matches this department, branch and role. <button type="button" className="tm-text-button" onClick={()=>{const person=formAssignees[0];chooseAssignment({roleFilter:'All',department:person.department,branch:person.branch,name:person.name});}}>Use an available person</button></div>}<fieldset className="tm-create-section tm-create-assignment"><legend>Who & where</legend>{modal !== 'edit' && canRequestTask(role) ? <label className="tm-create-purpose">Task purpose<select name="kind" value={taskPurpose} onChange={event=>{const kind=event.target.value;setTaskPurpose(kind);const person=kind==='Self-created request'?allAssignees.find(person=>person.name===actor?.name):assignableEmployees.find(person=>person.name!==actor?.name)||assignableEmployees[0];if(person)setAssignment(previous=>({...previous,...person,roleFilter:'All',branch:person.branch}));}}><option value="Assigned task">Assign to someone</option><option value="Self-created request">Self-created request</option>{role === 'Operations Manager' && <option>Turnover request</option>}</select></label> : <input type="hidden" name="kind" value={modal === 'edit' ? selected.kind : 'Assigned task'} />}<div className="tm-form-grid"><label>Department<select value={assignment.department} disabled={isEmployee || modal !== 'edit' && taskPurpose === 'Self-created request' || assignment.template === 'it-opening-rounds' || modal === 'edit' && Boolean(selected.rounds)} onChange={event => chooseAssignment({
                  department: event.target.value
                })}>{formDepartments.map(department => <option key={department}>{department}</option>)}</select></label><label>Branch<select value={assignment.branch} disabled={branchScopedRole(role) && !canAssignAcrossRoles(role) || modal === 'edit' && Boolean(selected.rounds)} onChange={event => chooseAssignment({
                  branch: event.target.value
                })}>{formBranches.map(branch => <option key={branch}>{branch}</option>)}</select></label>{canAssignAcrossRoles(role) && <label>Assignee role<select value={assignment.roleFilter || 'All'} onChange={event => chooseAssignment({ roleFilter: event.target.value })}><option value="All">All roles</option>{[...new Set(formAssignees.map(person => person.role))].map(name => <option key={name}>{name}</option>)}</select></label>}<label className="tm-create-person">Assign to person<select required value={assignment.name} disabled={isEmployee || modal !== 'edit' && taskPurpose === 'Self-created request' || modal === 'edit' && Boolean(selected.rounds)} onChange={event => chooseAssignment({
                  name: event.target.value
                })}><option value="">Choose a person</option>{matchingFormAssignees.map(employee => <option key={employee.name} value={employee.name}>{employee.name} · {employee.role}{employee.employeeType === 'Intern' ? ' · Intern' : ''}</option>)}</select></label></div></fieldset><fieldset className="tm-create-section tm-create-details"><legend>What needs doing</legend><label>Task title<input key={assignment.template} readOnly={assignment.template === 'it-opening-rounds'} name="title" defaultValue={assignment.template === 'it-opening-rounds' ? 'Opening Rounds' : modal === 'edit' ? selected.title : ''} required maxLength={140} placeholder="What needs to be done?" /></label><label>Description<textarea name="description" defaultValue={modal === 'edit' ? selected.description : ''} required rows={3} placeholder="Add the details and expected output…" /></label><div className="tm-create-reference"><label>Reference / attachment link <span>(optional)</span><input name="link" defaultValue={modal === 'edit' ? selected.link : ''} type="url" placeholder="https://…" /></label></div></fieldset><fieldset className="tm-create-section tm-create-schedule"><legend>When & priority</legend><div className="tm-form-grid"><label>Priority<select name="priority" defaultValue={modal === 'edit' ? selected.priority : config.priorities[Math.min(1, config.priorities.length - 1)]}>{config.priorities.map(priority => <option key={priority}>{priority}</option>)}</select></label><label>Starting date<input type="date" name="startDate" required defaultValue={modal === 'edit' ? selected.startDate || selected.due : today} onChange={event=>setAssignment(previous=>({...previous,startDate:event.target.value}))}/></label><label>Deadline<input type="date" name="due" min={assignment.startDate || (modal === 'edit' ? selected.startDate || selected.due : today)} required defaultValue={modal === 'edit' ? selected.due : today} onChange={event => setAssignment(previous => ({ ...previous, due: event.target.value }))} /></label></div></fieldset><div className="tm-form-note tm-create-permissions">{isEmployee ? 'Your team leader reviews this request before the task begins.' : role === 'Team Leader' ? `Assign work to employees across departments. New tasks still require approval from the relevant branch Operations Manager.` : role === 'EVP' ? 'Assign work across managers, department leaders, and employees.' : role === 'Operations Manager' ? `You manage ${omBranch} branch across all departments. Assignments can target any configured role across branches. Self-created requests go to the EVP.` : 'Departments use the Team Leader or Supervisor shown in the organization chart. Each branch has its own Operations Manager.'}</div></>}<div className="tm-modal-actions">{assignment.template !== 'collaborative' && <button type="button" className="tm-create-reference-shortcut" onClick={event=>{const input=event.currentTarget.form.elements.namedItem('link');input?.scrollIntoView({block:'center',behavior:'smooth'});input?.focus({preventScroll:true});}}>Reference link <span>(optional)</span> ↑</button>}<button type="button" className="tm-secondary" onClick={() => setModal(null)}>Cancel</button><button className="tm-primary" type="submit" disabled={assignment.template !== 'collaborative' && !matchingFormAssignees.length}>{modal === 'edit' ? 'Save changes' : isEmployee ? 'Submit request' : assignment.template === 'collaborative' ? 'Create workflow' : 'Save task'}<Icon name="arrow" size={16} /></button></div></form> : selected && <TaskDetailLayout key={selected.id} task={selected} workflow={<CollaborativeTasks key={selected.id} task={selected} tasks={tasks} config={config} context={previewScope} onOpen={openTask} onComplete={submission => update(selected, { status: 'Completed', submission }, 'Main task completed and closed by its designated final approver.')} onReopen={child => update(child, { status: 'Revision Needed', remarks: 'Coordinator requested a revised child submission.' }, 'Child task returned for revision by its coordinator.')} onCreate={value => {
            const child = createChildTask(selected, tasks, config, previewScope, value);
            setTasks(previous => appendCollaborativeChild(previous, selected, child));
            setSelected(previous => ({ ...previous, template: 'collaborative', kind: previous.parentId ? 'Monitoring / delegated task' : previous.kind }));
            setActivity(previous => [{ text: `${selected.assignee} assigned “${child.title}” to ${child.assignee} under “${selected.title}”.`, branch: child.branch, department: child.department, assignee: child.assignee, time: new Date().toISOString() }, ...previous]);
            setNotice('Child task assigned. The main task waits for all child approvals.');
        }} />} followUps={<TaskPings key={selected.id} task={selected} context={pingContext} onSend={message => {
            const pings = sendTaskPing(selected, pingContext, message);
            update(selected, { pings }, `${pingContext.sender} sent a follow-up and requested acknowledgement from ${selected.assignee}.`);
        }} onAcknowledge={id => {
            try { const pings = acknowledgeTaskPing(selected, id, pingContext); update(selected, { pings }, `${actor?.name || currentEmployee.name} acknowledged a follow-up.`); } catch (error) { setNotice(error.message); }
        }} />} history={<><TaskHistory task={selected} /><DeleteTaskControl key={selected.id} task={selected} tasks={tasks} context={previewScope} onDelete={deleteSelectedTask} /></>}>{isReportTask(selected) && <div className="tm-report-completion"><ReportStatus status={selected.status} />{canCorrectITReport(selected, { role, employee: currentEmployee, config }) && <button className="tm-secondary" onClick={() => correctITReport(selected)}>Edit report</button>}</div>}{selected.correcting && <p className="tm-form-note">Editing a correction. Submit the report again when finished so it can be reviewed.</p>}<TaskOverview actions={!isEmployee && !isReportTask(selected) && !['Completed', 'Denied'].includes(selected.status) && <div className="tm-detail-toolbar"><button className="tm-secondary" onClick={() => {
                setAssignment({
                  ...(employeeByName(selected.assignee) || {}),
                  name: selected.assignee,
                  roleFilter: 'All',
                  due: selected.due,
                  department: selected.department,
                  branch: selected.branch,
                  template: selected.template || 'standard'
                });
                setModal('edit');
              }}>Edit details</button></div>} task={selected} badges={<><Badge value={selected.priority} /><Badge value={selected.status} />{overdue(selected) && <Badge value="Overdue" />}</>} assignee={<><Avatar name={selected.assignee} /><span>{selected.assignee}</span></>} deadline={`${prettyDate(selected.due)}, ${selected.due.slice(0, 4)}`} schedule={selected.recurrence === 'daily' ? `Daily · ${selected.scheduledDate}` : isWeeklyReport(selected) ? `Weekly · ${selected.weekStart} – ${selected.weekEnd}` : 'One-time task'} />{selected.link && <p><a href={/^https?:\/\//i.test(selected.link) ? selected.link : undefined} target="_blank" rel="noreferrer">Open reference link ↗</a></p>}{selected.remarks && <div className="tm-review-feedback"><h3>Reviewer feedback</h3><p>{selected.remarks}</p></div>}{selected.submission && !isReportTask(selected) && <div className="tm-submission"><div className="tm-section-heading"><h3>Latest submission</h3><span>Submitted by {selected.assignee}</span></div><p>{selected.submission}</p></div>}
        {isWeeklyReport(selected) && <WeeklyReport key={selected.id + '-' + selected.status} task={selected} tasks={tasks} canEdit={canEditWeeklyReport(selected, currentEmployee, config, role)} onDraft={weeklyReport => update(selected, { weeklyReport, status: selected.status === 'Not Started' ? 'In Progress' : selected.status }, 'Intern weekly report draft saved.')} onSubmit={weeklyReport => {
            update(selected, { weeklyReport, submission: formatWeeklyReport(selected, weeklyReport), status: 'Pending Review' }, 'Intern weekly report submitted for review.');
            setModal(null);
        }} />}
        {selected.template?.startsWith('daily-custom-') && <CustomDailyReport key={selected.id + '-' + selected.status} task={selected} canEdit={reportEditable(selected)} branches={employeeByName(selected.assignee)?.availableBranches || branches} onDraft={customReport => update(selected, { customReport, branch: customReport.branch, status: selected.status === 'Not Started' ? 'In Progress' : selected.status }, 'Daily report draft saved.')} onSubmit={customReport => {
            update(selected, { customReport, branch: customReport.branch, submission: formatCustomReport(selected, customReport), status: 'Pending Review' }, 'Daily report submitted for review.');
            setModal(null);
        }} />}
        {selected.template === 'daily-operations' && <OperationsReport canEdit={reportEditable(selected)} key={selected.id + '-' + selected.status} task={selected} branches={branchScopedRole(role) ? [leadershipBranch] : employeeByName(selected.assignee)?.availableBranches || branches} onNotice={setNotice} onDraft={operations => update(selected, { operations, branch: operations.branch, status: selected.status === 'Not Started' ? 'In Progress' : selected.status }, 'Operations report draft saved.')} onSubmit={operations => {
            update(selected, { operations, branch: operations.branch, submission: formatOperations(operations), status: 'Pending Review' }, 'Operations report submitted for review.');
            setModal(null);
        }} />}
        {selected.template === 'narrative-report' && <NarrativeReport canEdit={reportEditable(selected)} key={selected.id + '-' + selected.status} task={selected} branches={branchScopedRole(role) ? [leadershipBranch] : employeeByName(selected.assignee)?.availableBranches || branches} onNotice={setNotice} onDraft={narrative => update(selected, {
              narrative,
              branch: narrative.branch,
              status: selected.status === 'Not Started' ? 'In Progress' : selected.status
            }, 'Narrative Report draft saved.')} onSubmit={narrative => {
              update(selected, {
                narrative,
                branch: narrative.branch,
                submission: formatNarrative(narrative),
                correcting: false,
                status: 'Pending Review'
              }, 'Narrative Report submitted for review.');
              setModal(null);
            }} />}
        {selected.template === 'it-opening-rounds' && <DismissOpeningReport key={'dismiss-'+selected.id} task={selected} allowed={canDismissOpeningReport(selected,previewScope,today)} onDismiss={()=>update(selected,{status:'Dismissed'},`Opening Report dismissed for today by ${actor?.name}.`)}/>}
        {selected.template === 'it-opening-rounds' && selected.status !== 'Pending Approval' && <OpeningRounds canEdit={reportEditable(selected)} branches={selected.sharedBranchReport ? [selected.branch] : branchScopedRole(role) ? [leadershipBranch] : employeeByName(selected.assignee)?.availableBranches || branches} checks={config.checks} itDepartment={config.itDepartment} key={selected.id + '-' + selected.status} task={selected} onNotice={setNotice} onDraft={rounds => update(selected, {
              rounds,
              branch: rounds.branch,
              department: rounds.department,
              status: selected.status === 'Not Started' ? 'In Progress' : selected.status
            }, 'Opening Rounds draft saved.')} onSubmit={rounds => {
              update(selected, {
                rounds,
                branch: rounds.branch,
                department: rounds.department,
                submission: formatRounds(rounds),
                correcting: false,
                submittedBy: currentEmployee.name,
                status: 'Pending Review'
              }, 'Opening Rounds submitted for approval.');
              setModal(null);
            }} />}
        {!(isCollaborativeTask(selected) && !selected.parentId && selected.assignee === actor?.name) && !isReportTask(selected) && canSubmitAssignedTask(selected, { role, employee: currentEmployee, actor }) && dependencyBlockers(selected, tasks).length === 0 && <form className="tm-task-action-card" onSubmit={e => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (!data.get('submission').trim()) {
                setNotice('Describe your output or provide a link before submitting.');
                return;
              }
              update(selected, {
                submission: data.get('submission').trim(),
                status: 'Pending Review'
              }, `“${selected.title}” submitted for review.`);
              setModal(null);
            }}><h3>Submit your work</h3><p className="tm-action-description">Describe the completed work and include any supporting links for your reviewer.</p><label>Your output<textarea name="submission" required rows={3} placeholder="Describe your output or paste a link…" /></label><div className="tm-modal-actions">{selected.status === 'Not Started' && <button className="tm-secondary" type="button" onClick={() => update(selected, {
                  status: 'In Progress'
                }, 'Task marked in progress.')}>Start task</button>}<button className="tm-primary" type="submit">Submit for review</button></div></form>}
        {role === 'Team Leader' && selected.requestedBy === actor?.name && selected.status === 'Not Started' && selected.template === 'standard' && !selected.parentId && !selected.sample && !selected.approvalRequired && <div className="tm-task-action-card"><p>This task needs higher-up approval before work begins.</p><button type="button" className="tm-primary" onClick={()=>{try{const request=routeTaskApproval(selected,config,previewScope);update(selected,{status:request.status,approvalRequired:true,approvalReviewer:request.approvalReviewer,approvalReviewerRole:request.approvalReviewerRole},'Task submitted for higher-up approval.');}catch(error){setNotice(error.message);}}}>Send for approval</button></div>}{canReviewTask(selected) && ['Pending Review', 'Pending Approval'].includes(selected.status) && <form className="tm-task-action-card tm-review-action-card" onSubmit={e => e.preventDefault()}><h3>{selected.status === 'Pending Approval' ? 'Approve task request' : 'Review submission'}</h3><p className="tm-action-description">{selected.status === 'Pending Approval' ? 'Approve this task before the assignee can begin work.' : 'Check the submitted work, then approve it or send feedback to the assignee.'}</p><label>Review remarks<textarea name="remarks" rows={2} placeholder="Explain your decision (required for revision or denial)…" /></label><div className="tm-modal-actions">{(selected.status === 'Pending Approval' ? ['Deny', 'Approve'] : ['Request revision', 'Deny', 'Approve']).map(action => <button key={action} type="button" className={action === 'Approve' ? 'tm-primary' : action === 'Deny' ? 'tm-secondary tm-review-deny' : 'tm-secondary'} onClick={e => {
                  /* Revision and denial require feedback so the assignee knows what to change. */const remarks = new FormData(e.currentTarget.form).get('remarks').trim();
                  if (action !== 'Approve' && !remarks) {
                    setNotice('Add reviewer remarks before returning or denying this task.');
                    return;
                  }
                  update(selected, {
                    status: action === 'Approve' ? selected.status === 'Pending Approval' ? 'Not Started' : 'Completed' : action === 'Deny' ? 'Denied' : 'Revision Needed',
                    remarks
                  }, `${selected.title}: ${action === 'Approve' ? 'approved' : action === 'Deny' ? 'denied' : 'returned for revision'}.`);
                  setModal(null);
                }}>{action}</button>)}</div></form>}

        {selected.status === 'Pending Approval' && <div className="tm-form-note">Waiting for approval from {selected.approvalReviewer || 'the next higher-up'}. Work can begin after approval.</div>}</TaskDetailLayout>}</section></div>}
    </div></SidebarLayout>;
}








