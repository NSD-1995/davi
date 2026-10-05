'use client';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { schoolApi, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth-context';
import type { CreateSchoolResult, School } from '../lib/types';
import { EmptyState, ErrorState, Field, FormActions, LoadingState, Modal, PageHeader } from './ui';

const blank = { name: '', shortName: '', address: '', city: '', state: '', country: 'India', phone: '', email: '', website: '', adminEmail: '', adminFirstName: '', adminLastName: '' };

export function PlatformDashboard() {
  const { session } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(blank);
  const [created, setCreated] = useState<CreateSchoolResult | null>(null);

  const load = async () => { if (!session) return; setLoading(true); setError(''); try { setSchools(await schoolApi.list(session.token)); } catch (e) { setError(e instanceof ApiError ? e.message : 'Schools could not be loaded.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [session?.token]);
  const visible = useMemo(() => schools.filter(school => `${school.name} ${school.shortName || ''} ${school.city || ''} ${school.email || ''}`.toLowerCase().includes(query.toLowerCase())), [schools, query]);
  const create = async (event: FormEvent) => { event.preventDefault(); if (!session || busy) return; setBusy(true); setError(''); try { const result = await schoolApi.create(session.token, form); setCreated(result); setCreating(false); setForm(blank); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'School could not be created.'); } finally { setBusy(false); } };

  return <>
    <PageHeader title={`Welcome, ${session?.user.firstName || 'Super Admin'}`} description="Create schools and manage the DAVI platform." action={<button className="button" onClick={() => { setError(''); setCreating(true); }}>+ Create school</button>} />
    <section className="metric-grid"><Metric label="Total schools" value={schools.length} /><Metric label="School users" value={schools.reduce((sum, school) => sum + (school.users?.length || 0), 0)} /><Metric label="Cities" value={new Set(schools.map(school => school.city).filter(Boolean)).size} /><Metric label="Platform status" value="Active" /></section>
    <section className="card"><div className="card-heading"><div><h2>Schools</h2><p>Every school has an isolated workspace and its own School Admin.</p></div><input className="search-input" placeholder="Search schools" value={query} onChange={event => setQuery(event.target.value)} /></div>{loading ? <LoadingState label="Loading schools…" /> : error && !creating ? <ErrorState message={error} retry={() => void load()} /> : !visible.length ? <EmptyState title="No schools created yet" detail="Create the first school to generate its administrator account." action={<button className="button" onClick={() => setCreating(true)}>Create school</button>} /> : <div className="table-wrap"><table><thead><tr><th>School</th><th>Location</th><th>Contact</th><th>Users</th><th>School login</th></tr></thead><tbody>{visible.map(school => <tr key={school.id}><td><strong>{school.name}</strong><small className="block">{school.shortName || '—'} · {school.slug}</small></td><td>{[school.city, school.state, school.country].filter(Boolean).join(', ') || '—'}</td><td>{school.email || school.phone || '—'}</td><td>{school.users?.length || 0}</td><td><a className="record-link" href={`/school/${school.slug}/login`}>Open login</a></td></tr>)}</tbody></table></div>}</section>
    {creating && <Modal title="Create a school" onClose={() => setCreating(false)} wide><form className="form-grid two" onSubmit={create}>{error && <div className="alert error span-two">{error}</div>}<Field label="School name" required><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></Field><Field label="Short name" required hint="Used to create the school login URL"><input value={form.shortName} onChange={e => setForm({ ...form, shortName: e.target.value })} required /></Field><Field label="Address"><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></Field><Field label="City"><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></Field><Field label="State"><input value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} /></Field><Field label="Country"><input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} /></Field><Field label="School phone"><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></Field><Field label="School email"><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></Field><Field label="Website"><input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} /></Field><span /><Field label="Admin first name" required><input value={form.adminFirstName} onChange={e => setForm({ ...form, adminFirstName: e.target.value })} required /></Field><Field label="Admin last name"><input value={form.adminLastName} onChange={e => setForm({ ...form, adminLastName: e.target.value })} /></Field><Field label="Admin email" required><input type="email" value={form.adminEmail} onChange={e => setForm({ ...form, adminEmail: e.target.value })} required /></Field><div className="span-two"><FormActions submitting={busy} onCancel={() => setCreating(false)} label="Create school" /></div></form></Modal>}
    {created && <Modal title="School created successfully" onClose={() => setCreated(null)}><div className="success-panel"><span className="success-icon">✓</span><p>Save these credentials now. The temporary password is shown only once.</p><div className="credential"><small>Username</small><strong>{created.credentials.username}</strong></div><div className="credential"><small>Temporary password</small><strong>{created.credentials.temporaryPassword}</strong></div><div className="credential"><small>School login</small><strong>{created.loginUrl}</strong></div><p className="muted">The School Admin must change the password during first login.</p><button className="button full" onClick={() => setCreated(null)}>I have saved the credentials</button></div></Modal>}
  </>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <article className="metric-card"><span className="metric-icon">•</span><div><strong>{value}</strong><p>{label}</p></div></article>; }
