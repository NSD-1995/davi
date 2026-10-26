'use client';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function TimetableDrawer({ title, children, onClose, locked = false }: { title: string; children: ReactNode; onClose: () => void; locked?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId();
  useEffect(() => { const previous = document.activeElement as HTMLElement | null; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.showModal(); return () => { ref.current?.close(); document.body.style.overflow = overflow; previous?.focus(); }; }, []);
  return <dialog className="tt-drawer" ref={ref} aria-labelledby={id} onCancel={e => { e.preventDefault(); if (!locked) onClose(); }}><header><h2 id={id}>{title}</h2><button className="icon-button" disabled={locked} aria-label="Close panel" onClick={onClose}><X size={18}/></button></header>{children}</dialog>;
}
