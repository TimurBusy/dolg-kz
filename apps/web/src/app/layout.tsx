import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Dolg.kz',
  description: 'Безопасное оформление частных займов между людьми',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}
