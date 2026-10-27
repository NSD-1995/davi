'use client';
import Link from '../lib/school-navigation';
import {useEffect,useRef,useState,useId} from 'react';
import {Bell,X,RefreshCw} from 'lucide-react';
import {teacherCoverApi} from '../lib/api';
import {useAuth} from '../lib/auth-context';
import {notificationSummary,notificationDestination,type InAppNotification} from '../lib/notification-presentation';
export function NotificationBell(){
 const {session,can}=useAuth();const full=can('NOTIFICATION_VIEW');
 const identity=session?`${session.user.schoolId}:${session.user.id}:${session.token}:${full}`:'';
 const [snapshot,setSnapshot]=useState<{key:string;items:InAppNotification[];loaded:boolean;error:string}>({key:'',items:[],loaded:false,error:''});
 const [open,setOpen]=useState(false),[limit,setLimit]=useState(8),[busy,setBusy]=useState<string|null>(null),[refresh,setRefresh]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),revision=useRef(0);const id=useId();
 const current=snapshot.key===identity?snapshot:{key:identity,items:[],loaded:false,error:''};const summary=notificationSummary(current.items);
 useEffect(()=>{setOpen(false);setLimit(8);setBusy(null);},[identity]);
 useEffect(()=>{let active=true;revision.current++;if(!session?.user.schoolId)return;
 const load=async()=>{const version=++revision.current;try{const items=await(full?teacherCoverApi.notifications(session.token):teacherCoverApi.alerts(session.token));if(active&&version===revision.current)setSnapshot({key:identity,items,loaded:true,error:''});}catch{if(active&&version===revision.current)setSnapshot(s=>({key:identity,items:s.key===identity?s.items:[],loaded:s.key===identity&&s.loaded,error:'Notifications could not be refreshed.'}));}};
 void load();const timer=setInterval(()=>{if(!document.hidden&&!busyRef.current)void load();},60000);const focus=()=>{if(!busyRef.current)void load();};window.addEventListener('focus',focus);return()=>{active=false;revision.current++;clearInterval(timer);window.removeEventListener('focus',focus);};},[identity,refresh]);
 const busyRef=useRef(false);
 useEffect(()=>{if(open){dialog.current?.showModal();}else if(dialog.current?.open){dialog.current.close();}},[open]);
 async function markRead(item:InAppNotification){if(!session||busyRef.current)return;const key=identity;busyRef.current=true;setBusy(item.id);revision.current++;try{await(full?teacherCoverApi.readNotification(session.token,item.id):teacherCoverApi.readAlert(session.token,item.id));setSnapshot(s=>s.key===key?{...s,items:s.items.map(n=>n.id===item.id?{...n,readAt:new Date().toISOString()}:n),error:''}:s);}catch{setSnapshot(s=>s.key===key?{...s,error:'Could not mark this notification read. Try again.'}:s);}finally{busyRef.current=false;setBusy(null);}}
 if(!session?.user.schoolId)return null;
 return <div className="shell-notifications"><button ref={trigger} className="shell-bell" onClick={()=>setOpen(true)} aria-label={current.error?'Notifications, refresh unavailable':!current.loaded?'Notifications, loading':`${summary.unread} unread ${full?'notifications':'recent alerts'}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}><Bell size={20} aria-hidden="true"/>{current.loaded&&summary.badge&&<span className="shell-unread" aria-hidden="true">{summary.badge}</span>}</button>
 <dialog ref={dialog} id={id} className="notification-dialog" aria-labelledby={id+'-title'} onCancel={()=>setOpen(false)} onClose={()=>{setOpen(false);trigger.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setOpen(false);}}}>
 <header><div><h2 id={id+'-title'}>Notifications</h2><small>{summary.unread>0?`${summary.unread} unread${full?'':' recent alerts'}`:'Recent history'}</small></div><button className="icon-button" aria-label="Close notifications" onClick={()=>setOpen(false)} autoFocus><X size={20}/></button></header>
 {current.error&&<div className="notification-error" role="alert">{current.error}<button className="text-button" onClick={()=>setRefresh(n=>n+1)}><RefreshCw size={14}/> Retry</button></div>}
 {!current.loaded&&!current.error&&<p role="status">Loading notifications…</p>}
 {current.loaded&&!summary.items.length&&<div className="notification-empty"><Bell size={25}/><h3>You’re all caught up.</h3><p>No notifications to show.</p></div>}
 <div className="notification-list">{summary.items.slice(0,limit).map(item=>{const href=notificationDestination(item,can);return <article key={item.id} className={!item.readAt?'unread':''}><div className="notification-meta"><span>{item.readAt?'Read':'Unread'}</span>{item.createdAt&&<time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString('en-IN',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time>}</div><h3>{item.title}</h3><p>{item.message}</p><div className="button-row">{href&&<Link className="text-button" href={href} onClick={()=>setOpen(false)}>Open attendance & cover</Link>}{!item.readAt&&<button className="text-button" disabled={!!busy} onClick={()=>void markRead(item)}>{busy===item.id?'Marking read…':'Mark as read'}</button>}</div></article>;})}</div>
 {summary.items.length>limit&&<button className="button secondary full" onClick={()=>setLimit(n=>n+20)}>Show more history</button>}
 {!full&&<p className="notification-scope-note">Showing up to 30 recent personal alerts.</p>}
 </dialog></div>;
}
