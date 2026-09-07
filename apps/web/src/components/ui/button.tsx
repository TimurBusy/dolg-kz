import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';
const buttonVariants=cva('inline-flex items-center justify-center rounded-xl text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50',{variants:{variant:{default:'bg-black text-white hover:bg-black/85',outline:'border border-[var(--border)] bg-white hover:bg-gray-50',ghost:'hover:bg-gray-100'},size:{default:'h-11 px-4',sm:'h-9 px-3',lg:'h-12 px-5'}},defaultVariants:{variant:'default',size:'default'}});
type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof buttonVariants>&{asChild?:boolean};
export function Button({className,variant,size,asChild=false,...props}:ButtonProps){const Comp=asChild?Slot:'button';return <Comp className={cn(buttonVariants({variant,size}),className)} {...props}/>}
