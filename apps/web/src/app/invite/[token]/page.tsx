'use client';

import { Loader2, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getAuth } from '@/lib/auth-store';

type Invitation = {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  borrowerPhoneMasked: string;
  loan: {
    id: string;
    number: string;
    principalAmount: number;
    currency: string;
    dueDate: string;
    lenderName: string;
  };
};

type AcceptResponse = {
  ok: true;
  loanId: string;
  profileComplete: boolean;
};

export default function InvitationPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Invitation>(`/invitations/${token}`)
      .then(setInvitation)
      .catch((requestError) =>
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Приглашение не найдено',
        ),
      )
      .finally(() => setLoading(false));
  }, [token]);

  async function accept() {
    const auth = getAuth();
    if (!auth) {
      router.push(
        `/login?returnTo=${encodeURIComponent(`/invite/${token}`)}`,
      );
      return;
    }

    setAccepting(true);
    setError('');
    try {
      const result = await api<AcceptResponse>(
        `/invitations/${token}/accept`,
        { method: 'POST' },
        auth.accessToken,
      );

      if (result.profileComplete) {
        router.push(`/loans/${result.loanId}`);
      } else {
        router.push(
          `/profile?returnTo=${encodeURIComponent(`/loans/${result.loanId}`)}`,
        );
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось принять приглашение',
      );
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-4">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-2xl bg-black p-2.5 text-white">
            <ShieldCheck size={22} />
          </div>
          <div>
            <p className="text-xl font-bold">Dolg.kz</p>
            <p className="text-sm text-[var(--muted)]">Приглашение к договору займа</p>
          </div>
        </div>

        <Card className="p-6">
          {loading ? (
            <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
              <Loader2 className="animate-spin" size={18} />
              Загружаем приглашение…
            </div>
          ) : null}

          {invitation ? (
            <>
              <p className="text-sm font-medium text-[var(--muted)]">
                {invitation.loan.number}
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                {invitation.loan.principalAmount.toLocaleString('ru-RU')} ₸
              </h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Заимодатель: {invitation.loan.lenderName}
              </p>

              <div className="mt-6 grid gap-3 rounded-2xl bg-gray-50 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--muted)]">Вернуть до</span>
                  <b>
                    {new Date(invitation.loan.dueDate).toLocaleDateString('ru-RU')}
                  </b>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-[var(--muted)]">Номер заёмщика</span>
                  <b>{invitation.borrowerPhoneMasked}</b>
                </div>
              </div>

              {invitation.status === 'PENDING' ? (
                <>
                  <p className="mt-5 text-sm leading-6 text-[var(--muted)]">
                    Войдите именно с номером телефона, указанным заимодателем.
                    После принятия приглашения вы сможете проверить договор перед
                    электронной подписью.
                  </p>
                  <Button
                    className="mt-5 w-full"
                    onClick={accept}
                    disabled={accepting}
                  >
                    {accepting ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" size={16} />
                        Принимаем…
                      </>
                    ) : getAuth() ? (
                      'Принять приглашение'
                    ) : (
                      'Войти и принять'
                    )}
                  </Button>
                </>
              ) : (
                <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm">
                  Статус приглашения: <b>{invitation.status}</b>
                </div>
              )}
            </>
          ) : null}

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}
        </Card>
      </div>
    </main>
  );
}
