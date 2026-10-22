const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.join(__dirname, '../lib/academic-navigation.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const api = {}; new Function('exports', compiled)(api);
const { academicNavigation, visibleAcademicNavigation, matchesAcademicRoute } = api;

test('existing destinations and teaching staff remain reachable in four groups', () => {
  assert.deepEqual(academicNavigation.map(group => group.label), ['Academic Setup', 'Class Workspace', 'Timetables', 'Academic Planning']);
  const routes = academicNavigation.flatMap(group => group.links.map(link => link.href));
  assert.equal(new Set(routes).size, 14);
  assert.deepEqual(routes.slice().sort(), ['holidays-events', 'workspace', 'academic-planner', 'ai-lesson-plans', 'timetables', 'timetable-settings', 'period-templates', 'academic-years', 'classes', 'section-capacity', 'groups', 'subjects', 'assessments'].map(route => '/academics/' + route).concat('/people/teachers').sort());
});
test('permissions hide empty groups and independently filter advanced features', () => {
  assert.deepEqual(visibleAcademicNavigation(() => false), []);
  const menu = visibleAcademicNavigation(permission => permission === 'PERIOD_TEMPLATE_VIEW');
  assert.equal(menu.length, 1);
  assert.equal(menu[0].label, 'Timetables');
  assert.deepEqual(menu[0].links.map(link => link.label), ['Period Templates']);
  assert.equal(menu[0].links[0].advanced, true);
  const teacherMenu = visibleAcademicNavigation(permission => ['CLASS_VIEW', 'LESSON_PLAN_VIEW'].includes(permission));
  assert.deepEqual(teacherMenu.map(group => group.label), ['Academic Setup', 'Class Workspace', 'Academic Planning']);
  assert.deepEqual(teacherMenu[0].links.map(link => link.label), ['Classes & Sections']);
});
test('deep workspace links match their parent without matching similar route names', () => {
  assert.equal(matchesAcademicRoute('/academics/workspace/c1/sections/s1', '/academics/workspace'), true);
  assert.equal(matchesAcademicRoute('/academics/timetable-settings', '/academics/timetables'), false);
  assert.equal(matchesAcademicRoute('/academics/workspace-other', '/academics/workspace'), false);
});

function renderNavigation(route, permissions) {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const componentSource = fs.readFileSync(path.join(__dirname, '../components/academic-navigation.tsx'), 'utf8');
  const javascript = ts.transpileModule(componentSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const component = {};
  const imports = name => {
    if (name === '../lib/auth-context') return { useAuth: () => ({ can: permission => permissions.includes(permission), session: null }) };
    if (name === '../lib/academic-navigation') return api;
    if (name === 'next/link') return { default: ({ children, ...props }) => React.createElement('a', props, children) };
    return require(name);
  };
  new Function('exports', 'require', javascript)(component, imports);
  return renderToStaticMarkup(React.createElement(component.AcademicNavigation, { path: route, onNavigate() {} }));
}
test('direct page render expands and highlights the active planning destination', () => {
  const html = renderNavigation('/academics/academic-planner', ['LESSON_PLAN_VIEW']);
  assert.match(html, /aria-expanded="true" aria-controls="academic-nav-planning"/);
  assert.match(html, /href="\/academics\/academic-planner" aria-current="page"/);
  assert.doesNotMatch(html, /academic-nav-setup|academic-nav-timetable/);
});
test('nested workspace route highlights workspace, and no permissions renders no academics menu', () => {
  assert.match(renderNavigation('/academics/workspace/c1/sections/s1', ['CLASS_VIEW']), /class="active" aria-current="page"/);
  assert.equal(renderNavigation('/academics/workspace', []), '');
});

test('teaching staff uses the existing permission and expands setup on detail routes', () => {
  const menu = visibleAcademicNavigation(permission => permission === 'STAFF_VIEW');
  assert.equal(menu.length, 1);
  assert.equal(menu[0].label, 'Academic Setup');
  assert.deepEqual(menu[0].links.map(link => link.href), ['/people/teachers']);
  const html = renderNavigation('/people/teachers/teacher-1', ['STAFF_VIEW']);
  assert.match(html, /aria-expanded="true" aria-controls="academic-nav-setup"/);
  assert.match(html, /Teaching Staff/);
  assert.match(html, /href="\/people\/teachers" aria-current="page"/);
});
