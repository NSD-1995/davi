'use client';
import {useSchoolAcademicGroups} from '../lib/school-academic-groups-context';
export function AcademicGroupPicker({value,onChange,label='Academic groups',disabled=false}:{value:string[];onChange:(groups:string[])=>void;label?:string;disabled?:boolean}){
 const {groups,loading,error}=useSchoolAcademicGroups();
 return <fieldset disabled={disabled||loading} style={{border:0,padding:0}}><legend>{label}</legend>{error&&<p className="danger-text">{error}</p>}<div className="choice-grid">{groups.map(group=><label key={group.id} className={`choice ${value.includes(group.id)?'selected':''}`}><input type="checkbox" checked={value.includes(group.id)} onChange={e=>onChange(e.target.checked?[...value,group.id]:value.filter(id=>id!==group.id))}/><strong>{group.label}</strong><small>{group.range}</small></label>)}</div>{!loading&&!error&&!groups.length&&<p>Create classes in Academic Setup to choose their groups.</p>}</fieldset>;
}
