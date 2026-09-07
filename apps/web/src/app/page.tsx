import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';

const loans = [
  { name: 'Данияр С.', amount: '500 000 ₸', due: 'до 10 декабря', status: 'active' as const },
  { name: 'Алибек К.', amount: '200 000 ₸', due: 'просрочено 8 дней', status: 'overdue' as const },
];

export default function HomePage() {
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
        <section className="grid gap-4 md:grid-cols-2">
          <Card><p className="text-sm text-[var(--muted)]">Мне должны</p><p className="mt-2 text-3xl font-semibold tracking-tight">850 000 ₸</p><p className="mt-2 text-sm text-[var(--muted)]">2 активных договора</p></Card>
          <Card><p className="text-sm text-[var(--muted)]">Я должен</p><p className="mt-2 text-3xl font-semibold tracking-tight">120 000 ₸</p><p className="mt-2 text-sm text-[var(--muted)]">1 активный договор</p></Card>
        </section>
        <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Активные договоры</h2><button className="text-sm font-medium text-[var(--muted)]">Все договоры</button></div><div className="grid gap-3">{loans.map((loan)=><Card key={loan.name} className="flex items-center justify-between gap-4"><div><p className="font-medium">{loan.name}</p><p className="mt-1 text-xl font-semibold">{loan.amount}</p><p className="mt-1 text-sm text-[var(--muted)]">{loan.due}</p></div><StatusBadge status={loan.status}/></Card>)}</div></section>
      </div>
    </AppShell>
  );
}
