export type CommandSource = 'ready' | 'restricted' | 'unavailable' | 'not-configured' | 'partial';
export interface SetupStep {label:string;done:boolean|null;href:string|null;permission:string}
export interface CommandAction {key:string;title:string;count:number;href:string;detail:string}
export interface CommandActivity {id:string;title:string;type:string;date:string;href:string}
export interface CommandAttendanceRow {classId:string;className:string;sectionId:string;sectionName:string;total:number;statuses:Record<string,number>;recorded:number;notMarked:number|null;dayState:string;completion:number|null}
export interface SchoolCommandData {
 asOf:string;school:{id:string;name:string;shortName?:string|null;logoId?:string|null;logoUrl?:string|null}|null;academicYear:{id:string;name:string}|null;clock:{date:string;time:string;timeZone:string};scope:string;
 sources:Record<string,CommandSource>;errors:Record<string,string>;setup:{steps:SetupStep[];completed:number;total:number;complete:boolean;outstanding:number};counts:Record<string,number|null>;
 attendance:{total:number;unassigned:number;expected:number;recorded:number;notMarked:number;percentage:number|null;statuses:Record<string,number>;sections:CommandAttendanceRow[];unknownCalendar:number}|null;
 dayStates:Record<string,string>;staff:{total:number;calendarStatus:string;statuses:Record<string,number>;teachers:number;teacherStatuses:Record<string,number>}|null;leaves:{approvedToday:number;pending:number}|null;cover:{covered:number;uncovered:number;scheduled:number;holiday:boolean;pending:number|null}|null;timetable:{flagged:number;note:string}|null;pendingTasks:number|null;actions:CommandAction[];activities:CommandActivity[];notes:string[];
}
export function dashboardNumber(value:number|null|undefined,suffix='') {return value===null||value===undefined?'—':new Intl.NumberFormat('en-IN',{maximumFractionDigits:1}).format(value)+suffix;}
export function schoolDateLabel(date:string){return new Date(date+'T12:00:00Z').toLocaleDateString('en-IN',{timeZone:'UTC',weekday:'short',day:'numeric',month:'short',year:'numeric'});}
export function commandDayLabel(states:Record<string,string>){const values=[...new Set(Object.values(states))];return !values.length?'Schedule not configured':values.length>1?'Mixed class schedules':({WORKING:'School working day',HOLIDAY:'School holiday',WEEKLY_OFF:'Weekly off',OUTSIDE_YEAR:'Outside selected academic year',NOT_CONFIGURED:'Schedule not configured'}[values[0]]||'Schedule unavailable');}
