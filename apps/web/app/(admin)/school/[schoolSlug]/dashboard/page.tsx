'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardPage from '../../../dashboard/page';
import { dashboardPathFor, useAuth } from '../../../../../lib/auth-context';
import { LoadingState } from '../../../../../components/ui';

export default function SchoolDashboardPage() {
  const { session, loading } = useAuth();
  const params = useParams<{ schoolSlug: string }>();
  const router = useRouter();
  const expectedPath = dashboardPathFor(session);

  useEffect(() => {
    if (!loading && session?.user.school?.slug && params.schoolSlug !== session.user.school.slug) router.replace(expectedPath);
  }, [expectedPath, loading, params.schoolSlug, router, session]);

  if (loading || (session?.user.school?.slug && params.schoolSlug !== session.user.school.slug)) return <LoadingState label="Opening your school dashboard…" />;
  return <DashboardPage />;
}
