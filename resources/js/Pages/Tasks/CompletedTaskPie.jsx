import {useState} from 'react';
import {completionPie} from './leaderboard.mjs';
const colors=['#526e8b','#a36b69','#a5874f','#597e70','#807490','#aa8061','#547c85','#697789'];
export default function CompletedTaskPie({rows,attentionOnly=false}) {
 const [active,setActive]=useState(null),segments=completionPie(attentionOnly ? rows.map(row=>({...row,completed:row.overdue})) : rows),total=segments.reduce((sum,item)=>sum+item.value,0);
 const metric=attentionOnly?'overdue tasks':'completed tasks';
 let angle=-Math.PI/2;
 return <section className="tm-completion-pie"><div><h3>{attentionOnly?'Overdue tasks':'Tasks completed'}</h3><p>{attentionOnly?'Share of overdue unfinished work':'Share of approved completions in the current results'}</p></div>{total>0?<div className="tm-completion-pie-body"><svg viewBox="0 0 240 240" role="group" aria-label={`${metric} pie chart: ${total} total`}>
  {segments.map((segment,index)=>{const start=angle,end=angle+segment.value/total*Math.PI*2;angle=end;const point=a=>`${120+100*Math.cos(a)},${120+100*Math.sin(a)}`;const props={fill:colors[index],stroke:active===index?'#111827':'#fff',strokeWidth:active===index?3:2,onMouseEnter:()=>setActive(index),onMouseLeave:()=>setActive(null),onFocus:()=>setActive(index),onBlur:()=>setActive(null),tabIndex:0,role:'img','aria-label':`${segment.name}: ${segment.value} ${metric} (${Math.round(segment.value/total*1000)/10}%)`};return segments.length===1?<circle key={segment.name} cx="120" cy="120" r="100" {...props}><title>{props['aria-label']}</title></circle>:<path key={segment.name} d={`M120,120 L${point(start)} A100,100 0 ${end-start>Math.PI?1:0} 1 ${point(end)} Z`} {...props}><title>{props['aria-label']}</title></path>;})}
 </svg><div className="tm-pie-legend">{segments.map((segment,index)=><div key={segment.name} onMouseEnter={()=>setActive(index)} onMouseLeave={()=>setActive(null)}><i style={{background:colors[index]}}/><span>{segment.name}</span><strong>{segment.value}</strong><small>{Math.round(segment.value/total*1000)/10}%</small></div>)}<p>{total} {metric} total</p></div></div>:<div className="tm-pie-empty">No {metric} for these filters yet.</div>}</section>;
}
