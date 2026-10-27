import { Suspense } from 'react';
import { SchoolProfileWorkspace } from '../../../../components/school-profile-workspace';
import { LoadingState } from '../../../../components/ui';
export default function Page(){ return <Suspense fallback={<LoadingState label="Loading school profile?"/>}><SchoolProfileWorkspace/></Suspense>; }
