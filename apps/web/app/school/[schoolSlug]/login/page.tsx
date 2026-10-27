import LoginPage from '../../../login/page';
import { getPublicSchoolIdentity, schoolMetadata, siteOrigin } from '../../../../lib/school-metadata';

export async function generateMetadata({ params }: { params: { schoolSlug: string } }) {
  return schoolMetadata(siteOrigin(), await getPublicSchoolIdentity(params.schoolSlug), params.schoolSlug);
}

export default LoginPage;
