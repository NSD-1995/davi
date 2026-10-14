'use client';
import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
import {classApi} from './api';
import {useAuth} from './auth-context';
import {useAcademicYear} from './academic-year-context';
import {configuredAcademicGroups} from './academic-groups';
import type {SchoolClass} from './types';

type Value={groups:ReturnType<typeof configuredAcademicGroups>;loading:boolean;error:string;reload:()=>Promise<void>};
const Context=createContext<Value|null>(null);

export function SchoolAcademicGroupsProvider({children}:{children:ReactNode}){
  const {session,can}=useAuth(),{selectedId}=useAcademicYear(),path=usePathname();
  const [state,setState]=useState<{token:string;classes:SchoolClass[]}>({token:'',classes:[]});
  const [loading,setLoading]=useState(false),[error,setError]=useState('');
  const token=session?.user.schoolId&&can('CLASS_VIEW')?session.token:'';
  const reload=useCallback(async()=>{
    if(!token){setState({token:'',classes:[]});setError('');return;}
    setLoading(true);setError('');
    try{setState({token,classes:await classApi.list(token)});}
    catch(e){setState({token,classes:[]});setError(e instanceof Error?e.message:'Academic setup could not be loaded.');}
    finally{setLoading(false);}
  },[token]);
  useEffect(()=>{let active=true;if(!token){setState({token:'',classes:[]});return;}
    setLoading(true);setError('');
    classApi.list(token).then(classes=>{if(active)setState({token,classes});}).catch(e=>{if(active){setState({token,classes:[]});setError(e.message);}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[token,path]);
  const groups=useMemo(()=>configuredAcademicGroups(state.token===token?state.classes:[],selectedId),[state,token,selectedId]);
  return <Context.Provider value={{groups,loading,error,reload}}>{children}</Context.Provider>;
}

export function useSchoolAcademicGroups(){const value=useContext(Context);if(!value)throw new Error('Missing SchoolAcademicGroupsProvider');return value;}
