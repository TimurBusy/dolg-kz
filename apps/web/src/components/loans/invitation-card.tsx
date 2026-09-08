'use client';

import { Check, Copy, Link2, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getAuth } from '@/lib/auth-store';

type InvitationResponse =
  | {
      linked: true;
      borrowerId: string;
      message: string;
    }
  | {
      linked: false;
      token: string;
      invitation: {
        id: string;
        status: string;
        expiresAt: string;
      };
    };

export function InvitationCard({
  loanId,
  borrowerId,
  status,
  onLinked,
}: {
  loanId: string;
  borrowerId: string | null;
  status: string;
  onLinked: () => void;
}) {
  const [link, setLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  async function createInvitation() {
    const auth = getAuth();
    if (!auth) return;

    setLoading(true);
    setError('');
    try {
      const result = await api<InvitationResponse>(
        `/loans/${loanId}/invitations`,
        { method: 'POST' },
        auth.accessToken,
      );

      if (result.linked) {
        onLinked();
        return;
      }

      setLink(`${window.location.origin}/invite/${result.token}`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось создать приглашение',
      );
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  if (borrowerId) {
    return (
      <Card className="mt-5">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700">
            <Check size={18} />
          </div>
          <div>
            <p className="font-semibold">Заёмщик подключён</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Можно формировать финальный договор, если обе стороны заполнили ФИО и ИИН.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (status !== 'DRAFT') return null;

  return (
    <Card className="mt-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold">Пригласить заёмщика</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Отправьте ему ссылку. После входа с указанного номера он будет связан с этим займом.
          </p>
        </div>
        {!link ? (
          <Button onClick={createInvitation} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={16} />
                Создаём…
              </>
            ) : (
              <>
                <Link2 className="mr-2" size={16} />
                Создать приглашение
              </>
            )}
          </Button>
        ) : null}
      </div>

      {link ? (
        <div className="mt-5 rounded-xl bg-gray-50 p-4">
          <p className="text-xs font-medium text-[var(--muted)]">
            Ссылка действует 7 дней
          </p>
          <p className="mt-2 break-all text-sm font-medium">{link}</p>
          <Button className="mt-3" variant="outline" onClick={copy}>
            {copied ? <Check className="mr-2" size={16} /> : <Copy className="mr-2" size={16} />}
            {copied ? 'Скопировано' : 'Скопировать ссылку'}
          </Button>
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
