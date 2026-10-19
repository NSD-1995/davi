const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const source=fs.readFileSync(require('node:path').join(__dirname,'../lib/student-intake-csv.ts'),'utf8');
const api={};new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(api,()=>{const dates={};new Function('exports',ts.transpileModule(fs.readFileSync(require('node:path').join(__dirname,'../lib/import-date.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(dates);return dates;});
const {parseStudentIntakeCsv:parse}=api;
test('intake CSV supports quoted names, BOM, CRLF, blanks and configured extra fields',()=>{
 const rows=parse('\uFEFFfirstName,lastName,className,parentName,mobile,extra.language\r\n"Child, One",,Class 3,"Parent ""One""",9876543210,Tamil\r\n\r\n');
 assert.equal(rows.length,1);assert.equal(rows[0].firstName,'Child, One');assert.equal(rows[0].parentName,'Parent "One"');assert.equal(rows[0].extraFields.language,'Tamil');
});
test('intake CSV rejects ambiguous or malformed records before preview',()=>{
 assert.throws(()=>parse('firstName,className,parentName,mobile\nChild,Class 3,Parent'),/columns/);
 assert.throws(()=>parse('firstName,className,parentName,mobile\n"Child,Class 3,Parent,9876543210'),/Unclosed/);
 assert.throws(()=>parse('firstName,className,parentName,mobile,mobile\nChild,Class 3,Parent,9876543210,9876543210'),/unique/);
 assert.throws(()=>parse('firstName,className,parentName,mobile\nChild,,Parent,9876543210'),/required/);
});
