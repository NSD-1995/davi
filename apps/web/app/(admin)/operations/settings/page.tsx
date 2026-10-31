'use client';
import {useSearchParams} from '../../../../lib/school-navigation';
import {SchoolOperations} from '../../../../components/school-operations';
import {AutomationJobs} from '../../../../components/automation-jobs';
export default function Page(){const params=useSearchParams();return params.get('tab')==='automation'?<AutomationJobs/>:<SchoolOperations mode="settings"/>;}
