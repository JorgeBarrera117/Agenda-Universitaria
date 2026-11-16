import React, { useMemo } from 'react';
import { seededRandom } from './seededRandom';

const FLAKE_COUNT = 30;

/**
 * Nieve suave para Navidad. Va en la capa del fondo (detrás de las tarjetas), así que nunca tapa
 * el texto. Solo anima `transform`, que la GPU mueve sin recalcular la página.
 */
export const SeasonalSnowfall: React.FC = () => {
  const flakes = useMemo(() => {
    const random = seededRandom(2512);
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
