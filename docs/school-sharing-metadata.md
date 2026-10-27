# School sharing metadata

## Installation branding

Install from `/school/<slug>/login` or the school workspace. These pages link to
`/school/<slug>/manifest.webmanifest`, which supplies the school workspace name,
a school-specific app ID and scope, and 192/512 pixel PNG icons. Icons use the
configured app icon, then uploaded school logo, then school initials. The icon
renderer preserves the complete logo on a white square. Client navigation also
updates the manifest link to retain the correct school after sign-in.

The previously installed generic DAVI app has a different app ID. Remove that
installation and install again from the school URL to get the school-specific
desktop shortcut. Browser installation/update behavior is described in the
[web app manifest guide](https://web.dev/learn/pwa/web-app-manifest).

School login URLs (`/school/<slug>/login`) generate server-rendered titles,
descriptions, canonical URLs, Open Graph tags and Twitter large-image cards from
the existing public school identity endpoint. The school name takes precedence
over DAVI branding. Only public branding is fetched; no account records are used.

`/share-image?school=<slug>` renders a 1200 × 630 PNG with that school's name and
configured colors. Missing schools use a neutral School Portal identity. Dynamic
images and school identity requests are not cached, so branding from one school
cannot be reused for another. The default generated image is stored at
`apps/web/public/images/school-share.png`. `/icon.svg` provides a school-themed
browser icon; configured school icons/logos override it on school login pages.

Set `NEXT_PUBLIC_SITE_URL` to the public HTTPS application origin and
`NEXT_PUBLIC_API_URL` to the publicly reachable API URL in production. Examples
are in `apps/web/.env.example`. The request host supplies the site origin when
no explicit site URL is set. Social crawlers must be able to reach both services.

The portal emits `noindex, nofollow` robots metadata. This controls indexing;
existing authentication and authorization continue to control record access.

The image route uses the Edge runtime to avoid the Next.js 14 Node image
renderer file-URL issue on Windows. Images are generated using Next.js
[ImageResponse and metadata APIs](https://nextjs.org/learn/dashboard-app/adding-metadata).

Validation: `node --test apps/web/test/school-metadata.test.js
apps/web/test/school-brand-pwa.test.js apps/web/test/school-routes.test.js`
and `node node_modules/typescript/bin/tsc --project apps/web/tsconfig.json
--noEmit --incremental false`.
