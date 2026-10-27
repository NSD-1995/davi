import { ImageResponse } from 'next/og';
import { getPublicSchoolIdentity } from '../../lib/school-metadata';
import { safeColor } from '../../lib/school-brand';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('school');
  const school = slug ? await getPublicSchoolIdentity(slug) : null;
  const name = school?.name || (slug ? 'School Portal' : 'DAVI School Portal');
  const primary = safeColor(school?.branding?.primary, '#123f52');
  const accent = safeColor(school?.branding?.accent, '#08756c');
  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#edf4f3', padding: 36, fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', width: '100%', height: '100%', borderRadius: 28, background: '#fff', overflow: 'hidden' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 760, padding: '52px 48px' }}>
          <div style={{ display: 'flex', color: accent, fontSize: 18, fontWeight: 700, letterSpacing: 4 }}>YOUR SCHOOL. YOUR PORTAL.</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', color: '#152f40', fontSize: name.length > 45 ? 36 : name.length > 25 ? 44 : 58, fontWeight: 700, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{name.slice(0, 100)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', color: '#526674', fontSize: 25, marginTop: 24, lineHeight: 1.5 }}>
              <div style={{ display: 'flex' }}>A connected school community.</div>
              <div style={{ display: 'flex', fontSize: 22, marginTop: 8 }}>Learning, communication and school life.</div>
            </div>
          </div>
          <div style={{ display: 'flex', color: '#526674', fontSize: 18 }}>Secure school access · Powered by DAVI</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: 368, background: primary }}>
          <div style={{ display: 'flex', padding: 26, borderRadius: 28, background: '#ffffff', marginBottom: 30 }}>
            <svg width="142" height="142" viewBox="0 0 100 100" fill="none">
              <path d="M12 38L50 14L88 38" stroke={accent} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M22 39V84H78V39M12 85H88" stroke={primary} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M43 85V63H57V85M33 47H36M64 47H67M33 59H36M64 59H67" stroke={primary} strokeWidth="6" strokeLinecap="round" />
              <path d="M50 15V5H68L61 10L68 15H50" fill={accent} />
            </svg>
          </div>
          <div style={{ display: 'flex', color: '#fff', background: '#12303c', padding: '12px 18px', borderRadius: 20, fontSize: 18, letterSpacing: 3 }}>SCHOOL PORTAL</div>
        </div>
      </div>
    </div>,
    { width: 1200, height: 630, headers: { 'Cache-Control': 'no-store' } },
  );
}
