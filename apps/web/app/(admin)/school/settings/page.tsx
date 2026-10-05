'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, schoolSettingsApi } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useToast } from '../../../../lib/toast-context';
import { ErrorState, Field, FormActions, LoadingState, PageHeader } from '../../../../components/ui';
const blank={schoolName:'',timezone:'Asia/Kolkata',language:'en',gradingSystem:'percentage',attendancePolicy:'',examPolicy:'',notificationEmail:'',logoUrl:''};
export default function SettingsPage(){const{session,can}=useAuth();const{show}=useToast();const[id,setId]=useState('');const[form,setForm]=useState(blank);const[loading,setLoading]=useState(true);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
const load=async()=>{if(!session?.user.schoolId)return;setLoading(true);setError('');try{const row=await schoolSettingsApi.get(session.token,session.user.schoolId);setId(String(row.id||''));setForm({...blank,...Object.fromEntries(Object.keys(blank).map(k=>[k,String(row[k]||blank[k as keyof typeof blank])]))});}catch(e){if(e instanceof ApiError&&e.status===404)setForm(f=>({...f,schoolName:session.user.school?.name||''}));else setError(e instanceof ApiError?e.message:'Settings could not be loaded.');}finally{setLoading(false);}};
useEffect(()=>{void load();},[session?.token,session?.user.schoolId]);
const save=async(e:FormEvent)=>{e.preventDefault();if(!session)return;setBusy(true);try{const row=id?await schoolSettingsApi.update(session.token,id,form):await schoolSettingsApi.save(session.token,form);setId(String(row.id||id));show('School settings saved.');}catch(e){show(e instanceof ApiError?e.message:'Settings could not be saved.','error');}finally{setBusy(false);}};
if(loading)return <LoadingState label="Loading school settings…"/>;if(error)return <ErrorState message={error} retry={()=>void load()}/>;const writable=can('SCHOOL_PROFILE_UPDATE');
return <><PageHeader title="School settings" description={writable?'Configure school-wide preferences.':'School-wide preferences (read only).'}/><section className="card"><form className="form-grid two" onSubmit={save}>{Object.entries(form).map(([key,value])=><Field key={key} label={key.replace(/([A-Z])/g,' $1')}><input disabled={!writable} type={key==='notificationEmail'?'email':key==='logoUrl'?'url':'text'} value={value} onChange={e=>setForm({...form,[key]:e.target.value})}/></Field>)}{writable&&<div className="span-two"><FormActions submitting={busy} onCancel={()=>void load()} label="Save settings"/></div>}</form></section></>}
