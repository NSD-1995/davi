'use client';
import { useAcademicYear } from '../lib/academic-year-context';
export function AcademicYearSelector() { const { years, selectedId, setSelectedId, loading } = useAcademicYear(); return <label className="year-selector"><span>Academic Year</span><select value={selectedId} onChange={e => setSelectedId(e.target.value)} disabled={loading || !years.length}>{years.length ? years.map(y => <option key={y.id} value={y.id}>{y.name}{y.isCurrent ? ' · Current' : ''}</option>) : <option>No academic year</option>}</select></label>; }
