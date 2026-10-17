import {BadRequestException} from '@nestjs/common';
export type LeavePolicy = {
  leaveType:string; allocation:'MONTHLY'|'ANNUAL'; days:number;
  carryForward:boolean; maximumCarryForward:number; maximumBalance:number|null;
  paid:boolean; halfDayAllowed:boolean; approverIds:string[]; allowNegative:boolean;
  prorateNewJoiners:boolean; creditDay:number; period:'CALENDAR'|'ACADEMIC';
  countHolidays:boolean; countWeeklyOff:boolean;
};
export const defaultLeavePolicy:LeavePolicy={leaveType:'',allocation:'ANNUAL',days:0,carryForward:false,maximumCarryForward:0,maximumBalance:null,paid:true,halfDayAllowed:true,approverIds:[],allowNegative:false,prorateNewJoiners:false,creditDay:1,period:'CALENDAR',countHolidays:false,countWeeklyOff:false};
export function validateLeavePolicies(rows:any,types:string[]) {
  if(!Array.isArray(rows)||rows.length>50||!Array.isArray(types))throw new BadRequestException('Provide valid leave types and up to 50 leave policies.');
  const seen=new Set<string>();
  for(const input of rows){const p={...defaultLeavePolicy,...input};
    if(!types.includes(p.leaveType)||seen.has(p.leaveType)||!['MONTHLY','ANNUAL'].includes(p.allocation)||!['CALENDAR','ACADEMIC'].includes(p.period)||!Number.isFinite(p.days)||p.days<0||p.days>366||!Number.isInteger(p.creditDay)||p.creditDay<1||p.creditDay>31)throw new BadRequestException('Invalid leave type, allocation, period or credit day.');
    seen.add(p.leaveType);
    for(const key of ['carryForward','paid','halfDayAllowed','allowNegative','prorateNewJoiners','countHolidays','countWeeklyOff'])if(typeof (p as any)[key]!=='boolean')throw new BadRequestException('Invalid leave policy option: '+key);
    if(!Number.isFinite(p.maximumCarryForward)||p.maximumCarryForward<0||(p.maximumBalance!==null&&(!Number.isFinite(p.maximumBalance)||p.maximumBalance<0))||!Array.isArray(p.approverIds)||p.approverIds.some((v:any)=>typeof v!=='string'))throw new BadRequestException('Invalid leave cap or approval authority.');
  }
}
const dateKey=(date:Date)=>date.toISOString().slice(0,10);
const rounded=(value:number)=>Math.round(value*100)/100;

// Accrual is earned by server-local date; future months are never credited early.
export function leaveCreditSchedule(policy:LeavePolicy,start:Date,end:Date,asOf:Date,joiningDate?:Date|null){
  const credits:{key:string;date:Date;days:number}[]=[];
  if(asOf<start||joiningDate&&joiningDate>end)return credits;
  const last=asOf<end?asOf:end;
  if(policy.allocation==='ANNUAL'){
    const credit=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),Math.min(policy.creditDay,new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+1,0)).getUTCDate())));
    const effective=new Date(Math.max(+start,+credit,joiningDate?+joiningDate:+start));
    if(effective>last)return credits;
    const proportion=policy.prorateNewJoiners&&joiningDate&&joiningDate>start?Math.max(0,(+end-+joiningDate+86400000)/(+end-+start+86400000)):1;
    return[{key:'ANNUAL',date:effective,days:rounded(policy.days*proportion)}];
  }
  for(let month=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth(),1));month<=last;month=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,1))){
    const monthEnd=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)),windowStart=new Date(Math.max(+month,+start)),windowEnd=new Date(Math.min(+monthEnd,+end));
    const scheduled=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(policy.creditDay,monthEnd.getUTCDate())));
    const effective=new Date(Math.max(+scheduled,+windowStart,joiningDate?+joiningDate:+windowStart));
    if(effective>last||effective>windowEnd)continue;
    const activeStart=new Date(Math.max(+windowStart,joiningDate?+joiningDate:+windowStart));
    const proportion=policy.prorateNewJoiners?(+windowEnd-+activeStart+86400000)/(monthEnd.getUTCDate()*86400000):1;
    credits.push({key:dateKey(month).slice(0,7),date:effective,days:rounded(policy.days*proportion)});
  }
  return credits;
}
