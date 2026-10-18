import type { SchoolClass } from './types';

export function configuredClassCapacity(row: Pick<SchoolClass, 'capacity' | 'sections'>): { value: number | null; detail: string } {
  const configured = row.sections.filter(section => section.capacity != null);
  if (configured.length) {
    return {
      value: configured.reduce((total, section) => total + section.capacity!, 0),
      detail: configured.length < row.sections.length ? `${row.sections.length - configured.length} section(s) not configured` : 'Total section seats',
    };
  }
  return { value: row.capacity ?? null, detail: row.capacity != null ? 'Class capacity' : 'Not configured' };
}
