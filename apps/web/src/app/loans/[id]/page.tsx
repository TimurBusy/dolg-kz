'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { getAuth } from '@/lib/auth-store';

type Loan={id:string;number:string;borrowerPhone:string;principalAmount:number;remainingAmount:number;dueDate:string;status:string;terms?:{purpose?:string|null;comment?:string|null}};
export default function LoanPage(){const {id}=useParams<{id:string}>();const router=useRouter();const [loan,setLoan]=useState<Loan|null>(null);useEffect(()=>{const auth=getAuth();if(!auth)return router.replace('/login');api<Loan>(`/loans/${id}`,{},auth.accessToken).then(setLoan)},[id,router]);if(!loan)return <AppShell><div className="p-8 text-sm text-[var(--muted)]">Загрузка…</div></AppShell>;return <AppShell><div className="mx-auto w-full max-w-3xl p-4 pb-24 md:p-8"><p className="text-sm font-medium text-[var(--muted)]">{loan.number}</p><div className="mt-2 flex items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">{loan.principalAmount.toLocaleString('ru-RU')} ₸</h1><p className="mt-2 text-sm text-[var(--muted)]">Заёмщик {loan.borrowerPhone}</p></div><span className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold">{loan.status}</span></div><Card className="mt-6 grid gap-5 md:grid-cols-2"><div><p className="text-sm text-[var(--muted)]">Остаток</p><p className="mt-1 text-lg font-semibold">{loan.remainingAmount.toLocaleString('ru-RU')} ₸</p></div><div><p className="text-sm text-[var(--muted)]">Вернуть до</p><p className="mt-1 text-lg font-semibold">{new Date(loan.dueDate).toLocaleDateString('ru-RU')}</p></div><div><p className="text-sm text-[var(--muted)]">Тип</p><p className="mt-1 font-medium">Беспроцентный</p></div><div><p className="text-sm text-[var(--muted)]">Назначение</p><p className="mt-1 font-medium">{loan.terms?.purpose||'Не указано'}</p></div></Card><div className="mt-5 flex flex-wrap gap-3"><Button disabled>Сформировать договор</Button><Button variant="outline" disabled>История</Button></div><p className="mt-3 text-xs text-[var(--muted)]">Кнопка генерации PDF активируется в следующем модуле Documents.</p></div></AppShell>}
