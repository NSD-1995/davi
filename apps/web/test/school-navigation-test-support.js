// Presentation suites keep their existing Next mocks. School routing is covered
// separately by school-routes.test.js and the production HTTP rewrite checks.
const ts=require('typescript');
exports.transpileModule=(source,options)=>ts.transpileModule(source.replace(/import\s+([^;]+?)\s+from\s+(['"])[^'"]*school-navigation\2/g,(_match,bindings)=>`import ${bindings} from '${bindings.trim().startsWith('{')?'next/navigation':'next/link'}'`),options);
