import useDisplayPreferences from './useDisplayPreferences';
export default function AppearanceSwitch(){
    const [{appearance},setPreferences]=useDisplayPreferences();
    return <div className="clinic-appearance" role="group" aria-label="Website appearance">
        {['original','updated'].map(value=><button key={value} type="button" aria-pressed={appearance===value} onClick={()=>setPreferences({appearance:value})}>{value==='original'?'Original':'Updated'}</button>)}
    </div>;
}
