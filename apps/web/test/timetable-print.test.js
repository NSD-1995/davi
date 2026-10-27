const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
function compile(file,imports={}){const source=fs.readFileSync(path.join(__dirname,'../',file),'utf8');const js=require('./school-navigation-test-support').transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;const exports={};new Function('exports','require',js)(exports,name=>name in imports?imports[name]:require(name));return exports;}
function environment(throwOnPrint=false){
 const original={window:global.window,document:global.document};const listeners=new Set(),classes=new Set(),hosts=[],rendered=[];let unmounted=0,printCalls=0;
 global.document={body:{classList:{add:value=>classes.add(value),remove:(...values)=>values.forEach(v=>classes.delete(v))},appendChild:host=>hosts.push(host)},createElement:()=>({remove(){this.removed=true;}})};
 global.window={addEventListener:(event,fn)=>{if(event==='afterprint')listeners.add(fn);},removeEventListener:(event,fn)=>listeners.delete(fn),print(){printCalls++;if(throwOnPrint)throw Error('Print unavailable');}};
 const originalPrint=compile('lib/print-timetables.ts');const api=compile('lib/timetable-export.tsx',{'react-dom/client':{createRoot:()=>({render:tree=>rendered.push(tree),unmount:()=>unmounted++})},'react-dom':{flushSync:fn=>fn()},'../components/timetable-matrix':{TimetableMatrix:()=>null},'./print-timetables':originalPrint,'./timetable-presentation':{timetableCSV:()=>''}});
 return {api,hosts,rendered,classes,printCalls:()=>printCalls,unmounted:()=>unmounted,afterPrint(){for(const fn of [...listeners])fn();},restore(){global.window=original.window;global.document=original.document;}};
}
test('filtered PDF creates print-only sheets on demand and cleans them after printing',()=>{
 const env=environment();try{env.api.printTimetableCollection([{label:'Play School / 1',plan:{id:'a',version:2,status:'DRAFT'}},{label:'Nursery / 1',plan:{id:'b',version:1,status:'PUBLISHED'}}],'School','2026–2027');assert.equal(env.printCalls(),1);assert.equal(env.rendered[0].props.children.length,2);assert.ok(env.classes.has('tt-collection-print'));assert.ok(env.classes.has('timetable-print'));env.afterPrint();assert.equal(env.unmounted(),1);assert.equal(env.hosts[0].removed,true);assert.equal(env.classes.size,0);}finally{env.restore();}
});
test('print errors clean up the temporary root and printing classes',()=>{
 const env=environment(true);try{assert.throws(()=>env.api.printTimetableCollection([{label:'UKG / 1',plan:{id:'a'}}],'School','Year'),/Print unavailable/);assert.equal(env.unmounted(),1);assert.equal(env.hosts[0].removed,true);assert.equal(env.classes.size,0);}finally{env.restore();}
});
test('empty filtered scope does not open a print dialog',()=>{const env=environment();try{env.api.printTimetableCollection([],'School','Year');assert.equal(env.printCalls(),0);assert.equal(env.hosts.length,0);}finally{env.restore();}});
