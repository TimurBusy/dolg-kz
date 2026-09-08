'use client';

import { Bell, FileText, Home, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const nav = [
  { label: 'Главная', icon: Home, href: '/' },
  { label: 'Договоры', icon: FileText, href: '/loans' },
  { label: 'Уведомления', icon: Bell, href: '/notifications' },
  { label: 'Профиль', icon: UserRound, href: '/profile' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-[var(--border)] bg-[var(--surface)] p-5 md:block">
        <Link href="/" className="mb-8 block text-xl font-bold tracking-tight">Dolg.kz</Link>
        <nav className="space-y-1">
          {nav.map(({ label, icon: Icon, href }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={label}
                href={href}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? 'bg-black text-white' : 'text-[var(--muted)] hover:bg-gray-100'}`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main>{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-[var(--border)] bg-white px-2 py-2 md:hidden">
        {nav.map(({ label, icon: Icon, href }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={label}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] ${active ? 'font-semibold text-black' : 'text-[var(--muted)]'}`}
            >
              <Icon size={19} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
