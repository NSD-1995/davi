import { ImageResponse } from 'next/og';
import { getPublicSchoolIdentity } from '../../../../lib/school-metadata';
import { safeColor } from '../../../../lib/school-brand';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: { schoolSlug: string } }) {
  const school = await getPublicSchoolIdentity(params.schoolSlug);
  if (!school) return new Response('School unavailable', { status: 404 });
  const size = new URL(request.url).searchParams.get('size') === '192' ? 192 : 512;
  const id = school.branding?.iconId || school.branding?.logoId;
  let logo: string | undefined;
  if (id) {
    try {
      const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
      const response = await fetch(`${api}/school-experience/public-media/${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) });
      const mime = response.headers.get('content-type')?.split(';')[0];
      if (response.ok && ['image/png', 'image/jpeg', 'image/webp'].includes(mime || '')) {
        const data = new Uint8Array(await response.arrayBuffer());
        if (data.length <= 5 * 1024 * 1024) {
          let binary = '';
          for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
          logo = `data:${mime};base64,${btoa(binary)}`;
        }
      }
    } catch { /* School initials remain available if a logo cannot be loaded. */ }
  }
  const primary = safeColor(school.branding?.primary, '#123f52');
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: logo ? '#fff' : primary, color: '#fff', padding: size * .1, fontFamily: 'sans-serif', fontWeight: 700, fontSize: size * .34 }}>
      {logo ? <img src={logo} width={size * .8} height={size * .8} style={{ objectFit: 'contain' }} /> : (school.shortName || school.name).slice(0, 2).toUpperCase()}
    </div>,
    { width: size, height: size, headers: { 'Cache-Control': 'no-store' } },
  );
}
