import {BadRequestException,ConflictException,ForbiddenException,Injectable} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {OperationsAccessService} from '../auth/operations-access.service';
import {operationsTransaction} from '../attendance/operations-transaction';
@Injectable()
export class StaffCategoryService {
 constructor(private readonly db:PrismaService,private readonly access:OperationsAccessService){}
 async list(s:string,userId:string){const actor=await this.access.actor(s,userId);if(!actor.admin&&!['STAFF_VIEW','STAFF_CREATE','STAFF_UPDATE','STAFF_CATEGORY_MANAGE'].some(p=>actor.permissions.has(p)))throw new ForbiddenException('Staff access required.');return this.db.staffCategoryDefinition.findMany({where:{schoolId:s},orderBy:{name:'asc'}});}
 async create(s:string,userId:string,data:any){
  await this.access.actor(s,userId,'STAFF_CATEGORY_MANAGE');
  const name=typeof data?.name==='string'?data.name.trim().replace(/\s+/g,' '):'';
  if(!name||name.length>80||!['TEACHING','NON_TEACHING','ADMIN'].includes(data.classification))throw new BadRequestException('Enter a category name (up to 80 characters) and substitution classification.');
  if(['teaching','non-teaching','admin','admin / accounts'].includes(name.toLowerCase()))throw new ConflictException('This is already a built-in category.');
  return operationsTransaction(this.db,async tx=>{
   if(await tx.staffCategoryDefinition.findFirst({where:{schoolId:s,name:{equals:name,mode:'insensitive'}}}))throw new ConflictException('A category with this name already exists.');
   const category=await tx.staffCategoryDefinition.create({data:{schoolId:s,name,classification:data.classification}});
   await tx.auditLog.create({data:{schoolId:s,actorId:userId,method:'POST',path:'/staff/categories',action:'STAFF_CATEGORY_CREATE',entityType:'StaffCategoryDefinition',entityId:category.id,metadata:{name,classification:category.classification}}});return category;
  });
 }
}
