const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/class-capacity.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = {}; new Function('exports', compiled)(api);
const { configuredClassCapacity } = api;

test('section capacities are summed without double-counting the class capacity', () => {
  assert.deepEqual(configuredClassCapacity({ capacity: 100, sections: [{ capacity: 30 }, { capacity: 35 }] }), { value: 65, detail: 'Total section seats' });
});
test('partially configured sections are identified instead of treated as zero seats', () => {
  assert.deepEqual(configuredClassCapacity({ capacity: 100, sections: [{ capacity: 30 }, { capacity: null }] }), { value: 30, detail: '1 section(s) not configured' });
});
test('class capacity is the fallback and missing capacity remains unknown', () => {
  assert.deepEqual(configuredClassCapacity({ capacity: 80, sections: [{ capacity: null }] }), { value: 80, detail: 'Class capacity' });
  assert.deepEqual(configuredClassCapacity({ capacity: null, sections: [] }), { value: null, detail: 'Not configured' });
  assert.deepEqual(configuredClassCapacity({ capacity: null, sections: [{ capacity: 0 }] }), { value: 0, detail: 'Total section seats' });
});
