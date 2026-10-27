'use client';
import Link from '../../../../lib/school-navigation';
import { useEffect, useState } from 'react';
import { WorkspaceLoading } from '../../../../components/workspace-loading';
import { WorkspaceClassList } from '../../../../components/workspace-class-list';
import { ApiError, classWorkspaceApi } from '../../../../lib/api';
import { useAcademicYear } from '../../../../lib/academic-year-context';
import { useAuth } from '../../../../lib/auth-context';
import { EmptyState, ErrorState, PageHeader } from '../../../../components/ui';
import type { ClassWorkspace } from '../../../../lib/types';

export default function AcademicWorkspacePage() {
  const { session, can } = useAuth();
  const { selected } = useAcademicYear();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; rows: ClassWorkspace[]; loading: boolean; error: string }>({ key: '', rows: [], loading: true, error: '' });
  const requestKey = JSON.stringify([session?.token, selected?.id]);
  useEffect(() => {
    let active = true;
    if (!session || !selected) return;
    setResult({ key: requestKey, rows: [], loading: true, error: '' });
    classWorkspaceApi.list(session.token, selected.id).then(rows => {
      if (active) setResult({ key: requestKey, rows, loading: false, error: '' });
    }).catch(error => {
      if (active) setResult({ key: requestKey, rows: [], loading: false, error: error instanceof ApiError ? error.message : 'Workspace could not be loaded.' });
    });
    return () => { active = false; };
  }, [requestKey, attempt]);
  const current = result.key === requestKey;
  const rows = current ? result.rows : [];
  const loading = Boolean(session && selected && (!current || result.loading));
  return <div className="class-workspace-page">
    <PageHeader title="Class Workspace" description={selected ? `${selected.name} · Open a section to manage its daily learning and attendance.` : 'Select an academic year to open the workspace.'}/>
    {can('STUDENT_VIEW') && rows.some(row => row.unassignedStudentCount) && <aside className="workspace-allocation-note"><span>Confirmed students are waiting for section allocation.</span><Link className="text-button" href="/students/unassigned">View unassigned students</Link></aside>}
    {!selected ? <EmptyState title="No academic year selected" detail="Select an academic year from the header first."/> : loading ? <WorkspaceLoading/> : current && result.error ? <ErrorState message={result.error} retry={() => setAttempt(value => value + 1)}/> : !rows.length ? <EmptyState title="No classes yet" detail="Create classes and sections before opening the workspace."/> : <WorkspaceClassList key={requestKey} rows={rows} yearId={selected.id}/>}
  </div>;
}
