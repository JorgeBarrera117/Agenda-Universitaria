const PLACEHOLDER_CARDS = ['card-1', 'card-2', 'card-3'];

/** Esqueleto de carga para las vistas diferidas con React.lazy. */
export function ViewSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando sección" className="w-full space-y-4 py-2">
      <div className="h-8 w-2/5 max-w-xs rounded-xl bg-[var(--color-md-surface-container-high)] motion-safe:animate-pulse" />
      <div className="h-4 w-3/5 max-w-md rounded-lg bg-[var(--color-md-surface-container)] motion-safe:animate-pulse" />
      <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2 lg:grid-cols-3">
        {PLACEHOLDER_CARDS.map((key) => (
          <div
            key={key}
            className="h-28 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] motion-safe:animate-pulse"
          />
        ))}
      </div>
    </div>
  );
}
