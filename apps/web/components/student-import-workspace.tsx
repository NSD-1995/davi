'use client';
import { useState } from 'react';
import { useAuth } from '../lib/auth-context';
import { StudentIntake } from './student-intake';
import { StudentMigrationWizard } from './student-migration-wizard';
export function StudentImportWorkspace(){
 const {can}=useAuth();const intake=can('ADMISSIONS_MANAGE'),migration=can('students.import.view');
 const [mode,setMode]=useState(intake?'admissions':'migration');
 if(!intake&&!migration)return <p role="alert">You do not have permission to import students.</p>;
 const active=mode==='admissions'&&intake?'admissions':migration?'migration':'admissions';
 return <><section className="card"><h1>Student Import</h1><p>Upload a student list, review sections and confirm the result. Add uploaded students directly, or use migration for detailed mapping and duplicate resolution.</p><div className="button-row" aria-label="Import purpose">{intake&&<button className={'button '+(active==='admissions'?'':'secondary')} aria-pressed={active==='admissions'} onClick={()=>setMode('admissions')}>Upload students & sections</button>}{migration&&<button className={'button '+(active==='migration'?'':'secondary')} aria-pressed={active==='migration'} onClick={()=>setMode('migration')}>Existing students & migration</button>}</div></section><div hidden={active!=='admissions'}>{intake&&<StudentIntake/>}</div><div hidden={active!=='migration'}>{migration&&<StudentMigrationWizard/>}</div></>;
}
