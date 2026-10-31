'use client';
import { useEffect, useState } from 'react';
import { ChevronDown, Building2, DoorOpen, UsersRound, LibraryBig, Users, Workflow, Radio, ChartPie, LockKeyhole, House, Palette, CalendarRange, School, Shapes, BookMarked, Presentation, ClipboardCheck, MapPinCheck, ChartNoAxesCombined, MessagesSquare, FileUser, SlidersHorizontal, GraduationCap, FileUp, GitFork, ArrowLeftRight, TrendingUp, ContactRound, PanelsTopLeft, TableProperties, CalendarCog, Clock3, NotebookPen, Sparkles, Activity, Contact, Fingerprint, CalendarMinus, ScrollText, ListTodo, UserRoundCog, ChartColumnIncreasing, AlarmClockCheck, Megaphone, PartyPopper, ShieldCheck, Gauge, ChartBarStacked, Award, HeartPulse, ScanEye, BriefcaseBusiness } from 'lucide-react';
import Link, { useSearchParams } from '../lib/school-navigation';
import { useAuth } from '../lib/auth-context';
import { visibleSidebar, sidebarLinkActive } from '../lib/sidebar-navigation';
const icons:Record<string,typeof School>={Building2:Building2,DoorOpen:DoorOpen,UsersRound:UsersRound,LibraryBig:LibraryBig,Users:Users,Workflow:Workflow,Radio:Radio,ChartPie:ChartPie,LockKeyhole:LockKeyhole,House:House,Palette:Palette,CalendarRange:CalendarRange,School:School,Shapes:Shapes,BookMarked:BookMarked,Presentation:Presentation,ClipboardCheck:ClipboardCheck,MapPinCheck:MapPinCheck,ChartNoAxesCombined:ChartNoAxesCombined,MessagesSquare:MessagesSquare,FileUser:FileUser,SlidersHorizontal:SlidersHorizontal,GraduationCap:GraduationCap,FileUp:FileUp,GitFork:GitFork,ArrowLeftRight:ArrowLeftRight,TrendingUp:TrendingUp,ContactRound:ContactRound,PanelsTopLeft:PanelsTopLeft,TableProperties:TableProperties,CalendarCog:CalendarCog,Clock3:Clock3,NotebookPen:NotebookPen,Sparkles:Sparkles,Activity:Activity,Contact:Contact,Fingerprint:Fingerprint,CalendarMinus:CalendarMinus,ScrollText:ScrollText,ListTodo:ListTodo,UserRoundCog:UserRoundCog,ChartColumnIncreasing:ChartColumnIncreasing,AlarmClockCheck:AlarmClockCheck,Megaphone:Megaphone,PartyPopper:PartyPopper,ShieldCheck:ShieldCheck,Gauge:Gauge,ChartBarStacked:ChartBarStacked,Award:Award,HeartPulse:HeartPulse,ScanEye:ScanEye,BriefcaseBusiness:BriefcaseBusiness};
const groupIcons:Record<string,string>={setup:'Building2',admissions:'DoorOpen',students:'UsersRound',academics:'LibraryBig',operations:'Users',automation:'Workflow',communication:'Radio',reports:'ChartPie',administration:'LockKeyhole'};
export function SidebarNavigation({path,compact,onNavigate}:{path:string;compact:boolean;onNavigate:()=>void}) {
 const {can,session}=useAuth(),params=useSearchParams(),query=params.toString();
 const [desktop,setDesktop]=useState(false);
 useEffect(()=>{const media=window.matchMedia('(min-width:1001px)');const update=()=>setDesktop(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 const admin=!!session?.roles?.some(r=>r.code==='SCHOOL_ADMIN');
 const groups=visibleSidebar(can,'',admin);
 const active=groups.find(group=>group.links.some(link=>sidebarLinkActive(link,path,query)))?.id;
 const [expanded,setExpanded]=useState<Record<string,boolean>>({});
 useEffect(()=>{setExpanded({});},[path,query]);
 const leaf=(link:typeof groups[number]['links'][number])=>{const Icon=icons[link.icon||'']||School,selected=sidebarLinkActive(link,path,query);return <Link key={link.href} href={link.href} title={link.label} aria-label={link.label} aria-current={selected?'page':undefined} className={selected?'active':''} onClick={onNavigate}><Icon size={18} aria-hidden="true"/><span className="nav-label">{link.label}</span></Link>;};
 return <nav aria-label="Primary">{groups.map(group=>{
  if(group.direct)return <div className="nav-group school-nav-direct" key={group.id}>{group.links.map(leaf)}</div>;
  const Icon=icons[groupIcons[group.id]]||School,open=(compact&&desktop)||(expanded[group.id]??group.id===active);
  return <div className="nav-group school-nav-group" key={group.id}><button className="nav-disclosure" aria-expanded={open} aria-controls={'school-nav-'+group.id} onClick={()=>setExpanded({...expanded,[group.id]:!open})}><Icon size={18} aria-hidden="true"/><span className="nav-label">{group.label}</span><ChevronDown size={15} aria-hidden="true" className={open?'chevron expanded':'chevron'}/></button><div id={'school-nav-'+group.id} className="school-nav-links" hidden={!open}>{group.links.map(leaf)}</div></div>;
 })}</nav>;
}
