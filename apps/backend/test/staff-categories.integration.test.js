require('reflect-metadata');
const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),{PrismaClient}=require('@prisma/client');
const {StaffCategoryService}=require('../dist/staff/staff-category.service'),{StaffService}=require('../dist/staff/staff.service'),{OperationsAccessService}=require('../dist/auth/operations-access.service');
test('PostgreSQL: staff categories enforce RBAC, duplicate names and school assignment',{skip:process.env.OPERATIONS_DB_TEST!=='1'},async()=>{
 const db=new PrismaClient(),rollback=new Error('rollback');try{await assert.rejects(db.$transaction(async tx=>{
  const client=new Proxy(tx,{get(t,k){return k==='$transaction'?fn=>fn(client):Reflect.get(t,k);}});
  const school=await tx.school.create({data:{name:'Category fixture',slug:'category-'+randomUUID()}}),foreign=await tx.school.create({data:{name:'Other',slug:'category-other-'+randomUUID()}});
  const users=[];for(let i=0;i<3;i++)users.push(await tx.user.create({data:{schoolId:school.id,email:i+'@category.invalid',passwordHash:'fixture',firstName:'Staff',lastName:String(i)}}));
  const admin=await tx.role.create({data:{schoolId:school.id,code:'SCHOOL_ADMIN',name:'Admin'}}),manager=await tx.role.create({data:{schoolId:school.id,code:'CATEGORY_MANAGER',name:'Category manager'}});
  const permission=await tx.permission.upsert({where:{code:'STAFF_CATEGORY_MANAGE'},create:{code:'STAFF_CATEGORY_MANAGE',module:'STAFF_CATEGORY',action:'MANAGE'},update:{}});
  await tx.rolePermission.create({data:{roleId:manager.id,permissionId:permission.id}});for(const [i,r]of [[0,admin],[1,manager]])await tx.userRole.create({data:{schoolId:school.id,userId:users[i].id,roleId:r.id}});
  const service=new StaffCategoryService(client,new OperationsAccessService(client));
  await assert.rejects(service.create(school.id,users[2].id,{name:'Office',classification:'ADMIN'}),/permission/);
  const created=await service.create(school.id,users[1].id,{name:'  Accounts  team ',classification:'ADMIN'});assert.equal(created.name,'Accounts team');
  await assert.rejects(service.create(school.id,users[0].id,{name:'accounts TEAM',classification:'NON_TEACHING'}),/already exists/);
  await assert.rejects(service.create(foreign.id,users[1].id,{name:'Office',classification:'ADMIN'}),/membership/);
  await assert.rejects(service.create(school.id,users[0].id,{name:'Office',classification:'UNKNOWN'}),/classification/);
  assert.equal((await service.list(school.id,users[1].id)).length,1);
  const staff=await tx.staff.create({data:{schoolId:school.id,userId:users[2].id,employeeId:'CUSTOM'}}),staffService=new StaffService(client);
  await staffService.update(school.id,staff.id,school.id,{staffCategoryId:created.id,staffCategory:'TEACHING'});
  let saved=await staffService.findOne(school.id,staff.id,school.id);assert.equal(saved.staffCategory,'ADMIN');assert.equal(saved.categoryDefinition.name,'Accounts team');
  const other=await tx.staffCategoryDefinition.create({data:{schoolId:foreign.id,name:'Foreign',classification:'TEACHING'}});
  await assert.rejects(staffService.update(school.id,staff.id,school.id,{staffCategoryId:other.id}),/this school/);
  await staffService.update(school.id,staff.id,school.id,{staffCategoryId:null,staffCategory:'NON_TEACHING'});saved=await staffService.findOne(school.id,staff.id,school.id);assert.equal(saved.staffCategoryId,null);assert.equal(saved.staffCategory,'NON_TEACHING');
  assert.equal(await tx.auditLog.count({where:{schoolId:school.id,action:'STAFF_CATEGORY_CREATE'}}),1);throw rollback;
 },{timeout:30000}),e=>e===rollback);}finally{await db.$disconnect();}
});
