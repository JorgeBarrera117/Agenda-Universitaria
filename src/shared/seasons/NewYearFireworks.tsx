import React, { useMemo } from 'react';
import { seededRandom } from './seededRandom';

/**
 * Colores festivos fijos (dorado, naranja, rosa y celeste) más el primario del tema.
 * Son adorno, no interfaz, y van detrás de las tarjetas.
 */
const COLORS = ['#FFB300', '#FF7043', '#EC407A', '#26C6DA', 'var(--color-md-primary)'];

const BURSTS = 5;
const RAYS = 12;
const EMBERS = 18;

/**
 * Fuegos artificiales y chispas de fogata para el fin de año (la quema del año viejo).
 * - Cada estallido ocupa el primer tramo de su ciclo y luego espera. Como los ciclos duran
 *   distinto, las explosiones nunca coinciden igual.
 * - Las chispas suben desde abajo, como de una fogata.
 * Solo se animan transform y opacity, en la capa del fondo.
 */
export const NewYearFireworks: React.FC = () => {
  const { bursts, embers } = useMemo(() => {
    const random = seededRandom(3112);
    return {
      bursts: Array.from({ length: BURSTS }, (_, i) => ({
        id: i,
        left: `${8 + random() * 84}%`,
        top: `${8 + random() * 52}%`,
        radius: 46 + random() * 44,
        cycle: 6.5 + random() * 5,
        delay: random() * 6,
        color: COLORS[i % COLORS.length],
      })),
      embers: Array.from({ length: EMBERS }, (_, i) => {
        const duration = 6 + random() * 7;
        return {
          id: i,
          left: `${random() * 100}%`,
          size: 2.5 + random() * 3,
          duration,
          delay: -random() * duration,
          drift: `${Math.round((random() - 0.5) * 120)}px`,
          color: random() > 0.5 ? '#FFB300' : '#FF7043',
        };
      }),
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden" style={{ contain: 'strict' }}>
      {bursts.map((burst) => (
        <span key={burst.id} className="absolute" style={{ left: burst.left, top: burst.top }}>
          <span
            className="season-firework-flash"
            style={{ backgroundColor: burst.color, animationDuration: `${burst.cycle}s`, animationDelay: `${burst.delay}s` }}
          />
          {Array.from({ length: RAYS }, (_, ray) => (
            <span
              key={ray}
              className="season-firework-spark"
              style={
                {
                  backgroundColor: burst.color,
                  animationDuration: `${burst.cycle}s`,
                  animationDelay: `${burst.delay}s`,
                  '--spark-angle': `${(ray * 360) / RAYS}deg`,
                  '--spark-distance': `${-burst.radius}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </span>
      ))}

      {embers.map((ember) => (
        <span
          key={ember.id}
          className="season-ember"
          style={
            {
              left: ember.left,
              width: ember.size,
              height: ember.size,
              backgroundColor: ember.color,
              // El resplandor (box-shadow con currentColor) toma este color
              color: ember.color,
              animationDuration: `${ember.duration}s`,
              animationDelay: `${ember.delay}s`,
              '--ember-drift': ember.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
};
