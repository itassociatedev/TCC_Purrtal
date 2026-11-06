import {useId,useState} from 'react';
// Inline help works with mouse, keyboard and touch, without opening another dialog.
export default function HelpHint({label='Help',children}){
 const id=useId(),[open,setOpen]=useState(false),[position,setPosition]=useState({});
 return <span className="clinic-help" onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}} onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();setOpen(false);}}}>
 <button type="button" className="clinic-help-trigger" aria-label={label} aria-expanded={open} aria-controls={id} aria-describedby={open?id:undefined} onClick={event=>{const rect=event.currentTarget.getBoundingClientRect();setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-Math.min(310,window.innerWidth*.7)-12)),top:rect.top>window.innerHeight/2?'auto':rect.bottom+8,bottom:rect.top>window.innerHeight/2?window.innerHeight-rect.top+8:'auto'});setOpen(value=>!value);}}><span aria-hidden="true">i</span></button>
 {open&&<span id={id} role="note" className="clinic-help-description" style={position}>{children}</span>}
 </span>;
}
