import { notFound, redirect } from 'next/navigation';
import { AdmissionsWorkspace, type AdmissionsView } from '../../../../components/admissions-workspace';
export default function Page({params}:{params:{view:string}}){if(["decisions","joining"].includes(params.view))redirect("/admissions/applications");if(!["dashboard","enquiries","follow-ups","applications","decisions","joining","settings"].includes(params.view))notFound();return <AdmissionsWorkspace view={params.view as AdmissionsView}/>;}
