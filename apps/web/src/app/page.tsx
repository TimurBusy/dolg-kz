'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { clearAuth, getAuth } from '@/lib/auth-store';

type Party = {
  id: string;
  phone: string;
  identity?: { firstName: string | null; lastName: string | null } | null;
};

type Loan = {
  id: string;
  number: string;
  lenderId: string;
  borrowerId: string | null;
  borrowerPhone: string;
  principalAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: string;
  lender: Party;
  borrower: Party | null;
};

type Me = { id: string; phone: string };

const openStatuses = new Set([
  'DRAFT',
  'WAITING_LENDER_SIGNATURE',
  'WAITING_BORROWER_SIGNATURE',
  'SIGNED',
  'WAITING_TRANSFER',
  'WAITING_TRANSFER_CONFIRMATION',
  'ACTIVE',
  'PARTIALLY_REPAID',
  'OVERDUE',
  'DISPUTED',
]);

function badgeStatus(status: string): 'draft' | 'waiting' | 'active' | 'overdue' | 'closed' | 'disputed' {
  if (status === 'DRAFT') return 'draft';
  if (status === 'OVERDUE') return 'overdue';
  if (status === 'DISPUTED') return 'disputed';
  if (['REPAID', 'CLOSED', 'CANCELLED'].includes(status)) return 'closed';
  if (['ACTIVE', 'PARTIALLY_REPAID'].includes(status)) return 'active';
  return 'waiting';
}

function partyName(party: Party | null | undefined, fallbackPhone: string) {
  const fullName = [party?.identity?.firstName, party?.identity?.lastName].filter(Boolean).join(' ');
  return fullName || party?.phone || fallbackPhone;
}

function dueLabel(date: string, status: string) {
  const due = new Date(date);
  const now = new Date();
  const days = Math.ceil((due.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) / 86400000);
  if (status === 'OVERDUE' || days < 0) return `просрочено ${Math.abs(days)} дн.`;
  return `до ${due.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }

    Promise.all([
      api<Me>('/me', {}, auth.accessToken),
      api<Loan[]>('/loans', {}, auth.accessToken),
    ])
      .then(([meData, loansData]) => {
        setMe(meData);
        setLoans(loansData);
      })
      .catch(() => {
        clearAuth();
        setError('Сессия истекла. Войдите снова.');
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const summary = useMemo(() => {
    if (!me) return { owedToMe: 0, iOwe: 0, lentCount: 0, borrowedCount: 0 };

    const open = loans.filter((loan) => openStatuses.has(loan.status));
    const lent = open.filter((loan) => loan.lenderId === me.id);
    const borrowed = open.filter((loan) => loan.borrowerId === me.id);

    return {
      owedToMe: lent.reduce((sum, loan) => sum + loan.remainingAmount, 0),
      iOwe: borrowed.reduce((sum, loan) => sum + loan.remainingAmount, 0),
      lentCount: lent.length,
      borrowedCount: borrowed.length,
    };
  }, [loans, me]);

  const recentLoans = useMemo(() => loans.filter((loan) => openStatuses.has(loan.status)).slice(0, 5), [loans]);

  return (
    <AppShell>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 pb-24 md:p-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[var(--muted)]">Добрый вечер</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Мои долги</h1>
          </div>
          <Button asChild><Link href="/loans/new">+ Оформить займ</Link></Button>
        </header>

        {loading ? <p className="text-sm text-[var(--muted)]">Загрузка данных…</p> : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}

        {!loading ? (
          <>
            <section className="grid gap-4 md:grid-cols-2">
              <Card>
                <p className="text-sm text-[var(--muted)]">Мне должны</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{summary.owedToMe.toLocaleString('ru-RU')} ₸</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{summary.lentCount} активных договоров</p>
              </Card>
              <Card>
                <p className="text-sm text-[var(--muted)]">Я должен</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight">{summary.iOwe.toLocaleString('ru-RU')} ₸</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{summary.borrowedCount} активных договоров</p>
              </Card>
            </section>

            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Текущие договоры</h2>
                <Link href="/loans" className="text-sm font-medium text-[var(--muted)] hover:text-black">Все договоры</Link>
              </div>

              {recentLoans.length === 0 ? (
                <Card className="text-center">
                  <p className="font-medium">Пока нет договоров</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый займ — он появится здесь.</p>
                </Card>
              ) : (
                <div className="grid gap-3">
                  {recentLoans.map((loan) => {
                    const isLender = loan.lenderId === me?.id;
                    const otherParty = isLender
                      ? partyName(loan.borrower, loan.borrowerPhone)
                      : partyName(loan.lender, loan.lender.phone);

                    return (
                      <Link key={loan.id} href={`/loans/${loan.id}`}>
                        <Card className="flex items-center justify-between gap-4 transition hover:-translate-y-0.5 hover:shadow-md">
                          <div>
                            <p className="text-xs font-medium text-[var(--muted)]">{loan.number}</p>
                            <p className="mt-1 font-medium">{isLender ? 'Заёмщик' : 'Заимодатель'}: {otherParty}</p>
                            <p className="mt-1 text-xl font-semibold">{loan.remainingAmount.toLocaleString('ru-RU')} ₸</p>
                            <p className="mt-1 text-sm text-[var(--muted)]">{dueLabel(loan.dueDate, loan.status)}</p>
                          </div>
                          <StatusBadge status={badgeStatus(loan.status)} />
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
