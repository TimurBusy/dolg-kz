'use client';

import { CheckCircle2, Loader2, Smartphone } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getAuth } from '@/lib/auth-store';

export type AgreementDocument = {
  id: string;
  status: string;
};

type LoanSigningState = {
  id: string;
  number: string;
  lenderId: string;
  borrowerId: string | null;
  status: string;
};

type Me = { id: string };

type SignatureRecord = {
  id: string;
  documentId: string;
  userId: string;
  provider: string;
  role: 'LENDER' | 'BORROWER';
  status:
    | 'CREATED'
    | 'WAITING_FOR_USER'
    | 'PROCESSING'
    | 'SIGNED'
    | 'CANCELED'
    | 'FAILED';
  providerSignId: number | null;
  qrCode: string | null;
  launchLink: string | null;
  expireAt: string | null;
  error: string | null;
  signedAt: string | null;
};

const activeStatuses = new Set(['CREATED', 'WAITING_FOR_USER', 'PROCESSING']);

export function SignaturePanel({
  loan,
  agreement,
  onChanged,
}: {
  loan: LoanSigningState;
  agreement: AgreementDocument;
  onChanged: () => Promise<void> | void;
}) {
  const [me, setMe] = useState<Me | null>(null);
  const [signatures, setSignatures] = useState<SignatureRecord[]>([]);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth) return;
    const [currentUser, items] = await Promise.all([
      api<Me>('/me', {}, auth.accessToken),
      api<SignatureRecord[]>(
        `/documents/${agreement.id}/signatures`,
        {},
        auth.accessToken,
      ),
    ]);
    setMe(currentUser);
    setSignatures(items);
  }, [agreement.id]);

  useEffect(() => {
    void load().catch((requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить подписи',
      );
    });
  }, [load]);

  const myRole = useMemo(() => {
    if (!me) return null;
    if (loan.lenderId === me.id) return 'LENDER' as const;
    if (loan.borrowerId === me.id) return 'BORROWER' as const;
    return null;
  }, [loan.borrowerId, loan.lenderId, me]);

  const myLatest = useMemo(
    () =>
      [...signatures]
        .reverse()
        .find((signature) => signature.userId === me?.id),
    [me?.id, signatures],
  );

  const myTurn =
    (loan.status === 'WAITING_LENDER_SIGNATURE' && myRole === 'LENDER') ||
    (loan.status === 'WAITING_BORROWER_SIGNATURE' && myRole === 'BORROWER');

  useEffect(() => {
    if (!myLatest || !activeStatuses.has(myLatest.status)) return;

    const timer = window.setInterval(async () => {
      const auth = getAuth();
      if (!auth) return;
      try {
        const updated = await api<SignatureRecord>(
          `/signatures/${myLatest.id}/status`,
          {},
          auth.accessToken,
        );
        setSignatures((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        );
        if (!activeStatuses.has(updated.status)) {
          await onChanged();
          await load();
        }
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Не удалось проверить подпись',
        );
      }
    }, 2500);

    return () => window.clearInterval(timer);
  }, [load, myLatest, onChanged]);

  async function start() {
    const auth = getAuth();
    if (!auth) return;
    setStarting(true);
    setError('');
    try {
      const signature = await api<SignatureRecord>(
        `/documents/${agreement.id}/signatures/start`,
        { method: 'POST' },
        auth.accessToken,
      );
      setSignatures((current) => [...current, signature]);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось начать подписание',
      );
    } finally {
      setStarting(false);
    }
  }

  if (loan.status === 'SIGNED' || agreement.status === 'SIGNED') {
    return (
      <Card className="mt-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <CheckCircle2 size={19} />
          </div>
          <div>
            <h2 className="font-semibold">Договор подписан обеими сторонами</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Следующий этап — подтверждение фактической передачи денег.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const active = myLatest && activeStatuses.has(myLatest.status) ? myLatest : null;

  return (
    <Card className="mt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Подписание через eGov Mobile</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Сначала подписывает заимодатель, затем заёмщик. Dolg.kz не получает и не хранит закрытый ключ ЭЦП.
          </p>
        </div>
        {myTurn && !active && myLatest?.status !== 'SIGNED' ? (
          <Button onClick={start} disabled={starting}>
            {starting ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Запускаем…
              </>
            ) : (
              <>
                <Smartphone className="mr-2" size={16} />
                Подписать через eGov
              </>
            )}
          </Button>
        ) : null}
      </div>

      {!myTurn && loan.status === 'WAITING_LENDER_SIGNATURE' ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-[var(--muted)]">
          Ожидаем подпись заимодателя.
        </p>
      ) : null}

      {!myTurn && loan.status === 'WAITING_BORROWER_SIGNATURE' ? (
        <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-[var(--muted)]">
          Заимодатель подписал договор. Ожидаем подпись заёмщика.
        </p>
      ) : null}

      {active ? (
        <div className="mt-5 grid gap-5 rounded-2xl border border-[var(--border)] p-5 md:grid-cols-[220px_1fr]">
          <div className="flex items-center justify-center rounded-xl bg-white p-3">
            {active.qrCode ? (
              <img
                src={`data:image/png;base64,${active.qrCode}`}
                alt="QR для подписания через eGov Mobile"
                className="h-48 w-48"
              />
            ) : (
              <Loader2 className="animate-spin" />
            )}
          </div>
          <div>
            <p className="font-semibold">Подтвердите подпись в eGov Mobile</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              На компьютере отсканируйте QR камерой внутри eGov Mobile. На телефоне можно открыть приложение по кнопке ниже.
            </p>
            {active.launchLink ? (
              <Button asChild className="mt-4">
                <a href={active.launchLink}>Открыть eGov Mobile</a>
              </Button>
            ) : null}
            <p className="mt-4 text-xs text-[var(--muted)]">
              Статус: {active.status}. Проверяем автоматически.
            </p>
          </div>
        </div>
      ) : null}

      {myLatest?.status === 'SIGNED' ? (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          Ваша подпись зарегистрирована.
        </div>
      ) : null}

      {myLatest?.status === 'FAILED' || myLatest?.status === 'CANCELED' ? (
        <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {myLatest.error || 'Операция была отменена. Можно запустить подписание повторно.'}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </Card>
  );
}
