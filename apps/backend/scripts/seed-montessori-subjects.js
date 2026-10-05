/*
 * Creates Montessori subjects and assigns them to Play School, Nursery, LKG and UKG.
 * Safe to run repeatedly. Existing subjects and class assignments are preserved.
 *
 * Required: DAVI_TOKEN, SCHOOL_ID, ACADEMIC_YEAR_ID
 * Optional: API_BASE_URL
 *
 * Run: npm run seed:montessori:subjects
 */
const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const token = process.env.DAVI_TOKEN;
const schoolId = process.env.SCHOOL_ID;
const academicYearId = process.env.ACADEMIC_YEAR_ID;

const classNames = ['Play School', 'Nursery', 'LKG', 'UKG'];
const subjectDefinitions = [
  { name: 'Practical Life', code: 'MONT-PL', description: 'Independence, coordination, concentration and care of the environment.' },
  { name: 'Sensorial Development', code: 'MONT-SD', description: 'Learning through the senses, comparison, classification and observation.' },
  { name: 'Language', code: 'MONT-LAN', description: 'Speaking, listening, vocabulary, phonics, reading and early writing.' },
  { name: 'Mathematics', code: 'MONT-MAT', description: 'Number sense, quantities, patterns and early mathematical operations.' },
  { name: 'Cultural Studies', code: 'MONT-CUL', description: 'Nature, science, geography, history and awareness of the wider world.' },
  { name: 'Art & Craft', code: 'MONT-ART', description: 'Creative expression through drawing, painting, modelling and craft.' },
  { name: 'Music & Movement', code: 'MONT-MUS', description: 'Rhythm, singing, movement, coordination and physical expression.' },
];

for (const [key, value] of Object.entries({ DAVI_TOKEN: token, SCHOOL_ID: schoolId, ACADEMIC_YEAR_ID: academicYearId })) {
  if (!value) throw new Error(`${key} is required`);
}

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

async function ensureSubjects() {
  const existing = await api('/subjects');
  const subjects = [];
  for (const definition of subjectDefinitions) {
    let subject = existing.find(item => item.code.toUpperCase() === definition.code);
    const payload = { ...definition, type: 'CORE', status: 'ACTIVE' };
    if (subject) {
      subject = await api(`/subjects/${subject.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
      console.log(`Updated subject: ${subject.name} (${subject.code}).`);
    } else {
      subject = await api('/subjects', { method: 'POST', body: JSON.stringify({ schoolId, ...payload }) });
      existing.push(subject);
      console.log(`Created subject: ${subject.name} (${subject.code}).`);
    }
    subjects.push(subject);
  }
  return subjects;
}

async function assignSubjects(subjects) {
  const classes = await api('/classes');
  const targetClasses = classNames.map(name => {
    const schoolClass = classes.find(item => item.academicYearId === academicYearId && item.name === name);
    if (!schoolClass) throw new Error(`${name} was not found in academic year ${academicYearId}. Run seed:montessori:school first.`);
    return schoolClass;
  });

  for (const schoolClass of targetClasses) {
    const current = await api(`/academic-years/${academicYearId}/classes/${schoolClass.id}/subjects`);
    const subjectIds = [...new Set([...(current.subjects || []).map(subject => subject.id), ...subjects.map(subject => subject.id)])];
    await api(`/academic-years/${academicYearId}/classes/${schoolClass.id}/subjects`, {
      method: 'PUT',
      body: JSON.stringify({ subjectIds }),
    });
    console.log(`Assigned ${subjects.length} Montessori subjects to ${schoolClass.name}.`);
  }
}

async function main() {
  const subjects = await ensureSubjects();
  await assignSubjects(subjects);
  console.log(`Completed: ${subjects.length} subjects assigned across all ${classNames.length} Montessori classes.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
