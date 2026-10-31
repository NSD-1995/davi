import type { CommandActionGroup, SchoolCommandData } from './school-command-center';
export type ActionFilter='ALL'|'URGENT'|'TODAY'|'OVERDUE';
const priorities:Record<string,number>={CRITICAL:0,HIGH:1,NORMAL:2};
function instant(value?:string|null){if(!value)return Infinity;const time=Date.parse(value);return Number.isFinite(time)?time:Infinity;}
export function commandActions(data:SchoolCommandData):CommandActionGroup[]{
 const rows=data.actionGroups||data.actions.map(row=>({...row,priority:row.priority||'NORMAL',status:row.status||'PENDING',items:[row]}));
 return rows.map(row=>{
  const dates=[row.dueAt,...row.items.map(item=>item.dueAt)].filter((value):value is string=>typeof value==='string'&&Number.isFinite(instant(value))).sort((a,b)=>instant(a)-instant(b));
  const owners=[...new Set([row.responsible,...row.items.map(item=>item.responsible)].filter((value):value is string=>!!value))];
  return {...row,dueAt:dates[0]||null,responsible:owners.length===1?owners[0]:owners.length>1?owners.length+' staff members':null,context:row.context||(row.items.length===1?row.items[0].context||row.items[0].title:null)};
 }).sort((a,b)=>(priorities[a.priority]??2)-(priorities[b.priority]??2)||(a.status==='OVERDUE'?0:1)-(b.status==='OVERDUE'?0:1)||instant(a.dueAt)-instant(b.dueAt)||a.key.localeCompare(b.key));
}
export function filterCommandActions(rows:CommandActionGroup[],filter:ActionFilter,date:string,zone:string){
 return rows.filter(row=>filter==='ALL'||filter==='URGENT'&&(row.priority==='CRITICAL'||row.items.some(item=>item.priority==='URGENT'))||filter==='OVERDUE'&&row.status==='OVERDUE'||filter==='TODAY'&&row.dueAt&&new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(row.dueAt))===date);
}
export interface TimelineItem {id:string;title:string;kind:'EVENT'|'ACTIVITY'|'NOTICE';type:string;time:string|null;status:string|null;context:string|null;href:string}
export function commandTimeline(data:SchoolCommandData):TimelineItem[]{
 const events:TimelineItem[]=data.activities.filter(item=>item.date===data.clock.date||!!item.endDate&&item.date<=data.clock.date&&item.endDate>=data.clock.date).map(item=>({id:item.id,title:item.title,kind:item.type==='ANNOUNCEMENT'?'NOTICE':'EVENT',type:item.type,time:item.date===data.clock.date?item.time||null:null,status:null,context:null,href:item.href}));
 const activities:TimelineItem[]=(data.dailyActivities||[]).filter(item=>item.date.slice(0,10)===data.clock.date).map(item=>({id:'activity:'+item.id,title:item.title,kind:'ACTIVITY',type:item.category,time:item.startTime||null,status:item.status,context:item.schoolClass.name+' / '+item.section.name+' · '+[item.teacher.user.firstName,item.teacher.user.lastName].filter(Boolean).join(' '),href:'#daily-activities'}));
 return [...events,...activities].sort((a,b)=>(a.time||'').localeCompare(b.time||'')||a.title.localeCompare(b.title));
}
