import { BadRequestException, ConflictException } from '@nestjs/common';
/** Reserve within the caller's serializable enrollment transaction. */
export async function assignSectionRoll(tx:any,schoolId:string,academicYearId:string,sectionId:string|null|undefined,requested?:string,excludeId?:string){
 if(!sectionId){if(requested?.trim())throw new BadRequestException('Choose a section before assigning a roll number.');return null;}
 const section=await tx.section.findFirst({where:{id:sectionId,schoolId,schoolClass:{academicYearId}}});if(!section)throw new BadRequestException('Section must belong to the selected school and academic year.');
 await tx.section.update({where:{id:sectionId},data:{updatedAt:new Date()}});
 const rows=await tx.studentEnrollment.findMany({where:{schoolId,academicYearId,sectionId,...(excludeId?{id:{not:excludeId}}:{})},select:{rollNumber:true}});
 const canonical=(s:string)=>/^\d+$/.test(s)?String(Number(s)):s.toLowerCase();const used=new Set(rows.filter((r:any)=>r.rollNumber?.trim()).map((r:any)=>canonical(r.rollNumber.trim())));
 const value=requested?.trim();if(value){if(value.length>100)throw new BadRequestException('Roll number must be at most 100 characters.');if(used.has(canonical(value)))throw new ConflictException('Roll number already exists in the selected section and academic year.');return value;}
 let highest=0;for(const row of rows)if(/^\d+$/.test(row.rollNumber?.trim()||''))highest=Math.max(highest,Number(row.rollNumber.trim()));if(!Number.isSafeInteger(highest+1))throw new BadRequestException('Existing roll numbers are too large.');return String(highest+1);
}
