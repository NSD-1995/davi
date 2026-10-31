export interface InAppNotification { id:string; title:string; message:string; readAt?:string|null; createdAt?:string; dedupeKey?:string|null }
export function notificationSummary(items:InAppNotification[]) {
 const unread=items.filter(item=>!item.readAt).length;
 return {unread,badge:unread>99?'99+':unread?String(unread):null,items:[...items].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''))};
}
export function notificationDestination(item:InAppNotification,can:(p:string)=>boolean,parent=false) {
 const queryId=item.dedupeKey?.startsWith('QUERY:')?item.dedupeKey.split(':')[1]:null;
 if(queryId&&/^[0-9a-f-]{36}$/i.test(queryId)&&(parent||can('COMMUNICATION_VIEW')))return (parent?'/parent/learning':'/dashboard')+'?queryId='+queryId+'#parent-queries';
 // Deliberately allowlist known events; never follow arbitrary payload URLs.
 return item.dedupeKey?.startsWith('COVERAGE:')&&can('ATTENDANCE_VIEW')&&can('STAFF_VIEW')?'/people/teacher-attendance':null;
}
