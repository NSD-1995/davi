import {defaultRules, Rules, SLOT_TYPES} from './constraint-engine';

// Generation follows the active template. Legacy advanced settings are retained
// in storage, but do not restrict template-based generation or publication.
export function templateGenerationRules(): Rules {
  return {
    ...defaultRules,
    allocationMode: 'AUTO',
    classTeacherRequired: false,
    classTeacherFirstPeriodPriority: 'DISABLED',
    classTeacherDailyPresencePriority: 'DISABLED',
    maxTeacherPeriodsPerDay: Number.MAX_SAFE_INTEGER,
    maxTeacherPeriodsPerWeek: Number.MAX_SAFE_INTEGER,
    teacherConsecutivePriority: 'DISABLED',
    teacherFreePeriodPriority: 'DISABLED',
    minimumTeacherFreePeriodsPerDay: 0,
    slotRequiresTeacher: Object.fromEntries(SLOT_TYPES.map(type => [type, type === 'SUBJECT'])),
  };
}
