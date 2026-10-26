import { Suspense } from 'react';
import { AnalyticsWorkspace } from '../../../../components/analytics-workspace';
import { WorkspaceLoading } from '../../../../components/workspace-loading';
export default function Page(){return <Suspense fallback={<WorkspaceLoading/>}><AnalyticsWorkspace/></Suspense>;}
