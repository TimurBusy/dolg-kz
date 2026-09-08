'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, apiBlob } from '@/lib/api';
import { getAuth } from '@/lib/auth-store';

type Loan = {
  id: string;
  number: string;
  borrowerPhone: string;
  principalAmount: number;
  remainingAmount: number;
  dueDate: string;
  status: string;
  terms?: {
    purpose?: string | null;
    comment?: string | null;
  };
};

type DocumentRecord = {
  id: string;
  loanId: string;
  type: string;
  version: number;
  sha256Hash: string;
  status: string;
  lockedAt: string | null;
  createdAt: string;
};

export default function LoanPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const auth = getAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      const [loanData, documentData] = await Promise.all([
        api<Loan>(`/loans/${id}`, {}, auth.accessToken),
        api<DocumentRecord[]>(`/loans/${id}/documents`, {}, auth.accessToken),
      ]);
      setLoan(loanData);
      setDocuments(documentData);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось загрузить займ',
      );
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function generateAgreement() {
    const auth = getAuth();
    if (!auth) return router.push('/login');

    setGenerating(true);
    setError('');
    try {
      await api<DocumentRecord>(
        `/loans/${id}/documents/generate`,
        { method: 'POST' },
        auth.accessToken,
      );
      await load();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось сформировать договор',
      );
    } finally {
      setGenerating(false);
    }
  }

  async function openDocument(document: DocumentRecord) {
    const auth = getAuth();
    if (!auth) return router.push('/login');

    setOpeningId(document.id);
    setError('');
    try {
      const blob = await apiBlob(
        `/documents/${document.id}/file`,
        {},
        auth.accessToken,
      );
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось открыть документ',
      );
    } finally {
      setOpeningId(null);
    }
  }

  if (loading || !loan) {
    return (
      <AppShell>
        <div className="p-8 text-sm text-[var(--muted)]">Загрузка…</div>
      </AppShell>
    );
  }

  const agreement = documents.find((document) => document.type === 'LOAN_AGREEMENT');

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-4 pb-24 md:p-8">
        <p className="text-sm font-medium text-[var(--muted)]">{loan.number}</p>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">
              {loan.principalAmount.toLocaleString('ru-RU')} ₸
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Заёмщик {loan.borrowerPhone}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold">
            {loan.status}
          </span>
        </div>

        <Card className="mt-6 grid gap-5 md:grid-cols-2">
          <div>
            <p className="text-sm text-[var(--muted)]">Остаток</p>
            <p className="mt-1 text-lg font-semibold">
              {loan.remainingAmount.toLocaleString('ru-RU')} ₸
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Вернуть до</p>
            <p className="mt-1 text-lg font-semibold">
              {new Date(loan.dueDate).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Тип</p>
            <p className="mt-1 font-medium">Беспроцентный</p>
          </div>
          <div>
            <p className="text-sm text-[var(--muted)]">Назначение</p>
            <p className="mt-1 font-medium">
              {loan.terms?.purpose || 'Не указано'}
            </p>
          </div>
        </Card>

        <Card className="mt-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold">Документы</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                PDF хранится в защищённом объектном хранилище, а его SHA-256
                фиксируется в базе.
              </p>
            </div>
            {!agreement && loan.status === 'DRAFT' ? (
              <Button onClick={generateAgreement} disabled={generating}>
                {generating ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={16} />
                    Формируем…
                  </>
                ) : (
                  'Сформировать договор'
                )}
              </Button>
            ) : null}
          </div>

          {error ? (
            <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {documents.length === 0 ? (
            <div className="mt-5 rounded-xl bg-gray-50 p-4 text-sm text-[var(--muted)]">
              Документов пока нет. Для финального договора обе стороны должны
              зарегистрироваться и заполнить ФИО + ИИН.
            </div>
          ) : (
            <div className="mt-5 space-y-3">
              {documents.map((document) => (
                <button
                  key={document.id}
                  type="button"
                  onClick={() => void openDocument(document)}
                  className="flex w-full items-center justify-between gap-4 rounded-xl border border-[var(--border)] p-4 text-left transition hover:bg-gray-50"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl bg-gray-100 p-2.5">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium">
                        {document.type === 'LOAN_AGREEMENT'
                          ? 'Договор займа'
                          : document.type}
                        {' · '}v{document.version}
                      </p>
                      <p className="mt-1 truncate text-xs text-[var(--muted)]">
                        SHA-256 {document.sha256Hash}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-[var(--muted)]">
                    {openingId === document.id ? 'Открываем…' : document.status}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>

        {loan.status === 'WAITING_LENDER_SIGNATURE' ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Договор сформирован. Следующий шаг — подключить подпись
            заимодателя через eGov/SIGEX.
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
