# School file access

Private school media requires a valid bearer session. Its database lookup uses
the school ID loaded from the authenticated account, never a client-provided
school ID. Accounts without school membership are denied. Another school's
asset IDs return 404 before storage access. Private staff photos additionally
require ownership or STAFF_VIEW permission within the same school.

Admission documents, student migration source files, report downloads and
syllabus operations use school-scoped record lookups before file access. Report
download tickets are also tied to the requesting user and expiry. Local media
and document storage are outside the web public directory; do not expose
private-media or private-uploads through a reverse proxy or static hosting.

Approved exception: login logos/backgrounds and installed-app icons remain
public. Anyone, including a member of another school, can view published
branding without signing in. The public media route accepts only active PUBLIC
school branding categories and requires a matching currently published branding
slot. Unpublished uploads, replaced assets, and private photos are excluded.

Validation: build the backend, then run
`node --test apps/backend/test/school-file-isolation.test.js` from the repo root.
Tests cover database scoping, denied storage reads, private photo permissions,
public branding restrictions, document scoping, and real HTTP authentication and
cross-school access using synthetic accounts. These tests do not require a
production database or user credentials.
