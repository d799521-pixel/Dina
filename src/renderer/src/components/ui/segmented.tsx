import { cn } from '@/lib/utils'

/** Groupe de boutons exclusifs (type « onglets »). */
export function Segmented<T extends string | number>({
  value,
  onChange,
  options,
  className
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: React.ReactNode; title?: string }[]
  className?: string
}): React.JSX.Element {
  return (
    <div className={cn('inline-flex rounded-lg border bg-muted p-0.5', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors [&_svg]:size-4',
            o.value === value ? 'bg-card font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
