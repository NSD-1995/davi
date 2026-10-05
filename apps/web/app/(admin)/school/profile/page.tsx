'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, schoolApi, schoolSettingsApi } from '../../../../lib/api';
import { useAuth } from '../../../../lib/auth-context';
import { useToast } from '../../../../lib/toast-context';
import type { School } from '../../../../lib/types';
import { ErrorState, Field, LoadingState, PageHeader } from '../../../../components/ui';

const blank: Partial<School> = { name: '', address: '', city: '', state: '', country: '', phone: '', email: '', website: '' };
export default function ProfilePage() {
  const { session, can, refresh } = useAuth(); const { show } = useToast();
  const [school, setSchool] = useState<School | null>(null); const [form, setForm] = useState(blank); const [logoUrl, setLogoUrl] = useState('');
  const [editing, setEditing] = useState(false); const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const load = async () => { if (!session) return; setLoading(true); setError(''); try { const row = await schoolApi.current(session.token); setSchool(row); setForm({ ...blank, ...row }); if (session.user.schoolId) { try { const settings = await schoolSettingsApi.get(session.token, session.user.schoolId); setLogoUrl(String(settings.logoUrl || '')); } catch { setLogoUrl(''); } } } catch (e) { setError(e instanceof ApiError ? e.message : 'School profile could not be loaded.'); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, [session?.token]);
  const save = async (event: FormEvent) => { event.preventDefault(); if (!session || !form.name?.trim()) return; setBusy(true); try { const row = await schoolApi.updateCurrent(session.token, form); setSchool(row); setForm({ ...blank, ...row }); await refresh(); show('School profile updated.'); setEditing(false); } catch (e) { show(e instanceof ApiError ? e.message : 'School profile could not be updated.', 'error'); } finally { setBusy(false); } };
  if (loading) return <LoadingState label="Loading school profile…" />;
  if (error) return <ErrorState message={error} retry={() => void load()} />;
  const writable = can('SCHOOL_PROFILE_UPDATE');
  return <><PageHeader title="School profile" description={writable ? 'Manage your school identity and contact information.' : 'School identity and contact information (read only).'} action={writable && <button className="button" onClick={() => setEditing(value => !value)}>{editing ? 'Cancel editing' : 'Edit profile'}</button>} />
    <section className="card profile-card"><div className="profile-banner">{logoUrl ? <img className="school-logo large" src={logoUrl} alt={`${school?.name || 'School'} logo`} /> : <div className="school-logo large">{(school?.shortName || school?.name || 'S').slice(0, 2).toUpperCase()}</div>}<div><h2>{school?.name}</h2><p>{school?.shortName || 'School profile'}</p></div></div>
      <form className="form-grid two" onSubmit={save}>{(['name','address','city','state','country','phone','email','website'] as const).map(key => <Field key={key} label={({name:'School name',address:'Address',city:'City',state:'State',country:'Country',phone:'Phone',email:'Email',website:'Website'})[key]} required={key === 'name'}><input disabled={!editing} required={key === 'name'} type={key === 'email' ? 'email' : key === 'website' ? 'url' : key === 'phone' ? 'tel' : 'text'} value={String(form[key] || '')} onChange={event => setForm(value => ({ ...value, [key]: event.target.value }))} /></Field>)}
        <Field label="Timezone" hint="Managed in School Settings"><input disabled value="See School Settings" /></Field><Field label="Logo" hint="Managed by URL in School Settings"><input disabled value={logoUrl || 'Not configured'} /></Field>
        {editing && <div className="form-actions span-two"><button type="button" className="button secondary" onClick={() => { setForm({ ...blank, ...school }); setEditing(false); }}>Cancel</button><button className="button" disabled={busy || !form.name?.trim()}>{busy ? 'Saving…' : 'Save changes'}</button></div>}
      </form></section></>;
}
