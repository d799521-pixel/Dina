import { cn } from '@/lib/utils'

const field =
  'w-full rounded-md border border-input bg-card px-3 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'

export function Input({ className, ...props }: React.ComponentProps<'input'>): React.JSX.Element {
  return <input className={cn(field, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>): React.JSX.Element {
  return <textarea className={cn(field, 'min-h-20 py-2', className)} {...props} />
}

export function Select({ className, ...props }: React.ComponentProps<'select'>): React.JSX.Element {
  return <select className={cn(field, 'h-9 pr-8', className)} {...props} />
}

export function Label({ className, ...props }: React.ComponentProps<'label'>): React.JSX.Element {
  return <label className={cn('text-sm font-medium', className)} {...props} />
}

/** Libellé + champ, empilés. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}
