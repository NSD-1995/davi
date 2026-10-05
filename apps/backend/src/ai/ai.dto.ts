import { z } from 'zod';

export const lessonRequestSchema = z.object({
  schoolId: z.string().uuid(), academicYearId: z.string().uuid(), classId: z.string().uuid(),
  subjectId: z.string().uuid(), topic: z.string().trim().min(1).max(200),
  syllabusTopicId: z.string().uuid().optional(), durationMinutes: z.number().int().min(10).max(180),
  language: z.string().trim().min(2).max(50),
}).strict();
export type LessonRequest = z.infer<typeof lessonRequestSchema>;
export class GenerateLessonPlanDto implements LessonRequest {
  schoolId!: string; academicYearId!: string; classId!: string; subjectId!: string;
  topic!: string; syllabusTopicId?: string; durationMinutes!: number; language!: string;
}
export const lessonPlanSchema = z.object({
  objectives: z.array(z.string().min(1)).min(1), materials: z.array(z.string().min(1)),
  introduction: z.string().min(1), teachingSteps: z.array(z.string().min(1)).min(1),
  activities: z.array(z.string().min(1)).min(1), assessment: z.string().min(1),
  homework: z.string().min(1), differentiation: z.string().min(1), safetyNotes: z.string().min(1),
}).strict();
