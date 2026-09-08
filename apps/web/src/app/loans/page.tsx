'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { clearAuth, getAuth } from '@/lib/auth-store';

type Loan = {
  id: string;
  number: string;
  borrowerPhone: string;
  principalAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: string;
};

export default function LoansPage() {
  const router = useRouter();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const auth = getAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }

    api<Loan[]>('/loans', {}, auth.accessToken)
      .then(setLoans)
      .catch((requestError) => {
        if (requestError instanceof TypeError) {
          setError('API недоступен. Проверьте, что backend запущен.');
          return;
        }

        clearAuth();
        router.replace('/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-4xl p-4 pb-24 md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Договоры</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">Все ваши займы в одном месте.</p>
          </div>
          <Button asChild><Link href="/loans/new">+ Оформить займ</Link></Button>
        </div>

        {error ? (
          <Card className="mb-4 border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
        ) : null}

        {loading ? <p className="text-sm text-[var(--muted)]">Загрузка…</p> : null}

        {!loading && loans.length === 0 && !error ? (
          <Card className="text-center">
            <p className="font-medium">Пока нет договоров</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Создайте первый черновик займа.</p>
          </Card>
        ) : null}

        <div className="grid gap-3">
          {loans.map((loan) => (
            <Link key={loan.id} href={`/loans/${loan.id}`}>
              <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-[var(--muted)]">{loan.number}</p>
                    <p className="mt-2 text-xl font-semibold">{loan.principalAmount.toLocaleString('ru-RU')} ₸</p>
                    <p className="mt-1 text-sm text-[var(--muted)]">Заёмщик: {loan.borrowerPhone}</p>
                  </div>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold">{loan.status}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
