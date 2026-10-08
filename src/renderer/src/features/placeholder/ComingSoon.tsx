export function ComingSoon({ title, items }: { title: string; items: string[] }): React.JSX.Element {
  return (
    <div className="p-10">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Module prévu à la prochaine étape — le schéma de base de données est déjà en place.
      </p>
      <ul className="mt-6 list-disc space-y-1 pl-5 text-sm">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  )
}
