'use client';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { TimetableMatrix } from '../components/timetable-matrix';
import { printTimetables } from './print-timetables';
import { timetableCSV } from './timetable-presentation';
export type PrintableTimetable = { label: string; plan: any };
let activeCleanup: (() => void) | undefined;
export function printTimetableCollection(sections: PrintableTimetable[], schoolName: string, yearName: string) {
  if (!sections.length) return;
  activeCleanup?.();
  const host = document.createElement('div'); host.className = 'tt-print-host'; document.body.appendChild(host);
  const root = createRoot(host);
  const cleanup = () => { window.removeEventListener('afterprint', cleanup); document.body.classList.remove('tt-collection-print'); root.unmount(); host.remove(); activeCleanup = undefined; };
  activeCleanup = cleanup;
  try {
    flushSync(() => root.render(<>{sections.map(({ label, plan }) => <section className="timetable-sheet" key={plan.id}><h1>{schoolName}</h1><h2>{label}</h2><p>{yearName} · Version {plan.version} · {plan.status}</p><TimetableMatrix plan={plan} label={label}/></section>)}</>));
    document.body.classList.add('tt-collection-print'); window.addEventListener('afterprint', cleanup, { once: true });
    printTimetables();
  } catch (error) { cleanup(); throw error; }
}
export function downloadTimetableCSV(sections: PrintableTimetable[], fileName = 'DAVI-timetables.csv') {
  if (!sections.length) return;
  const url = URL.createObjectURL(new Blob([timetableCSV(sections)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = fileName; link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
