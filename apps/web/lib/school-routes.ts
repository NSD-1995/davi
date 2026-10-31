/** School URLs use the existing unique slug, not a mutable display label. */
const roots = ['dashboard','academics','admissions','students','people','operations','my-day','reports','access','school','parent','change-password','forbidden','welcome','onboarding'];
export function schoolRoute(path: string) {
 const match = /^\/school\/([^/]+)(\/.*)?$/.exec(path);
 // /school/profile and /school/settings are legacy unprefixed pages.
 if (!match || !match[2]) return { slug: null, path };
 return { slug: match[1], path: match[2] };
}
export function scopedHref(href: string, slug: string | null) {
 if (!slug || !href.startsWith('/') || href.startsWith('//')) return href;
 if (schoolRoute(href.split(/[?#]/)[0]).slug) return href;
 const root = href.slice(1).split(/[/?#]/)[0];
 return roots.includes(root) ? `/school/${encodeURIComponent(slug) === slug ? slug : encodeURIComponent(slug)}${href}` : href;
}
export function isWorkspacePath(path: string) { return roots.includes(path.slice(1).split('/')[0]); }
