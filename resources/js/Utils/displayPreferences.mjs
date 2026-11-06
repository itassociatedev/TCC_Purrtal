const key='tcc-display-preferences';
export function normalizeDisplayPreferences(value={}){
 return {theme:['light','dark','system'].includes(value?.theme)?value.theme:'system',compatibility:value?.compatibility===true,appearance:value?.appearance==='original'?'original':'updated'};
}
const defaults=normalizeDisplayPreferences();
let current=defaults;
const listeners=new Set();
const browser=typeof window!=='undefined';
if(browser){try{const saved=localStorage.getItem(key);current=normalizeDisplayPreferences(saved?JSON.parse(saved):{appearance:localStorage.getItem('tcc-appearance')});}catch{}}
function apply(){
 if(!browser)return;
 const dark=current.theme==='dark'||current.theme==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches;
 const root=document.documentElement;
 root.classList.toggle('dark',dark);
 root.dataset.clinicTheme=dark?'dark':'light';
 root.dataset.clinicAppearance=current.appearance;
 root.dataset.clinicMotion=current.compatibility||window.matchMedia('(prefers-reduced-motion: reduce)').matches?'off':'on';
 root.dataset.clinicCompatibility=current.compatibility?'on':'off';
 root.style.colorScheme=dark?'dark':'light';
}
export const getDisplayPreferences=()=>current;
export const subscribeDisplayPreferences=listener=>{listeners.add(listener);return()=>listeners.delete(listener);};
export function setDisplayPreferences(changes){
 current=normalizeDisplayPreferences({...current,...changes});
 if(browser){try{localStorage.setItem(key,JSON.stringify(current));localStorage.setItem('tcc-appearance',current.appearance);}catch{}}
 apply();listeners.forEach(listener=>listener());
}
if(browser){
 apply();
 for(const query of ['(prefers-color-scheme: dark)','(prefers-reduced-motion: reduce)'])window.matchMedia(query).addEventListener('change',apply);
 window.addEventListener('storage',event=>{if(event.key===key){try{current=normalizeDisplayPreferences(JSON.parse(event.newValue||'{}'));}catch{current=defaults;}apply();listeners.forEach(listener=>listener());}});
}
