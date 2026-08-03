type PlaceholderPageProps = {
  title: string
  description?: string
}

export function PlaceholderPage({
  title,
  description = 'Este módulo llegará en un próximo paso. La navegación y el shell ya están listos.',
}: PlaceholderPageProps) {
  return (
    <section className="max-w-3xl">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
          {title}
        </h1>
        <p className="max-w-prose text-sm leading-relaxed text-muted-foreground md:text-base">
          {description}
        </p>
      </header>

      <div className="mt-8 rounded-lg border border-border bg-card p-5 md:p-6">
        <p className="text-sm font-medium text-foreground">Próximamente</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Feature step — sin widgets de relleno. Cuando el módulo esté listo,
          esta vista se sustituye por el flujo real.
        </p>
      </div>
    </section>
  )
}
