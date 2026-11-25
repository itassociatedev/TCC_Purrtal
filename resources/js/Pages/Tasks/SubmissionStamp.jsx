import {submissionTimestamp,formatSubmissionTime} from './submissionTime.mjs';
export function elapsedLabel(seconds){
 if(!Number.isFinite(seconds)||seconds<0)return '';
 const minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60),days=Math.floor(hours/24);
 return days?days+'d '+hours%24+'h '+minutes%60+'m':hours?hours+'h '+minutes%60+'m':minutes?minutes+'m '+Math.floor(seconds%60)+'s':Math.floor(seconds)+'s';
}
export default function SubmissionStamp({task,label='Submitted'}){
 const timestamp=submissionTimestamp(task);
 const seconds=task.elapsedSeconds??(timestamp&&task.startedAt?Math.max(0,(new Date(timestamp)-new Date(task.startedAt))/1000):null);
 return <>{task.startedAt&&<span className="tm-submission-stamp">Started <time dateTime={task.startedAt}>{formatSubmissionTime(task.startedAt)} PHT</time></span>}{timestamp&&<span className="tm-submission-stamp">{label} <time dateTime={timestamp} title="Philippine time">{formatSubmissionTime(timestamp)} PHT</time>{elapsedLabel(seconds)&&<> · Elapsed: {elapsedLabel(seconds)}</>}</span>}</>;
}
