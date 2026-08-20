'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { academicYearApi } from './api'; import { useAuth } from './auth-context'; import type { AcademicYear } from './types';
interface Value { years: AcademicYear[]; selected: AcademicYear | null; selectedId: string; setSelectedId: (id: string) => void; loading: boolean; reload: () => Promise<void> }
const Context = createContext<Value | null>(null);
export function AcademicYearProvider({ children }: { children: ReactNode }) { const { session, can } = useAuth(); const [years, setYears] = useState<AcademicYear[]>([]); const [selectedId, setSelectedIdState] = useState(''); const [loading, setLoading] = useState(false);
  const reload = async () => { if (!session || !can('ACADEMIC_YEAR_VIEW')) return; setLoading(true); try { const data = await academicYearApi.list(session.token); setYears(data); const saved = localStorage.getItem('davi_academic_year'); const preferred = data.find(y => y.id === saved) || data.find(y => y.isCurrent) || data[0]; setSelectedIdState(preferred?.id || ''); } finally { setLoading(false); } };
  useEffect(() => { void reload(); }, [session?.token]); const setSelectedId = (id: string) => { setSelectedIdState(id); localStorage.setItem('davi_academic_year', id); };
  const value = useMemo(() => ({ years, selected: years.find(y => y.id === selectedId) || null, selectedId, setSelectedId, loading, reload }), [years, selectedId, loading]); return <Context.Provider value={value}>{children}</Context.Provider>; }
export function useAcademicYear() { const v = useContext(Context); if (!v) throw new Error('Missing AcademicYearProvider'); return v; }
