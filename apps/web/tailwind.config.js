module.exports = {
  content: ['./components/report-*.tsx', './components/analytics-workspace.tsx', './components/school-command-center*.tsx'],
  prefix: 'tw-',
  corePlugins: { preflight: false },
  theme: { extend: { colors: { ink: 'var(--ink)', teal: 'var(--teal)', canvas: 'var(--canvas)' } } },
  plugins: [],
};
