import React, { useMemo } from 'react';
import { useAppSettings } from '../../features/settings/hooks/useAppSettings';
import { useSeason } from './useSeason';

const FLAKE_COUNT = 30;

/** Pseudoaleatorio con semilla: los copos quedan siempre en el mismo sitio (sin saltos al volver a renderizar). */
function seeded(seed: number) {
  let t = seed;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Nieve suave para la temporada navideña. Va en la capa del fondo (detrás de las tarjetas), así
 * que nunca tapa el texto.
 * - Solo anima `transform`, que la GPU mueve sin recalcular la página.
 * - Desaparece con "reducir movimiento" del sistema y con el Modo Ultra Fluidez.
 */
export const SeasonalSnowfall: React.FC = () => {
  const season = useSeason();
  const { settings } = useAppSettings();

  const flakes = useMemo(() => {
    const random = seeded(2512);
    return Array.from({ length: FLAKE_COUNT }, (_, i) => {
      const size = 3 + random() * 4.5;
      const duration = 11 + random() * 13;
      return {
        id: i,
        left: `${random() * 100}%`,
        size,
        duration,
        // Retraso negativo: al abrir la app ya está nevando, sin esperar a que caigan desde arriba
        delay: -random() * duration,
        drift: `${Math.round((random() - 0.5) * 80)}px`,
        opacity: 0.35 + random() * 0.4,
      };
    });
  }, []);

  if (season !== 'christmas' || settings.performanceMode) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ contain: 'strict' }}>
      {flakes.map((flake) => (
        <span
          key={flake.id}
          className="season-snowflake bg-[var(--color-md-primary)] dark:bg-white"
          style={
            {
              left: flake.left,
              width: flake.size,
              height: flake.size,
              opacity: flake.opacity,
              animationDuration: `${flake.duration}s`,
              animationDelay: `${flake.delay}s`,
              '--snow-drift': flake.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};
