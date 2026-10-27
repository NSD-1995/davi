import type { ReactNode } from 'react';
import { getPublicSchoolIdentity, schoolMetadata, siteOrigin } from '../../../../lib/school-metadata';

export async function generateMetadata({ params }: { params: { schoolSlug: string } }) {
  const school = await getPublicSchoolIdentity(params.schoolSlug);
  return {
    ...schoolMetadata(siteOrigin(), school, params.schoolSlug),
    title: school ? `${school.name} School Workspace` : 'School Workspace',
  };
}

export default function SchoolWorkspaceLayout({ children }: { children: ReactNode }) { return children; }
