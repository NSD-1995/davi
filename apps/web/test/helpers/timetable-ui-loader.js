const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),React=require('react');
function timetableLoader({session={token:'test',user:{school:{name:'Test school'}},permissions:['TIMETABLE_VIEW','TIMETABLE_GENERATE','TIMETABLE_PUBLISH','TIMETABLE_UPDATE']},selected={id:'year',name:'2026–2027'},react=React,api={},exportApi={}}={}) {
 const cache=new Map();
 const mocks={
  react,
  'next/link':{default:({children,...props})=>React.createElement('a',props,children)},
  auth:{useAuth:()=>({session,can:permission=>session.permissions.includes(permission)})},
  toast:{useToast:()=>({show(){}})},
  year:{useAcademicYear:()=>({selected})},
  groups:{useSchoolAcademicGroups:()=>({groups:[{id:'MONTESSORI',label:'Montessori'}]})},
  api:{ApiError:class ApiError extends Error{},timetablePlanningApi:{},timetableRulesApi:{},operationsApi:{},classWorkspaceApi:{},...api},
  exports:{printTimetableCollection(){},downloadTimetableCSV(){},...exportApi},
 };
 function load(file){
  let absolute=path.isAbsolute(file)?file:path.join(__dirname,'../../',file);if(!fs.existsSync(absolute))absolute+=fs.existsSync(absolute+'.tsx')?'.tsx':'.ts';if(cache.has(absolute))return cache.get(absolute);
  const source=fs.readFileSync(absolute,'utf8'),js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};cache.set(absolute,exports);
  const imports=name=>{
   if(name==='react'||name==='next/link')return mocks[name];
   if(name.endsWith('/auth-context'))return mocks.auth;if(name.endsWith('/toast-context'))return mocks.toast;if(name.endsWith('/academic-year-context'))return mocks.year;if(name.endsWith('/school-academic-groups-context'))return mocks.groups;if(name.endsWith('/api'))return mocks.api;if(name.endsWith('/timetable-export'))return mocks.exports;
   if(name.startsWith('.')){const base=path.resolve(path.dirname(absolute),name);return load(fs.existsSync(base+'.tsx')?base+'.tsx':base+'.ts');}return require(name);
  };
  new Function('exports','require',js)(exports,imports);return exports;
 }
 return {load,session,selected};
}
module.exports={timetableLoader};
