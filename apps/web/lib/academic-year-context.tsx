'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { academicYearApi } from './api'; import { useAuth } from './auth-context'; import type { AcademicYear } from './types';
interface Value { years: AcademicYear[]; selected: AcademicYear | null; selectedId: string; setSelectedId: (id: string) => void; loading: boolean; reload: () => Promise<void> }
const Context = createContext<Value | null>(null);
export function AcademicYearProvider({ children }: { children: ReactNode }) { const { session, can } = useAuth(); const [years, setYears] = useState<AcademicYear[]>([]); const [selectedId, setSelectedIdState] = useState(''); const [loading, setLoading] = useState(false);
  const requestVersion=useRef(0);
  const [loadedKey,setLoadedKey]=useState('');
  const storageKey = `davi_academic_year:${session?.user.schoolId}:${session?.user.id}`;
  const reload = async () => { const version=++requestVersion.current; if (!session || !can('ACADEMIC_YEAR_VIEW')) {setYears([]);setSelectedIdState('');setLoading(false);return;} setLoading(true); try { const data = await academicYearApi.list(session.token); if(version!==requestVersion.current)return; let saved:string|null=null;try{saved=localStorage.getItem(storageKey);}catch{} const preferred = data.find(y => y.id === saved) || data.find(y => y.isCurrent) || data[0];setYears(data);setSelectedIdState(preferred?.id || '');setLoadedKey(storageKey); } catch { if(version===requestVersion.current){setYears([]);setSelectedIdState('');} } finally { if(version===requestVersion.current)setLoading(false); } };
  useEffect(() => { setYears([]);setSelectedIdState('');void reload();return()=>{requestVersion.current++;}; }, [session?.token,storageKey]);
  const setSelectedId = (id: string) => { if(loadedKey!==storageKey||!years.some(y=>y.id===id))return;setSelectedIdState(id);try{localStorage.setItem(storageKey,id);}catch{} };
  const visibleYears=loadedKey===storageKey?years:[],visibleId=loadedKey===storageKey?selectedId:'';
  const value = useMemo(() => ({ years:visibleYears, selected:visibleYears.find(y => y.id === visibleId) || null, selectedId:visibleId, setSelectedId, loading, reload }), [years,selectedId,loading,loadedKey,storageKey]); return <Context.Provider value={value}>{children}</Context.Provider>; }

export function useAcademicYear() { const v = useContext(Context); if (!v) throw new Error('Missing AcademicYearProvider'); return v; }
