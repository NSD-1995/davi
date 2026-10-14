/*
 * Creates Montessori subjects and assigns them to Play School, Nursery, LKG and UKG.
 * Safe to run repeatedly. Replaces subject assignments for the four target classes.
 * Existing subject master records are preserved.
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
  { name: 'English', code: 'MONT-ENG', description: 'Listening, speaking, vocabulary, phonics, reading and early writing in English.' },
  { name: 'Mathematics', code: 'MONT-MAT', description: 'Number sense, quantities, patterns and early mathematical operations.' },
  { name: 'Environmental Studies', code: 'MONT-EVS', description: 'Plants, animals, nature, surroundings and care for the environment.' },
  { name: 'General Awareness', code: 'MONT-GA', description: 'Everyday knowledge, community, safety and awareness of the wider world.' },
  { name: 'Practical Life', code: 'MONT-PL', description: 'Independence, coordination, concentration and care of the environment.' },
  { name: 'Sensorial Development', code: 'MONT-SD', description: 'Learning through the senses, comparison, classification and observation.' },
  { name: 'Rhymes & Music', code: 'MONT-RM', description: 'Rhymes, singing, rhythm, listening and musical expression.' },
  { name: 'Art & Craft', code: 'MONT-ART', description: 'Creative expression through drawing, painting, modelling and craft.' },
  { name: 'Story & Conversation', code: 'MONT-SC', description: 'Storytelling, comprehension, conversation and confident communication.' },
  { name: 'Physical Education', code: 'MONT-PE', description: 'Physical activity, movement, balance, coordination and healthy habits.' },
  { name: 'Tamil / Second Language', code: 'MONT-TSL', description: 'Listening, speaking, vocabulary and early literacy in Tamil or a second language.' },
  { name: 'Computer Basics', code: 'MONT-CB', description: 'Introduction to computers, basic operation and age-appropriate digital awareness.' },
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
    let subject = existing.find(item => item.code.toUpperCase() === definition.code)
      || existing.find(item => item.name.trim().toLowerCase() === definition.name.toLowerCase());
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
    const subjectIds = subjects.map(subject => subject.id);
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
