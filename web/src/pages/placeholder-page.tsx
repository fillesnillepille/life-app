export function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Inte byggt än.</p>
    </section>
  )
}
