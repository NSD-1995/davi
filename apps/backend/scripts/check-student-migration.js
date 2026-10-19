require('reflect-metadata');
const fs=require('node:fs/promises'),path=require('node:path');
const {PrismaClient}=require('@prisma/client');
const {MigrationScanner}=require('../dist/student-migration/migration-scanner');
(async()=>{const db=new PrismaClient(),checks={database:false,importSchema:false,localOcr:false,malwareScanner:false};const problems=[];
 try{await db.$queryRaw`SELECT 1`;checks.database=true;await db.studentImportJob.count();checks.importSchema=true;}catch{problems.push('Deploy migrations and regenerate Prisma Client.');}finally{await db.$disconnect();}
 try{if(!process.env.MIGRATION_OCR_LANG_PATH)throw Error();await fs.access(path.resolve(process.env.MIGRATION_OCR_LANG_PATH,'eng.traineddata'));checks.localOcr=true;}catch{problems.push('Set MIGRATION_OCR_LANG_PATH to the local directory containing eng.traineddata.');}
 try{checks.malwareScanner=(await new MigrationScanner().scan(Buffer.from('DAVI scanner readiness check; no student data.'))).clean;}catch{problems.push('Configure MIGRATION_CLAMD_HOST and MIGRATION_CLAMD_PORT, start ClamAV, then retry. Uploads remain quarantined until clean.');}
 console.log(JSON.stringify({checks,ready:checks.database&&checks.importSchema&&checks.malwareScanner,problems},null,2));if(!checks.database||!checks.importSchema||!checks.malwareScanner)process.exitCode=1;
})().catch(()=>{console.error('Readiness check failed. Build the backend and verify its environment configuration.');process.exitCode=1;});
