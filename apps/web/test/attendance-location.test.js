const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const output=ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/attendance-location.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};new Function('exports',output)(exported);
test('GPS is requested once with no cached location or continuous watch',async()=>{
 let count=0;const result=await exported.attendanceLocation({getCurrentPosition(success,failure,options){count++;assert.equal(options.maximumAge,0);assert.equal(options.enableHighAccuracy,true);success({coords:{latitude:0,longitude:0,accuracy:12}});}});
 assert.equal(count,1);assert.deepEqual(result,{latitude:0,longitude:0,accuracy:12});
});
test('denied permission, unavailable GPS and timeout explain the exception path',async()=>{
 await assert.rejects(exported.attendanceLocation(),/HTTPS/);
 for(const [code,message]of [[1,/denied/],[2,/unavailable/],[3,/timed out/]])await assert.rejects(exported.attendanceLocation({getCurrentPosition(success,failure){failure({code});}}),message);
});
