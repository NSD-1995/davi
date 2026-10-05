/*
 * Creates the Montessori teacher role and assigns its permissions through the DAVI API.
 * Safe to run repeatedly: an existing role is updated instead of duplicated.
 *
 * Required: DAVI_TOKEN, SCHOOL_ID
 * Optional: API_BASE_URL, MONTESSORI_ROLE_NAME, MONTESSORI_ROLE_CODE,
 *           MONTESSORI_ROLE_DESCRIPTION, MONTESSORI_ROLE_PERMISSIONS
 *
 * Run: npm run seed:montessori:roles
 */
const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const token = process.env.DAVI_TOKEN;
const schoolId = process.env.SCHOOL_ID;
const roleName = process.env.MONTESSORI_ROLE_NAME || 'Montessori Teacher';
const roleCode = (process.env.MONTESSORI_ROLE_CODE || 'MONTESSORI_TEACHER').trim().toUpperCase();
const roleDescription = process.env.MONTESSORI_ROLE_DESCRIPTION || 'Teaching staff for Montessori classes';

const defaultPermissionCodes = [
  'DASHBOARD_VIEW',
  'ACADEMIC_YEAR_VIEW',
  'CLASS_VIEW',
  'SECTION_VIEW',
  'SUBJECT_VIEW',
  'CLASS_SUBJECT_VIEW',
  'TEACHING_TEAM_VIEW',
  'SUBJECT_TEACHER_VIEW',
  'CLASS_ATTENDANCE_MANAGE',
  'CLASS_OBSERVATION_MANAGE',
  'SUBJECT_HOMEWORK_MANAGE',
  'SUBJECT_MARKS_MANAGE',
  'STUDENT_VIEW',
  'TIMETABLE_VIEW',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_MARK',
  'EXAM_VIEW',
  'MARKS_VIEW',
  'MARKS_UPDATE',
  'EVENT_VIEW',
  'NOTIFICATION_VIEW',
  'HOMEWORK_VIEW',
  'HOMEWORK_MANAGE',
  'LESSON_PLAN_VIEW',
  'LESSON_PLAN_MANAGE',
  'COMMUNICATION_VIEW',
  'COMMUNICATION_MANAGE',
];

const requestedPermissionCodes = process.env.MONTESSORI_ROLE_PERMISSIONS
  ? process.env.MONTESSORI_ROLE_PERMISSIONS.split(',').map(code => code.trim().toUpperCase()).filter(Boolean)
  : defaultPermissionCodes;

for (const [key, value] of Object.entries({ DAVI_TOKEN: token, SCHOOL_ID: schoolId })) {
  if (!value) throw new Error(`${key} is required`);
}
if (!roleName.trim()) throw new Error('MONTESSORI_ROLE_NAME cannot be empty');
if (!roleCode) throw new Error('MONTESSORI_ROLE_CODE cannot be empty');

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : response.statusText;
    throw new Error(`${options.method || 'GET'} ${path}: ${Array.isArray(message) ? message.join(', ') : message}`);
  }
  return body;
}

async function main() {
  const roles = await api(`/schools/${schoolId}/roles`);
  let role = roles.find(item => item.code.toUpperCase() === roleCode);

  const rolePayload = { name: roleName.trim(), code: roleCode, description: roleDescription, isActive: true };
  if (role) {
    role = await api(`/schools/${schoolId}/roles/${role.id}`, {
      method: 'PATCH',
      body: JSON.stringify(rolePayload),
    });
    console.log(`Updated role: ${role.name} (${role.code}).`);
  } else {
    const { isActive, ...createPayload } = rolePayload;
    role = await api(`/schools/${schoolId}/roles`, {
      method: 'POST',
      body: JSON.stringify(createPayload),
    });
    console.log(`Created role: ${role.name} (${role.code}).`);
  }

  const permissionGroups = await api('/permissions');
  const permissions = permissionGroups.flatMap(group => group.permissions || []);
  const permissionByCode = new Map(permissions.map(permission => [permission.code.toUpperCase(), permission]));
  const missingCodes = requestedPermissionCodes.filter(code => !permissionByCode.has(code));
  if (missingCodes.length) throw new Error(`Permissions not found: ${missingCodes.join(', ')}`);

  const permissionIds = [...new Set(requestedPermissionCodes.map(code => permissionByCode.get(code).id))];
  await api(`/schools/${schoolId}/roles/${role.id}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionIds }),
  });

  console.log(`Assigned ${permissionIds.length} permissions to ${role.name}.`);
  console.log('The Montessori staff seed can now discover this role automatically.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
