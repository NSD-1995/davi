/*
 * Creates 30 Montessori teaching staff accounts through the DAVI API.
 * The script automatically discovers an active school role whose code contains
 * "TEACHER", so no role ID needs to be copied from the frontend.
 *
 * Required: DAVI_TOKEN, SCHOOL_ID
 * Optional: API_BASE_URL, STAFF_COUNT, STAFF_SEED_START, STAFF_SEED_PREFIX
 *
 * Run: npm run seed:montessori:staff
 */
const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const token = process.env.DAVI_TOKEN;
const schoolId = process.env.SCHOOL_ID;
const count = Number(process.env.STAFF_COUNT || 30);
const start = Number(process.env.STAFF_SEED_START || 1);
const prefix = process.env.STAFF_SEED_PREFIX || 'MONT-T';

for (const [key, value] of Object.entries({ DAVI_TOKEN: token, SCHOOL_ID: schoolId })) {
  if (!value) throw new Error(`${key} is required`);
}
if (!Number.isInteger(count) || count < 1) throw new Error('STAFF_COUNT must be a positive whole number');
if (!Number.isInteger(start) || start < 1) throw new Error('STAFF_SEED_START must be a positive whole number');

const firstNames = ['Ananya','Arun','Deepa','Karthik','Lakshmi','Manoj','Meena','Naveen','Priya','Rajesh','Revathi','Saranya','Senthil','Suresh','Vidhya'];
const lastNames = ['Kumar','Rajan','Devi','Krishnan','Murali','Nair','Ravi','Sharma','Singh','Subramanian'];

async function api(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body ? body.message : response.statusText;
    throw new Error(Array.isArray(message) ? message.join(', ') : String(message));
  }
  return body;
}

function staffPayload(index, roleId) {
  const number = String(index).padStart(3, '0');
  return {
    firstName: firstNames[(index - 1) % firstNames.length],
    lastName: lastNames[(index - 1) % lastNames.length],
    mobile: `8${String(300000000 + index).slice(-9)}`,
    email: `montessori.teacher.${number}@davi.test`,
    employeeId: `${prefix}-${number}`,
    joiningDate: '2026-06-01',
    roleId,
    status: 'ACTIVE',
  };
}

async function main() {
  const roles = await api(`/schools/${schoolId}/roles`);
  const teacherRole = roles.find(role => role.isActive && role.code.toUpperCase().includes('TEACHER'));
  if (!teacherRole) throw new Error('No active teacher role was found for this school. Create a role with TEACHER in its code first.');
  console.log(`Using teacher role: ${teacherRole.name} (${teacherRole.code}).`);
  const results = [];
  for (let index = start; index < start + count; index += 1) {
    const payload = staffPayload(index, teacherRole.id);
    try {
      const result = await api(`/schools/${schoolId}/staff`, { method: 'POST', body: JSON.stringify(payload) });
      results.push({ employeeId: payload.employeeId, name: `${payload.firstName} ${payload.lastName}`, username: result.credentials?.username, temporaryPassword: result.credentials?.temporaryPassword, status: 'CREATED' });
    } catch (error) {
      results.push({ employeeId: payload.employeeId, name: `${payload.firstName} ${payload.lastName}`, status: 'FAILED', error: error.message });
    }
  }
  console.table(results);
  const failed = results.filter(item => item.status === 'FAILED');
  console.log(`Created ${results.length - failed.length}/${results.length} Montessori teaching staff accounts.`);
  console.log('Save the displayed temporary passwords securely; they are returned only once.');
  if (failed.length) process.exitCode = 1;
}

main().catch(error => { console.error(error); process.exitCode = 1; });
