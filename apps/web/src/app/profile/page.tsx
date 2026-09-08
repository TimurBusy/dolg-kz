'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { clearAuth, getAuth } from '@/lib/auth-store';

type Me = {
  id: string;
  phone: string;
  email: string | null;
  identity: null | {
    firstName: string | null;
    lastName: string | null;
    middleName: string | null;
    birthDate: string | null;
    iinMasked: string | null;
    verificationStatus: string;
  };
};

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    email: '',
    iin: '',
    birthDate: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get('returnTo');
    if (candidate?.startsWith('/') && !candidate.startsWith('//')) {
      setReturnTo(candidate);
    }

    const auth = getAuth();
    if (!auth) {
      router.replace('/login');
      return;
    }

    api<Me>('/me', {}, auth.accessToken)
      .then((data) => {
        setMe(data);
        setForm((old) => ({
          ...old,
          firstName: data.identity?.firstName ?? '',
          lastName: data.identity?.lastName ?? '',
          middleName: data.identity?.middleName ?? '',
          email: data.email ?? '',
          birthDate: data.identity?.birthDate?.slice(0, 10) ?? '',
        }));
      })
      .catch(() => {
        clearAuth();
        router.replace('/login');
      });
  }, [router]);

  async function save(event: FormEvent) {
    event.preventDefault();
    const auth = getAuth();
    if (!auth) return;

    setError('');
    setMessage('');

    try {
      const body = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ''),
      );
      const updated = await api<Me>(
        '/me',
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        },
        auth.accessToken,
      );
      setMe(updated);
      setForm((current) => ({ ...current, iin: '' }));
      setMessage('Профиль сохранён');

      if (returnTo) {
        router.push(returnTo);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Ошибка сохранения',
      );
    }
  }

  function logout() {
    clearAuth();
    router.push('/login');
  }

  const fields = [
    ['lastName', 'Фамилия'],
    ['firstName', 'Имя'],
    ['middleName', 'Отчество'],
    ['email', 'Email'],
    ['birthDate', 'Дата рождения'],
    ['iin', me?.identity?.iinMasked ? `ИИН (${me.identity.iinMasked})` : 'ИИН'],
  ] as const;

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-3xl p-4 pb-24 md:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Профиль</h1>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {me?.phone ?? 'Загрузка…'}
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            Выйти
          </Button>
        </div>

        {returnTo ? (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Заполните ФИО и ИИН, чтобы продолжить оформление займа.
          </div>
        ) : null}

        <Card>
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold">Личные данные</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                ИИН хранится зашифрованно и после сохранения показывается маской.
              </p>
            </div>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
              {me?.identity?.verificationStatus ?? 'UNVERIFIED'}
            </span>
          </div>

          <form onSubmit={save} className="grid gap-4 md:grid-cols-2">
            {fields.map(([name, label]) => (
              <label key={name} className="block text-sm font-medium">
                {label}
                <input
                  type={
                    name === 'birthDate'
                      ? 'date'
                      : name === 'email'
                        ? 'email'
                        : 'text'
                  }
                  value={form[name]}
                  onChange={(event) =>
                    setForm({ ...form, [name]: event.target.value })
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[var(--border)] bg-white px-3 outline-none focus:border-black"
                  maxLength={name === 'iin' ? 12 : undefined}
                />
              </label>
            ))}

            <div className="md:col-span-2">
              {message ? (
                <p className="mb-3 text-sm text-emerald-700">{message}</p>
              ) : null}
              {error ? (
                <p className="mb-3 text-sm text-red-700">{error}</p>
              ) : null}
              <Button>Сохранить</Button>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
