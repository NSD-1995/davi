import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AcademicScopeService } from './academic-scope.service';
import { AiProviderService } from './ai-provider.service';
import { lessonRequestSchema } from './ai.dto';

@Injectable()
export class AiService {
  constructor(private readonly prisma:PrismaService,private readonly scope:AcademicScopeService,private readonly provider:AiProviderService) {}
  async generate(user:any, value:unknown) {
    const parsed=lessonRequestSchema.safeParse(value);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const input=parsed.data;
    const names=await this.scope.assert(user,input);
    if (input.syllabusTopicId) {
      const topic=await this.prisma.syllabusTopic.findFirst({where:{id:input.syllabusTopicId,schoolId:input.schoolId,academicYearId:input.academicYearId,classId:input.classId,subjectId:input.subjectId}});
      const syllabus=topic&&await this.prisma.syllabus.findFirst({where:{id:topic.syllabusId,schoolId:input.schoolId,status:'APPROVED'}});
      if (!topic || !syllabus || topic.title!==input.topic) throw new BadRequestException('Approved syllabus topic does not match this request.');
    }
    const generated=await this.provider.lessonPlan(input,{className:names.schoolClass.name,subjectName:names.subject.name});
    return this.prisma.aiGeneration.create({data:{schoolId:input.schoolId,userId:user.id,feature:'LESSON_PLAN',model:generated.model,promptVersion:generated.promptVersion,input,output:generated.output,status:'DRAFT',inputTokens:generated.inputTokens,outputTokens:generated.outputTokens}});
  }
}
