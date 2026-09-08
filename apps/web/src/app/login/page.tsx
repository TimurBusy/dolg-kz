'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { saveAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type VerifyResponse = {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('+7');
  const [code, setCode] = useState('');
  const [returnTo, setReturnTo] = useState('/profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get('returnTo');
    if (candidate?.startsWith('/') && !candidate.startsWith('//')) {
      setReturnTo(candidate);
    }
  }, []);

  async function requestCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
      });
      setStep('code');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Не удалось отправить код',
      );
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await api<VerifyResponse>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, code }),
      });
      saveAuth(result);
      router.push(returnTo);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Неверный код',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md p-7">
        <div className="mb-7">
          <p className="text-xl font-bold">Dolg.kz</p>
          <h1 className="mt-5 text-2xl font-semibold">
            {step === 'phone' ? 'Вход' : 'Введите код'}
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {step === 'phone'
              ? 'Укажите номер телефона Казахстана.'
              : `Код отправлен на ${phone}`}
          </p>
        </div>

        {step === 'phone' ? (
          <form onSubmit={requestCode} className="space-y-4">
            <label className="block text-sm font-medium">
              Телефон
              <input
                value={phone}
                onChange={(event) =>
                  setPhone(event.target.value.replace(/[^+\d]/g, ''))
                }
                placeholder="+77771234567"
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 outline-none focus:border-black"
                inputMode="tel"
                required
              />
            </label>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <Button className="w-full" disabled={loading}>
              {loading ? 'Отправляем…' : 'Получить код'}
            </Button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <label className="block text-sm font-medium">
              Код из SMS
              <input
                value={code}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                className="mt-2 h-12 w-full rounded-xl border border-[var(--border)] bg-white px-4 text-center text-xl tracking-[0.4em] outline-none focus:border-black"
                inputMode="numeric"
                required
              />
            </label>

            {error ? <p className="text-sm text-red-700">{error}</p> : null}

            <Button className="w-full" disabled={loading || code.length !== 6}>
              {loading ? 'Проверяем…' : 'Войти'}
            </Button>

            <button
              type="button"
              className="w-full text-sm text-[var(--muted)]"
              onClick={() => setStep('phone')}
            >
              Изменить номер
            </button>
          </form>
        )}

        <p className="mt-6 text-xs leading-5 text-[var(--muted)]">
          В development-режиме OTP выводится в консоль API. Реальный SMS-провайдер
          подключается отдельной задачей.
        </p>
      </Card>
    </main>
  );
}
