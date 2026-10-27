import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { schoolMetadata, siteOrigin } from '../../lib/school-metadata';

export function generateMetadata(): Metadata { return schoolMetadata(siteOrigin()); }
export default function LoginLayout({ children }: { children: ReactNode }) { return children; }
