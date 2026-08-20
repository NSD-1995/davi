'use client';
import { createContext, useContext, useState, type ReactNode } from 'react';
type Kind = 'success' | 'error'; const Context = createContext<{ show: (message: string, kind?: Kind) => void } | null>(null);
export function ToastProvider({ children }: { children: ReactNode }) { const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null); const show = (message: string, kind: Kind = 'success') => { setToast({ message, kind }); window.setTimeout(() => setToast(null), 4000); }; return <Context.Provider value={{ show }}>{children}{toast && <div className={`toast ${toast.kind}`}>{toast.message}</div>}</Context.Provider>; }
export function useToast() { const v = useContext(Context); if (!v) throw new Error('Missing ToastProvider'); return v; }
