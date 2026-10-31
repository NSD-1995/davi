'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from '../../../../../lib/school-navigation';
import DashboardPage from '../../../dashboard/page';
import { dashboardPathFor, useAuth } from '../../../../../lib/auth-context';
import { LoadingState } from '../../../../../components/ui';
import { schoolApi } from '../../../../../lib/api';

export default function SchoolDashboardPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ schoolSlug: string }>();
  const router = useRouter();
  const expectedPath = dashboardPathFor(session);
  const [checkingWelcome, setCheckingWelcome] = useState(true);
  const [onboardingSkipped, setOnboardingSkipped] = useState(false);

  useEffect(() => {
    if (!loading && session?.user.school?.slug && params.schoolSlug !== session.user.school.slug) router.replace(expectedPath);
  }, [expectedPath, loading, params.schoolSlug, router, session]);

  useEffect(() => {
    let active = true;
    const isSchoolAdmin = Boolean(session?.roles.some(role => role.code.toUpperCase() === 'SCHOOL_ADMIN'));
    if (loading || !session || !isSchoolAdmin) { setCheckingWelcome(false); return; }
    setCheckingWelcome(true);
    schoolApi.onboarding(session.token).then(state => {
      if (!active) return;
      if (state.status === 'PENDING') router.replace('/onboarding');
      else if (state.shouldShowWelcome) router.replace('/welcome');
      else { setOnboardingSkipped(state.status === 'SKIPPED'); setCheckingWelcome(false); }
    }).catch(() => { if (active) setCheckingWelcome(false); });
    return () => { active = false; };
  }, [loading, router, session]);

  if (loading || checkingWelcome || (session?.user.school?.slug && params.schoolSlug !== session.user.school.slug)) return <LoadingState label="Preparing your school workspace…" />;
  return <>{onboardingSkipped&&<section className="onboarding-resume" role="status"><div><strong>Finish setting up your school</strong><span>Some optional school configuration is still incomplete.</span></div><button className="button secondary" onClick={async()=>{if(!session)return;await schoolApi.resumeOnboarding(session.token);router.replace('/onboarding');}}>Resume setup</button></section>}<DashboardPage /></>;
}
