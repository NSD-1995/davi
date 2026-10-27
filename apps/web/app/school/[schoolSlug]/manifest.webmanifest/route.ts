import { getPublicSchoolIdentity } from '../../../../lib/school-metadata';
import { schoolManifest } from '../../../../lib/school-manifest';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: { schoolSlug: string } }) {
  const school = await getPublicSchoolIdentity(params.schoolSlug);
  if (!school) return new Response('School unavailable', { status: 404 });
  return Response.json(schoolManifest(school), { headers: {
    'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store',
  } });
}
