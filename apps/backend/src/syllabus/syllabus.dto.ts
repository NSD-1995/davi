import { z } from 'zod';
export const syllabusScopeSchema=z.object({schoolId:z.string().uuid(),academicYearId:z.string().uuid(),classId:z.string().uuid(),subjectId:z.string().uuid(),termId:z.string().uuid()}).strict();
export const lessonListSchema=z.array(z.object({title:z.string().trim().min(1).max(200),topics:z.array(z.string().trim().min(1).max(200)).min(1).max(100)}).strict()).min(1).max(100);
export class UploadSyllabusDto {schoolId!:string;academicYearId!:string;classId!:string;subjectId!:string;termId!:string;replacesSyllabusId?:string;}
export class ReviewSyllabusDto {lessons!:{title:string;topics:string[]}[];}
