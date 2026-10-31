import { NextResponse, type NextRequest } from 'next/server';
import { isWorkspacePath, schoolRoute } from './lib/school-routes';
export function middleware(request: NextRequest) {
 const route = schoolRoute(request.nextUrl.pathname);
 // These are tenant-specific route files; rewriting them to root paths would produce a 404.
 if (!route.slug || ['/login','/onboarding','/welcome'].includes(route.path) || !isWorkspacePath(route.path)) return NextResponse.next();
 const url = request.nextUrl.clone(); url.pathname = route.path;
 const requestHeaders = new Headers(request.headers);
 requestHeaders.set('x-davi-school-slug', route.slug);
 return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}
export const config = { matcher: ['/school/:slug/:path*'] };
