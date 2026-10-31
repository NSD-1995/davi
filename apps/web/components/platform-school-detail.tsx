'use client';

import { useEffect, useState } from 'react';
import { useParams } from '../lib/school-navigation';
import { ApiError, platformApi } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import Link from '../lib/school-navigation';
import { EmptyState, ErrorState, LoadingState, PageHeader, StatusBadge } from './ui';

const date = (value?: string) => value ? new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(value)) : '—';

export function PlatformSchoolDetail() {
  const { session } = useAuth(); const params = useParams<{ schoolId: string }>(); const schoolId = params.schoolId;
  const [school, setSchool] = useState<any>(); const [error, setError] = useState(''); const [loading, setLoading] = useState(true);
  const load = async () => { if (!session?.token || !schoolId) return; setLoading(true); setError(''); try { setSchool(await platformApi.school(session.token, schoolId)); } catch (e) { setError(e instanceof ApiError ? e.message : 'School details could not be loaded.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [session?.token, schoolId]);
  if (loading) return <LoadingState label="Loading school workspace…" />;
  if (error) return <><PageHeader title="School workspace" /><ErrorState message={error} retry={() => void load()} /></>;
  if (!school) return <EmptyState title="School not found" detail="The school may no longer exist or you no longer have platform access." action={<Link className="button" href="/davi/schools">Back to schools</Link>} />;
  const contact = [school.email, school.phone].filter(Boolean).join(' · ') || 'No contact information';
  return <><PageHeader title={school.name} description={`${school.slug} · Created ${date(school.createdAt)}`} action={<Link className="button secondary" href="/davi/schools">Back to schools</Link>} />
    <section className="metric-grid"><Metric label="School status" value={school.onboarding?.status || 'PENDING'} /><Metric label="Programs" value={school.programEntitlements?.length || 0} /><Metric label="Users" value={school.users?.length || 0} /><Metric label="Subscriptions" value={school.subscriptions?.length || 0} /></section>
    <section className="card"><div className="card-heading"><div><h2>Tenant profile</h2><p>Platform-level tenant identity and contact information.</p></div></div><div className="detail-grid"><div><small>Short name</small><strong>{school.shortName || '—'}</strong></div><div><small>Contact</small><strong>{contact}</strong></div><div><small>Location</small><strong>{[school.city, school.state, school.country].filter(Boolean).join(', ') || '—'}</strong></div><div><small>Onboarding</small><StatusBadge status={school.onboarding?.status || 'PENDING'} /></div></div></section>
    <section className="card"><div className="card-heading"><div><h2>Approved programs</h2><p>Programs approved for this school during tenant setup.</p></div></div>{school.programEntitlements?.length ? <div className="badge-row">{school.programEntitlements.map((item:any) => <StatusBadge key={item.id} status={String(item.code).replaceAll('_', ' ')} />)}</div> : <EmptyState title="No approved programs" detail="This tenant has no recorded program entitlements." />}</section>
    <section className="card"><div className="card-heading"><div><h2>School administrators and users</h2><p>Tenant accounts are shown for oversight only; school RBAC remains school-scoped.</p></div></div>{school.users?.length ? <div className="table-wrap"><table><thead><tr><th>User</th><th>Roles</th><th>Status</th><th>Last sign-in</th></tr></thead><tbody>{school.users.map((user:any) => <tr key={user.id}><td><strong>{`${user.firstName || ''} ${user.lastName || ''}`.trim()}</strong><small className="block">{user.email || user.username || '—'}</small></td><td>{user.roles?.map((role:any) => role.name).join(', ') || 'No role'}</td><td><StatusBadge status={user.status} /></td><td>{date(user.lastLoginAt)}</td></tr>)}</tbody></table></div> : <EmptyState title="No school users" detail="This tenant has no user records." />}</section>
    <section className="card"><div className="card-heading"><div><h2>Subscription history</h2><p>Commercial records are managed by DAVI Platform Admins.</p></div></div>{school.subscriptions?.length ? <div className="table-wrap"><table><thead><tr><th>Plan</th><th>Frequency</th><th>Started</th><th>Current period</th><th>Status</th></tr></thead><tbody>{school.subscriptions.map((row:any) => <tr key={row.id}><td>{row.plan?.name}</td><td>{row.billingFrequency}</td><td>{date(row.startDate)}</td><td>{date(row.currentPeriodStart)} — {date(row.currentPeriodEnd)}</td><td><StatusBadge status={row.status} /></td></tr>)}</tbody></table></div> : <EmptyState title="No subscription history" detail="No subscription has been assigned to this school." />}</section>
  </>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article className="metric-card"><span className="metric-icon">•</span><div><strong>{value}</strong><p>{label}</p></div></article>; }
