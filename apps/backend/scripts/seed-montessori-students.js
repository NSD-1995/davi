/*
 * Creates Montessori student admissions through the DAVI API.
 * Required environment variables:
 * DAVI_TOKEN, ACADEMIC_YEAR_ID, CLASS_ID
 * Optional: SECTION_ID (assign directly to a section), API_BASE_URL,
 * STUDENT_COUNT, SEED_START, SEED_PREFIX
 */
const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001/api/v1';
const token = process.env.DAVI_TOKEN;
const academicYearId = process.env.ACADEMIC_YEAR_ID;
const classId = process.env.CLASS_ID;
const sectionId = process.env.SECTION_ID?.trim() || undefined;
const count = Number(process.env.STUDENT_COUNT || 30);
const start = Number(process.env.SEED_START || 1);
const prefix = process.env.SEED_PREFIX || 'MONT-2026';

for (const [key, value] of Object.entries({ DAVI_TOKEN: token, ACADEMIC_YEAR_ID: academicYearId, CLASS_ID: classId })) {
  if (!value) throw new Error(`${key} is required`);
}
if (!Number.isInteger(count) || count < 1) throw new Error('STUDENT_COUNT must be a positive whole number');
if (!Number.isInteger(start) || start < 1) throw new Error('SEED_START must be a positive whole number');

const firstNames = ['Aarav', 'Aadhya', 'Vihaan', 'Anaya', 'Arjun', 'Diya', 'Kabir', 'Ishita', 'Reyansh', 'Myra'];
const lastNames = ['Sharma', 'Kumar', 'Patel', 'Reddy', 'Gupta', 'Singh', 'Nair', 'Iyer', 'Das', 'Jain'];

async function admit(index) {
  const number = String(index).padStart(3, '0');
  const firstName = firstNames[(index - 1) % firstNames.length];
  const lastName = lastNames[(index - 1) % lastNames.length];
  const isMale = index % 2 === 1;
  const payload = {
    student: {
      admissionNumber: `${prefix}-${number}`,
      firstName,
      lastName,
      dateOfBirth: `${2021 + (index % 2)}-${String((index % 12) + 1).padStart(2, '0')}-10`,
      gender: isMale ? 'MALE' : 'FEMALE',
    },
    enrollment: { academicYearId, classId, ...(sectionId ? { sectionId } : {}), rollNumber: String(index) },
    parents: [{
      firstName: `${isMale ? 'Mr' : 'Ms'} ${lastName}`,
      lastName,
      mobile: `9${String(100000000 + index).slice(-9)}`,
      relationship: isMale ? 'FATHER' : 'MOTHER',
      isPrimary: true,
    }],
  };
  const response = await fetch(`${baseUrl}/student-admissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${payload.student.admissionNumber}: ${body.message || response.statusText}`);
  return payload.student.admissionNumber;
}

(async () => {
  const results = [];
  for (let index = start; index < start + count; index += 1) {
    try { results.push({ admissionNumber: await admit(index), ok: true }); }
    catch (error) { results.push({ error: error.message, ok: false }); }
  }
  const failed = results.filter(result => !result.ok);
  console.table(results);
  console.log(`Created ${results.length - failed.length}/${results.length} Montessori admissions ${sectionId ? 'in the selected section.' : 'in the class allocation pool (unassigned).'}`);
  if (failed.length) process.exitCode = 1;
})();
