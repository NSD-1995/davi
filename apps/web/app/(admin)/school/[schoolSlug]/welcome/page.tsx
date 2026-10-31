'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CheckCircle2, RefreshCw, Sparkles } from 'lucide-react';
import { schoolApi, schoolExperienceApi } from '../../../../../lib/api';
import { useAuth } from '../../../../../lib/auth-context';
import { useRouter } from '../../../../../lib/school-navigation';
import { defaultBrand, schoolBackground, themeStyle, type SchoolBrand } from '../../../../../lib/school-brand';
import type { School } from '../../../../../lib/types';

type Step = 'profile' | 'branding' | 'permissions' | 'workspace';
const labels: Record<Step, string> = { profile: 'Loading school profile', branding: 'Applying school branding', permissions: 'Checking permissions', workspace: 'Preparing school workspace' };

export default function SchoolWelcomePage() {
  const { session } = useAuth(); const router = useRouter();
  const [school, setSchool] = useState<School | null>(null); const [brand, setBrand] = useState<SchoolBrand>(defaultBrand);
  const [steps, setSteps] = useState<Record<Step, boolean>>({ profile: false, branding: false, permissions: false, workspace: false });
  const [error, setError] = useState(''); const [ready, setReady] = useState(false); const [retry, setRetry] = useState(0); const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => { if (!session) return; let active = true; setError(''); setReady(false); setSchool(null); setSteps({ profile:false,branding:false,permissions:false,workspace:false });
    const load = async () => { try {
      const onboarding = await schoolApi.onboarding(session.token); if (!onboarding.shouldShowWelcome) { router.replace('/dashboard'); return; }
      if (!active) return; setSteps(value => ({ ...value, permissions: true }));
      const profile = await schoolApi.current(session.token); if (!active) return; setSchool(profile); setSteps(value => ({ ...value, profile: true }));
      const branding = await schoolExperienceApi.branding(session.token); if (!active) return; setBrand(branding.branding || defaultBrand); setSteps(value => ({ ...value, branding: true }));
      await schoolApi.acknowledgeWelcome(session.token); if (!active) return; setSteps(value => ({ ...value, workspace: true })); setReady(true);
    } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'We could not prepare this school workspace.'); } };
    void load(); return () => { active = false; };
  }, [retry, router, session]);
  const logo = !logoFailed && brand.logoId ? schoolExperienceApi.publicMedia(brand.logoId) : '';
  const style = useMemo(() => { const result: CSSProperties = { ...themeStyle(brand) } as CSSProperties; if (brand.workspaceBackground && brand.backgroundId) { const image = schoolBackground(brand, schoolExperienceApi.publicMedia(brand.backgroundId)); Object.assign(result, { backgroundImage:image.backgroundImage,backgroundSize:image.backgroundSize,backgroundPosition:image.backgroundPosition }); } return result; }, [brand]);
  const name = school?.name || session?.user.school?.name || 'your school'; const initials = (school?.shortName || name).split(/\s+/).map(part => part[0]).join('').slice(0,2).toUpperCase();
  return <main className="school-welcome" style={style} aria-live="polite"><section className="school-welcome-card"><div className="school-welcome-brand"><span className="school-welcome-davi">D</span><span>DAVI</span></div><div className="school-welcome-identity">{logo ? <img src={logo} alt={`${name} logo`} onError={() => setLogoFailed(true)} /> : <span aria-hidden="true">{initials}</span>}</div>{ready ? <><span className="school-welcome-kicker">SCHOOL WORKSPACE</span><h1>Welcome to DAVI</h1><h2>{name}</h2><p>We&apos;re delighted to welcome your school to DAVI.</p><p className="school-welcome-support">Together, let&apos;s make everyday school management simpler, smarter and more connected.</p><div className="school-welcome-ready"><CheckCircle2 size={20} aria-hidden="true"/> Your school workspace is ready.</div><button className="button school-welcome-continue" onClick={() => router.replace('/dashboard')}>Open school workspace</button></> : error ? <><span className="school-welcome-kicker">WORKSPACE ACTIVATION</span><h1>We need one more moment</h1><p>{error}</p><p className="school-welcome-support">Your onboarding progress is safe. No school configuration was duplicated.</p><button className="button school-welcome-continue" onClick={() => setRetry(value => value + 1)}><RefreshCw size={17} aria-hidden="true"/> Retry</button></> : <><span className="school-welcome-kicker">WORKSPACE ACTIVATION</span><h1>Welcome to DAVI</h1><h2>{name}</h2><p>We&apos;re getting your school workspace ready.</p><ul className="school-welcome-steps">{(Object.keys(labels) as Step[]).map(step => <li key={step} data-complete={steps[step] || undefined}><span>{steps[step] ? <CheckCircle2 size={17} aria-hidden="true"/> : <Sparkles size={16} aria-hidden="true"/>}</span>{labels[step]}</li>)}</ul></>}</section></main>;
}
