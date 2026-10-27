'use client';
import NextLink from 'next/link';
import { usePathname as useRawPathname, useRouter as useRawRouter } from 'next/navigation';
import { useMemo, type ComponentProps } from 'react';
import { schoolRoute, scopedHref } from './school-routes';
export * from 'next/navigation';
/** Existing route checks operate on the canonical module path. */
export function usePathname() { return schoolRoute(useRawPathname()).path; }
export function useRouter() {
 const router = useRawRouter(); const slug = schoolRoute(useRawPathname()).slug;
 return useMemo(() => ({ ...router,
  push: (href: string, options?: Parameters<typeof router.push>[1]) => router.push(scopedHref(href, slug), options),
  replace: (href: string, options?: Parameters<typeof router.replace>[1]) => router.replace(scopedHref(href, slug), options),
  prefetch: (href: string, options?: Parameters<typeof router.prefetch>[1]) => router.prefetch(scopedHref(href, slug), options),
 }), [router, slug]);
}
export default function SchoolLink({ href, ...props }: ComponentProps<typeof NextLink>) {
 const slug = schoolRoute(useRawPathname()).slug;
 const next = typeof href === 'string' ? scopedHref(href, slug) : { ...href, pathname: href.pathname ? scopedHref(href.pathname, slug) : href.pathname };
 return <NextLink {...props} href={next}/>;
}
