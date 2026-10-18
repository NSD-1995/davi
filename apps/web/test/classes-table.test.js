const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function renderTable(rows, permissions = [], expand = false) {
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const javascript = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    const exports = {}; cache.set(filename, exports);
    const imports = name => {
      if (name.endsWith('/auth-context')) return { useAuth: () => ({ can: permission => permissions.includes(permission) }) };
      if (name === 'react' && expand) return { ...React, useState: initial => React.useState(initial instanceof Set ? new Set(rows.map(row => row.id)) : initial) };
      if (name.startsWith('.')) {
        const target = path.resolve(path.dirname(filename), name);
        return load(fs.existsSync(target + '.tsx') ? target + '.tsx' : target + '.ts');
      }
      return require(name);
    };
    new Function('exports', 'require', javascript)(exports, imports);
    return exports;
  }
  const { ClassesTable } = load(path.join(__dirname, '../components/classes-table.tsx'));
  return renderToStaticMarkup(React.createElement(ClassesTable, { rows, busy: false, onEditClass() {}, onSection() {}, onSubjects() {}, onDeleteClass() {}, onDeleteSection() {} }));
}
const row = { id: 'class-1', name: 'Class 3', academicGroup: 'PRIMARY', status: 'ACTIVE', sections: [{ id: 'section-1', name: 'A', capacity: 30, status: 'ACTIVE' }] };

test('classes start compact, with accessible expansion and configured capacity', () => {
  const html = renderTable([row]);
  assert.match(html, /aria-expanded="false" aria-controls="class-sections-class-1"/);
  assert.match(html, /<strong>30<\/strong>/);
  assert.match(html, /Total section seats/);
  assert.doesNotMatch(html, /Edit section|Delete section/);
});
test('expanded sections keep mutation controls behind their existing permissions', () => {
  const readOnly = renderTable([row], [], true);
  assert.match(readOnly, /View only/);
  assert.doesNotMatch(readOnly, /Edit section|Delete section|Delete class|Add section|Assign subjects/);
  const editable = renderTable([row], ['CLASS_UPDATE', 'CLASS_DELETE', 'SECTION_CREATE', 'SECTION_UPDATE', 'SECTION_DELETE', 'CLASS_SUBJECT_VIEW'], true);
  for (const label of ['Edit section', 'Delete section', 'Edit class', 'Delete class', 'Add section', 'Assign subjects']) assert.ok(editable.includes(label), label);
  assert.match(editable, /<details class="record-action-menu"/);
});
test('large class lists render only one page of summary rows', () => {
  const html = renderTable(Array.from({ length: 45 }, (_, index) => ({ ...row, id: 'class-' + index })));
  assert.equal((html.match(/class="class-summary /g) || []).length, 20);
  assert.match(html, /Page 1 of 3/);
});
