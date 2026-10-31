'use client';
import { BrandingStudio } from './branding-studio';
import { AcademicTeam } from './academic-team';
import { SchoolUrl } from './school-url';
import Link from '../lib/school-navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from '../lib/school-navigation';
import { Building2, Palette, Link2, Users, ArrowUpRight, Copy, Pencil, Check } from 'lucide-react';
import { schoolApi, schoolSettingsApi, schoolExperienceApi, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import { useToast } from '../lib/toast-context';
import type { School } from '../lib/types';
import { ErrorState, Field, LoadingState } from './ui';
import { SchoolPreferences } from './school-preferences';
const tabs=[{key:'information',label:'School Information',icon:Building2},{key:'branding',label:'Branding & Appearance',icon:Palette},{key:'url',label:'School URL & PWA',icon:Link2},{key:'academic',label:'Academic Management',icon:Users}];
const fields=[['name','Official school name'],['shortName','School short name'],['address','Address'],['city','City'],['state','State'],['country','Country'],['phone','Phone number'],['email','School email'],['website','Website']] as const;
function safeLogo(value:string){try{const url=new URL(value);return url.protocol==='https:'?url.href:'';}catch{return '';}}
export function SchoolProfileWorkspace({legacySettings=false}:{legacySettings?:boolean}){
 const {session,can,refresh}=useAuth();const {show}=useToast();const router=useRouter();const params=useSearchParams();
 const active=tabs.some(t=>t.key===params.get('tab'))?params.get('tab')!:'information';
 const [school,setSchool]=useState<School|null>(null),[draft,setDraft]=useState<Partial<School>>({}),[settings,setSettings]=useState<Record<string,any>|null>(null);
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[editing,setEditing]=useState(false),[busy,setBusy]=useState(false),[logo,setLogo]=useState(''),[displayName,setDisplayName]=useState(''),[copied,setCopied]=useState(false);
 const [managedLogo,setManagedLogo]=useState('');
 const [legacyLogoAllowed,setLegacyLogoAllowed]=useState(true);
 const [brandDirty,setBrandDirty]=useState(false),[teamDirty,setTeamDirty]=useState(false);
 const writable=can('SCHOOL_PROFILE_UPDATE');
 useEffect(()=>{let alive=true;if(!session?.user.schoolId)return;setLoading(true);setError('');Promise.all([schoolApi.current(session.token),schoolSettingsApi.get(session.token,session.user.schoolId).catch(e=>{if(e instanceof ApiError&&e.status===404)return null;throw e;})]).then(([s,p])=>{if(alive){setSchool(s);setDraft(s);setSettings(p);setLegacyLogoAllowed((p?.branding as any)?.legacyLogoEnabled!==false);setManagedLogo((p?.branding as any)?.logoId?schoolExperienceApi.publicMedia((p!.branding as any).logoId):'');setLogo(String(p?.logoUrl||''));setDisplayName(String(p?.schoolName||''));}}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[session?.token,session?.user.schoolId]);
 useEffect(()=>{let active=true;const update=()=>{if(session)schoolExperienceApi.branding(session.token).then(r=>{if(active){setLegacyLogoAllowed(r.branding.legacyLogoEnabled!==false);setManagedLogo(r.branding.logoId?schoolExperienceApi.publicMedia(r.branding.logoId):'');}}).catch(()=>{});};window.addEventListener('davi:branding',update);return()=>{active=false;window.removeEventListener('davi:branding',update);};},[session?.token]);
 const dirty=brandDirty||teamDirty||editing&&fields.some(([k])=>String(draft[k]||'')!==String(school?.[k]||''))||logo!==String(settings?.logoUrl||'')||displayName!==String(settings?.schoolName||'');
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[dirty]);
 function selectTab(key:string){if(dirty&&!window.confirm('Discard unsaved changes?'))return;setBrandDirty(false);setTeamDirty(false);setEditing(false);setDraft(school||{});setLogo(String(settings?.logoUrl||''));setDisplayName(String(settings?.schoolName||''));const q=new URLSearchParams(params.toString());q.set('tab',key);router.push('/school/profile?'+q.toString(),{scroll:false});}
 async function saveInfo(e:FormEvent){e.preventDefault();if(!session||!writable)return;setBusy(true);try{const payload=Object.fromEntries(fields.map(([k])=>[k,String(draft[k]||'').trim()]));const saved=await schoolApi.updateCurrent(session.token,payload);setSchool(saved);setDraft(saved);setEditing(false);await refresh();show('School information saved.');}catch(e){show(e instanceof Error?e.message:'Unable to save.','error');}finally{setBusy(false);}}
 async function saveBrand(e:FormEvent){e.preventDefault();if(!session||!writable)return;if(logo&&!safeLogo(logo)){show('Use a valid HTTPS logo URL.','error');return;}setBusy(true);try{const changes={logoUrl:logo.trim(),schoolName:displayName.trim()};const saved=settings?.id?await schoolSettingsApi.update(session.token,String(settings.id),changes):await schoolSettingsApi.save(session.token,{...changes,timezone:'Asia/Kolkata'});setSettings(saved);setLogo(String(saved.logoUrl||''));setDisplayName(String(saved.schoolName||''));show('School appearance saved.');}catch(e){show(e instanceof Error?e.message:'Unable to save.','error');}finally{setBusy(false);}}
 if(loading||(school&&school.id!==session?.user.schoolId))return <LoadingState label="Loading school profile…"/>;
 if(error)return <ErrorState message={error} retry={()=>window.location.reload()}/>;
 const name=displayName||school?.name||'School', initials=(school?.shortName||school?.name||'S').slice(0,2).toUpperCase();
 const loginPath=school?.slug?`/school/${encodeURIComponent(school.slug)}/login`:'';
 const brandMark=managedLogo||(legacyLogoAllowed&&safeLogo(logo))?<img src={managedLogo||safeLogo(logo)} alt="School logo"/>:<span>{initials}</span>;
 return <div className="school-profile-workspace">
  <header className="sp-heading"><div><span className="eyebrow">SCHOOL ADMINISTRATION</span><h1>School Profile &amp; Branding</h1><p>One place for your school identity, appearance and academic team.</p></div><span className="sp-access">{writable?'Administrator access':'Read-only access'}</span></header>
  <section className="sp-identity"><div className="sp-logo">{brandMark}</div><div><h2>{school?.name}</h2><p>{school?.shortName||'Short name not configured'}<span aria-hidden="true"> · </span>{[school?.city,school?.state].filter(Boolean).join(', ')||'Location not configured'}</p></div><span className="sp-school-tag">School workspace</span></section>
  <nav className="sp-tabs" aria-label="School profile sections">{tabs.map(t=><button key={t.key} type="button" aria-current={active===t.key?'page':undefined} onClick={()=>selectTab(t.key)}><t.icon size={17} aria-hidden="true"/>{t.label}</button>)}</nav>
  <section className="sp-panel" aria-label={tabs.find(t=>t.key===active)?.label}>
  {active==='information'&&<><div className="sp-section-heading"><div><h2>School information</h2><p>Official identity and contact details used across DAVI.</p></div>{writable&&!editing&&<button className="button secondary" onClick={()=>setEditing(true)}><Pencil size={15}/> Edit information</button>}</div>{editing?<form onSubmit={saveInfo} className="form-grid two">{fields.map(([key,label])=><Field key={key} label={label} required={key==='name'}><input required={key==='name'} type={key==='email'?'email':key==='website'?'url':key==='phone'?'tel':'text'} value={String(draft[key]||'')} onChange={e=>setDraft({...draft,[key]:e.target.value})}/></Field>)}<div className="form-actions span-two"><button type="button" disabled={busy} className="button secondary" onClick={()=>{setDraft(school||{});setEditing(false);}}>Cancel</button><button className="button" disabled={busy}>{busy?'Saving…':'Save changes'}</button></div></form>:<dl className="sp-details">{fields.map(([key,label])=><div key={key}><dt>{label}</dt><dd>{String(school?.[key]||'Not provided')}</dd></div>)}</dl>}<details className="sp-legacy" open={legacySettings}><summary>Existing preferences and legacy settings</summary><p>Previous settings remain accessible here. Configure attendance, timetables and assessment policies in their dedicated modules.</p><SchoolPreferences/></details></>}
  {active==='branding'&&<BrandingStudio key={session?.user.schoolId} onDirtyChange={setBrandDirty} name={school?.name||'School'}/>}
  {active==='url'&&school&&<SchoolUrl key={session?.user.schoolId} slug={school.slug} onSaved={slug=>setSchool({...school,slug})}/>}
  {active==='academic'&&<AcademicTeam key={session?.user.schoolId} onDirtyChange={setTeamDirty}/>}
  </section>
 </div>;
}
