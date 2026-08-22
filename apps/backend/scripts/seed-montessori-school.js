/*
 * Creates a complete Montessori structure through the DAVI API:
 *   Play School, Nursery, LKG and UKG
 *   3 sections per class
 *   30 students per section (360 students total)
 *
 * Required environment variables: DAVI_TOKEN, ACADEMIC_YEAR_ID
 * Optional: API_BASE_URL, MONTESSORI_SEED_PREFIX
 *
 * Run: npm run seed:montessori:school
 */
const baseUrl = (process.env.API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');
const token = process.env.DAVI_TOKEN;
const academicYearId = process.env.ACADEMIC_YEAR_ID;
const seedPrefix = process.env.MONTESSORI_SEED_PREFIX || 'MONT';
const classNames = ['Play School', 'Nursery', 'LKG', 'UKG'];
const sectionNames = ['1', '2', '3'];
const studentsPerSection = 30;

if (!token) throw new Error('DAVI_TOKEN is required');
if (!academicYearId) throw new Error('ACADEMIC_YEAR_ID is required');

const firstNames = ['Aarav','Aadhya','Vihaan','Anaya','Arjun','Diya','Kabir','Ishita','Reyansh','Myra','Advik','Saanvi','Krish','Navya','Rohan'];
const lastNames = ['Sharma','Kumar','Patel','Reddy','Gupta','Singh','Nair','Iyer','Das','Jain','Rao','Mehta'];

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

async function ensureClassesAndSections() {
  const allClasses = await api('/classes');
  const result = [];
  for (const className of classNames) {
    let schoolClass = allClasses.find(item => item.academicYearId === academicYearId && item.name === className);
    if (!schoolClass) {
      schoolClass = await api('/classes', {
        method: 'POST',
        body: JSON.stringify({ academicYearId, name: className, code: className.replace(/[^A-Z]/gi, '').toUpperCase(), capacity: 90, numberOfSections: 3, sectionCapacity: 30, status: 'ACTIVE' }),
      });
      console.log(`Created ${className} with 3 sections.`);
    }
    const sections = [...(schoolClass.sections || [])];
    for (const name of sectionNames) {
      let section = sections.find(item => item.name === name);
      if (!section) {
        section = await api('/sections', { method: 'POST', body: JSON.stringify({ classId: schoolClass.id, name, capacity: 30, status: 'ACTIVE' }) });
        sections.push(section);
        console.log(`Created ${className} / Section ${name}.`);
      } else if (section.capacity !== 30 || section.status !== 'ACTIVE') {
        section = await api(`/sections/${section.id}`, { method: 'PATCH', body: JSON.stringify({ capacity: 30, status: 'ACTIVE' }) });
        const index = sections.findIndex(item => item.id === section.id);
        sections[index] = section;
      }
    }
    result.push({ ...schoolClass, sections: sections.filter(item => sectionNames.includes(item.name)) });
  }
  return result;
}

function studentPayload(schoolClass, section, classIndex, sectionIndex, roll) {
  const serial = classIndex * 90 + sectionIndex * 30 + roll;
  const number = String(serial).padStart(4, '0');
  const classCode = schoolClass.name.replace(/[^A-Z]/gi, '').toUpperCase();
  const firstName = firstNames[(serial - 1) % firstNames.length];
  const lastName = lastNames[(serial - 1) % lastNames.length];
  const gender = serial % 2 ? 'MALE' : 'FEMALE';
  return {
    student: {
      admissionNumber: `${seedPrefix}-${classCode}-S${section.name}-${String(roll).padStart(2, '0')}`,
      firstName,
      lastName,
      dateOfBirth: `${2023 - classIndex}-${String((serial % 12) + 1).padStart(2, '0')}-${String((serial % 20) + 1).padStart(2, '0')}`,
      gender,
    },
    enrollment: { academicYearId, classId: schoolClass.id, sectionId: section.id, rollNumber: String(roll) },
    parents: [{
      firstName: gender === 'MALE' ? 'Raj' : 'Priya',
      lastName,
      mobile: `9${String(200000000 + serial).slice(-9)}`,
      relationship: gender === 'MALE' ? 'FATHER' : 'MOTHER',
      isPrimary: true,
    }],
  };
}

async function main() {
  const classes = await ensureClassesAndSections();
  const results = [];
  for (let classIndex = 0; classIndex < classes.length; classIndex += 1) {
    const schoolClass = classes[classIndex];
    for (let sectionIndex = 0; sectionIndex < schoolClass.sections.length; sectionIndex += 1) {
      const section = schoolClass.sections[sectionIndex];
      for (let roll = 1; roll <= studentsPerSection; roll += 1) {
        const payload = studentPayload(schoolClass, section, classIndex, sectionIndex, roll);
        try {
          await api('/student-admissions', { method: 'POST', body: JSON.stringify(payload) });
          results.push({ class: schoolClass.name, section: section.name, admission: payload.student.admissionNumber, status: 'CREATED' });
        } catch (error) {
          results.push({ class: schoolClass.name, section: section.name, admission: payload.student.admissionNumber, status: 'FAILED', error: error.message });
        }
      }
      const created = results.filter(item => item.class === schoolClass.name && item.section === section.name && item.status === 'CREATED').length;
      console.log(`${schoolClass.name} / Section ${section.name}: ${created}/${studentsPerSection} students created.`);
    }
  }
  const failed = results.filter(item => item.status === 'FAILED');
  console.log(`Completed: ${results.length - failed.length}/${classNames.length * sectionNames.length * studentsPerSection} students created.`);
  if (failed.length) {
    console.table(failed);
    process.exitCode = 1;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
