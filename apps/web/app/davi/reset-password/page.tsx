'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';
import { ApiError, authApi } from '../../../lib/api';

export default function PlatformResetPasswordPage() { return <Suspense fallback={<main className="login-page"><section className="login-card">Loading secure reset…</section></main>}><PlatformResetPasswordForm /></Suspense>; }

function PlatformResetPasswordForm() {
  const params = useSearchParams(); const resetToken = params.get('token') || ''; const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [done, setDone] = useState(false); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!resetToken) { setError('This password reset link is invalid.'); return; } if (password.length < 12) { setError('Use at least 12 characters.'); return; } if (password !== confirm) { setError('Passwords do not match.'); return; } setBusy(true); setError(''); try { await authApi.completePlatformReset(resetToken, password); setDone(true); } catch (e) { setError(e instanceof ApiError ? e.message : 'Password reset could not be completed.'); } finally { setBusy(false); } };
  return <main className="login-page"><section className="login-card"><span className="eyebrow">DAVI PLATFORM</span><h1>Set a new password</h1>{done ? <><p>Your DAVI password has been updated.</p><Link className="button full" href="/davi/login">Go to DAVI sign in</Link></> : <form className="form-grid" onSubmit={submit}>{error && <div className="alert error">{error}</div>}<label className="field"><span>New password</span><input required type="password" autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /></label><label className="field"><span>Confirm password</span><input required type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} /></label><small className="muted">Use at least 12 characters. This link is valid once for 30 minutes.</small><button className="button full" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button></form>}</section></main>;
}
