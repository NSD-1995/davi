import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { StudentMigrationService, migrationError } from './student-migration.service';
@Injectable()
export class StudentMigrationWorker implements OnModuleInit,OnModuleDestroy {
 private timer?:ReturnType<typeof setInterval>;private running=false;private readonly log=new Logger(StudentMigrationWorker.name);
 constructor(private readonly db:PrismaService,private readonly service:StudentMigrationService){}
 onModuleInit(){if(process.env.STUDENT_MIGRATION_WORKER==='0')return;this.timer=setInterval(()=>void this.tick(),10000);this.timer.unref();}
 onModuleDestroy(){if(this.timer)clearInterval(this.timer);}
 async tick(){if(this.running)return;this.running=true;try{
  const jobs=await this.db.studentImportJob.findMany({where:{status:{in:['QUEUED','PROCESSING','VALIDATING','COMMITTING']},OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]},orderBy:{createdAt:'asc'},take:4});
  for(const candidate of jobs){const token=randomUUID();const claim=await this.db.studentImportJob.updateMany({where:{id:candidate.id,status:candidate.status,leaseToken:candidate.leaseToken,OR:[{leaseUntil:null},{leaseUntil:{lt:new Date()}}]},data:{leaseToken:token,leaseUntil:new Date(Date.now()+90000),status:candidate.status==='QUEUED'?'PROCESSING':candidate.status}});if(!claim.count)continue;
   const job={...candidate,status:candidate.status==='QUEUED'?'PROCESSING':candidate.status,leaseToken:token};const heartbeat=setInterval(()=>void this.db.studentImportJob.updateMany({where:{id:job.id,leaseToken:token},data:{leaseUntil:new Date(Date.now()+90000)}}).catch(()=>undefined),30000);heartbeat.unref();
   try{if(job.status==='COMMITTING'){
    const rows=await this.db.studentImportRow.findMany({where:{schoolId:job.schoolId,jobId:job.id,status:'VALID'},orderBy:{sourceRef:'asc'}});
    for(const row of rows)try{await this.service.commitRow(job,row);}catch(error){await this.db.studentImportRow.updateMany({where:{id:row.id,status:'VALID'},data:{status:'FAILED',issues:[migrationError(error)],revision:{increment:1}}});this.log.warn('Migration row failed '+job.id+'/'+row.id+' code='+((error as any)?.code || 'VALIDATION'));}
    const failed=await this.db.studentImportRow.count({where:{jobId:job.id,status:'FAILED'}});await this.db.studentImportJob.updateMany({where:{id:job.id,leaseToken:token},data:{status:failed?'PARTIAL':'COMPLETED',leaseToken:null,leaseUntil:null,revision:{increment:1}}});
   }else if(job.status==='VALIDATING'){const actorId=(job.options as any).validationActorId || job.actorId;await this.service.permission(this.db,job.schoolId,actorId,'students.import.manage');await this.service.validate(job.schoolId,actorId,job.id,{revision:job.revision},true);await this.db.studentImportJob.updateMany({where:{id:job.id,leaseToken:token},data:{leaseToken:null,leaseUntil:null}});
   }else{await this.service.permission(this.db,job.schoolId,job.actorId,'students.import.manage');await this.service.processExtraction(job);}
   }catch(error){await this.db.studentImportJob.updateMany({where:{id:job.id,leaseToken:token},data:{status:'FAILED',error:migrationError(error),leaseToken:null,leaseUntil:null,revision:{increment:1}}});this.log.warn('Migration job failed '+job.id+' code='+((error as any)?.code || 'EXTRACTION'));}finally{clearInterval(heartbeat);}
  }
  const expired=await this.db.studentImportFile.findMany({where:{deletedAt:null,job:{retainUntil:{lt:new Date()},status:{notIn:['QUEUED','PROCESSING','VALIDATING','COMMITTING']}}},take:50});
  for(const file of expired){if(!/^[a-f0-9-]{36}$/.test(file.fileKey))continue;await unlink(resolve(this.service.directory,file.fileKey)).catch(error=>{if(error.code!=='ENOENT')throw error;});await this.db.studentImportFile.update({where:{id:file.id},data:{deletedAt:new Date()}});await this.db.auditLog.create({data:{schoolId:file.schoolId,method:'DELETE',path:'/student-migrations/'+file.jobId+'/source',action:'STUDENT_IMPORT_SOURCE_EXPIRED',entityType:'StudentImportFile',entityId:file.id,metadata:{academicYearId:file.academicYearId,jobId:file.jobId}}});}
 }catch(error){this.log.warn('Migration worker tick failed code='+((error as any)?.code || 'PROCESSING'));}finally{this.running=false;}}
}
