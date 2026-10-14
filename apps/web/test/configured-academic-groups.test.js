const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../lib/academic-groups.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const moduleExports={};new Function('exports',compiled)(moduleExports);
const {configuredAcademicGroups,subjectInConfiguredGroups}=moduleExports;

test('Montessori setup excludes other years and inactive groups',()=>{
 const groups=configuredAcademicGroups([
  {name:'Play School',academicYearId:'current',status:'ACTIVE'},
  {name:'LKG',academicYearId:'current',status:'ACTIVE'},
  {name:'Class 3',academicYearId:'old',status:'ACTIVE'},
  {name:'Class 8',academicYearId:'current',status:'INACTIVE'},
 ],'current');
 assert.deepEqual(groups.map(g=>g.id),['MONTESSORI']);
 assert.equal(subjectInConfiguredGroups({academicGroups:['PRIMARY']},groups),false);
 assert.equal(subjectInConfiguredGroups({academicGroups:['MONTESSORI','PRIMARY']},groups),true);
 assert.equal(subjectInConfiguredGroups({academicGroups:[]},groups),true);
});

test('adding a group makes it available without duplicates, including custom classes',()=>{
 const rows=[{name:'UKG'},{name:'Custom',academicGroup:'PRIMARY'},{name:'Class 4'}];
 assert.deepEqual(configuredAcademicGroups(rows).map(g=>g.id),['MONTESSORI','PRIMARY']);
 assert.deepEqual(configuredAcademicGroups([]),[]);
 assert.deepEqual(configuredAcademicGroups([{name:'Unknown'}]),[]);
});
