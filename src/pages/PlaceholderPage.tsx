type PlaceholderPageProps = {
  title: string
}

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <section className="rounded-xl border border-primary/10 bg-card/80 p-6 shadow-xl backdrop-blur-xl md:p-8">
      <div className="absolute" />
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h1>
      <p className="mt-2 text-muted-foreground">
        Próximamente — feature step
      </p>
    </section>
  )
}
