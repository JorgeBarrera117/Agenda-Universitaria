import type { WallpaperStyle } from '../../features/settings/types';

/**
 * Catálogo de papeles tapiz vectoriales.
 *
 * Cada patrón es un SVG que se repite sin costuras. Se dibuja en negro y se usa como máscara
 * (`mask-image`) sobre `background-color: var(--color-md-primary)`, así que toma solo el color
 * del tema Material You, en claro y en oscuro.
 *
 * Para añadir uno:
 * 1. Agregar su id a `WallpaperStyle`.
 * 2. Agregar aquí su entrada, con su categoría.
 * Los elementos no deben cruzar el borde del mosaico, salvo las líneas que continúan en el
 * mosaico vecino.
 */

export type PatternWallpaperId = Exclude<WallpaperStyle, 'custom' | 'none'>;

export type WallpaperCategory = 'study' | 'geometric' | 'nature' | 'tech';

export const WALLPAPER_CATEGORIES: { id: WallpaperCategory | 'personal'; label: string }[] = [
  { id: 'study', label: 'Estudio' },
  { id: 'geometric', label: 'Geométricos' },
  { id: 'nature', label: 'Naturaleza' },
  { id: 'tech', label: 'Tecnología' },
  { id: 'personal', label: 'Mi foto y liso' },
];

export interface WallpaperPattern {
  label: string;
  category: WallpaperCategory;
  /** Ancho del mosaico en px (a escala 100 %). */
  width: number;
  /** Alto del mosaico; si falta, es cuadrado. */
  height?: number;
  svg: string;
}

const svg = (width: number, height: number, attrs: string, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" ${attrs}>${body}</svg>`;

const STROKE = 'fill="none" stroke="black" stroke-linecap="round" stroke-linejoin="round"';

/** Estrella de cuatro puntas centrada en (x, y). */
const sparkle = (x: number, y: number, r: number) =>
  `<path d="M${x} ${y - r}L${x + r * 0.25} ${y - r * 0.25}L${x + r} ${y}L${x + r * 0.25} ${y + r * 0.25}L${x} ${y + r}L${x - r * 0.25} ${y + r * 0.25}L${x - r} ${y}L${x - r * 0.25} ${y - r * 0.25}Z" fill="black" stroke="none"/>`;

export const WALLPAPER_PATTERNS: Record<PatternWallpaperId, WallpaperPattern> = {
  /* ------------------------------------------------------------------ Estudio */
  campus: {
    label: 'Campus',
    category: 'study',
    width: 220,
    svg: svg(
      220,
      220,
      'fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"',
      `<g transform="translate(18, 20) rotate(-10)">
        <path d="M22 10L2 20L22 30L42 20L22 10Z"/>
        <path d="M8 23V34C8 38 14 42 22 42C30 42 36 38 36 34V23"/>
        <path d="M40 21V35"/>
      </g>
      <g transform="translate(135, 18) rotate(12)">
        <ellipse cx="22" cy="22" rx="20" ry="8" transform="rotate(30 22 22)"/>
        <ellipse cx="22" cy="22" rx="20" ry="8" transform="rotate(-30 22 22)"/>
        <circle cx="22" cy="22" r="3" fill="black"/>
      </g>
      <g transform="translate(78, 72) rotate(-6)">
        <polyline points="12 8 2 18 12 28"/>
        <polyline points="32 8 42 18 32 28"/>
        <line x1="25" y1="4" x2="19" y2="32"/>
      </g>
      <g transform="translate(16, 112) rotate(8)">
        <path d="M4 8C10 6 18 6 22 10C26 6 34 6 40 8V32C34 30 26 30 22 34C18 30 10 30 4 32V8Z"/>
        <line x1="22" y1="10" x2="22" y2="34"/>
      </g>
      <g transform="translate(154, 102) rotate(-8)">
        <path d="M6 12H30V26C30 33 25 38 18 38C11 38 6 33 6 26V12Z"/>
        <path d="M30 15H35C38 15 40 17 40 20C40 23 38 25 35 25H30"/>
        <path d="M13 4C13 7 16 7 16 10"/>
        <path d="M21 4C21 7 24 7 24 10"/>
      </g>
      <g transform="translate(86, 152) rotate(10)">
        <path d="M14 28H26"/>
        <path d="M16 33H24"/>
        <path d="M12 20C9 17 8 12 11 8C14 4 20 3 25 5C30 7 32 13 29 18C28 20 26 22 26 24H14C14 22 13 21 12 20Z"/>
      </g>
      <g transform="translate(26, 178) rotate(-14)">
        <path d="M14 4C10 4 9 8 9 14V24C9 30 8 34 4 34"/>
        <text x="16" y="25" font-family="monospace" font-size="14" stroke-width="1">dx</text>
      </g>
      <g transform="translate(152, 174) rotate(6)">
        <rect x="4" y="8" width="34" height="22" rx="4"/>
        <circle cx="21" cy="19" r="4"/>
        <path d="M18 23L15 34L21 31L27 34L24 23"/>
      </g>
      <path d="M95 25L97 31L103 33L97 35L95 41L93 35L87 33L93 31Z" stroke-width="1.3"/>
      <path d="M198 68L200 73L205 75L200 77L198 82L196 77L191 75L196 73Z" stroke-width="1.3"/>
      <circle cx="64" cy="132" r="2.2"/>
      <circle cx="136" cy="82" r="2.2"/>
      <circle cx="195" cy="152" r="2.2"/>`
    ),
  },

  // Hoja de cuaderno rayada con los agujeros de la espiral
  notebook: {
    label: 'Cuaderno',
    category: 'study',
    width: 120,
    height: 132,
    svg: svg(
      120,
      132,
      STROKE,
      `<path d="M0 22H120M0 44H120M0 66H120M0 88H120M0 110H120M0 132H120" stroke-width="0.9"/>
      <circle cx="10" cy="11" r="3" stroke-width="1.2"/>
      <circle cx="10" cy="77" r="3" stroke-width="1.2"/>`
    ),
  },

  // Símbolos matemáticos dispersos
  math: {
    label: 'Matemáticas',
    category: 'study',
    width: 200,
    svg: svg(
      200,
      200,
      'fill="black" stroke="none" font-family="Georgia, \'Times New Roman\', serif"',
      `<text x="14" y="40" font-size="30" font-style="italic">π</text>
      <text x="96" y="34" font-size="26">Σ</text>
      <text x="152" y="58" font-size="22">∞</text>
      <text x="40" y="96" font-size="22" font-style="italic">√x</text>
      <text x="124" y="110" font-size="28" font-style="italic">∫</text>
      <text x="168" y="140" font-size="20">÷</text>
      <text x="18" y="150" font-size="22">Δ</text>
      <text x="76" y="160" font-size="18" font-style="italic">x²</text>
      <text x="120" y="182" font-size="20">≈</text>
      <text x="60" y="44" font-size="16">+</text>
      <text x="176" y="196" font-size="16" font-style="italic">θ</text>
      <text x="8" y="196" font-size="18">%</text>`
    ),
  },

  // Matraz, molécula de benceno, tubo de ensayo y burbujas
  chemistry: {
    label: 'Química',
    category: 'study',
    width: 200,
    svg: svg(
      200,
      200,
      `${STROKE} stroke-width="1.7"`,
      `<g transform="translate(16 14)">
        <path d="M14 4H30M18 4V18L6 42C4 46 7 50 11 50H33C37 50 40 46 38 42L26 18V4"/>
        <path d="M10 36H34"/>
      </g>
      <g transform="translate(118 20)">
        <path d="M24 0L45 12V36L24 48L3 36V12Z"/>
        <circle cx="24" cy="24" r="10"/>
        <path d="M45 12L58 4M3 36L-6 44"/>
      </g>
      <g transform="translate(84 92) rotate(18)">
        <path d="M8 0V40C8 46 20 46 20 40V0"/>
        <path d="M4 0H24"/>
        <path d="M8 26H20"/>
      </g>
      <g transform="translate(22 118)">
        <circle cx="8" cy="8" r="7"/>
        <circle cx="38" cy="22" r="9"/>
        <circle cx="12" cy="44" r="6"/>
        <path d="M14 11L30 18M34 30L17 40"/>
      </g>
      <g transform="translate(140 132)">
        <circle cx="10" cy="30" r="4"/>
        <circle cx="22" cy="16" r="6"/>
        <circle cx="34" cy="34" r="3"/>
      </g>
      <circle cx="96" cy="182" r="2.2" fill="black"/>
      <circle cx="186" cy="102" r="2.2" fill="black"/>`
    ),
  },

  // Doble hélice de ADN, hoja, célula y gotas
  biology: {
    label: 'Biología',
    category: 'study',
    width: 200,
    svg: svg(
      200,
      200,
      `${STROKE} stroke-width="1.7"`,
      `<g transform="translate(22 12)">
        <path d="M0 0C24 14 24 30 0 44C-24 58 -24 74 0 88" transform="translate(16 0)"/>
        <path d="M0 0C-24 14 -24 30 0 44C24 58 24 74 0 88" transform="translate(16 0)"/>
        <path d="M7 12H25M5 32H27M7 56H25M5 76H27"/>
      </g>
      <g transform="translate(110 24) rotate(-25)">
        <path d="M0 20C12 2 40 2 52 20C40 38 12 38 0 20Z"/>
        <path d="M0 20H52M16 20L26 12M28 20L38 12M16 20L26 28M28 20L38 28"/>
      </g>
      <g transform="translate(108 112)">
        <ellipse cx="32" cy="26" rx="30" ry="24"/>
        <circle cx="38" cy="22" r="8"/>
        <circle cx="18" cy="34" r="2.5" fill="black"/>
        <circle cx="46" cy="38" r="2" fill="black"/>
      </g>
      <g transform="translate(26 132)">
        <path d="M12 0C12 0 0 14 0 22C0 29 5 34 12 34C19 34 24 29 24 22C24 14 12 0 12 0Z"/>
      </g>
      <circle cx="80" cy="120" r="2.2" fill="black"/>
      <circle cx="186" cy="190" r="2.2" fill="black"/>`
    ),
  },

  /* ------------------------------------------------------------------ Geométricos */
  dots: {
    label: 'Puntos',
    category: 'geometric',
    width: 36,
    svg: svg(36, 36, 'fill="black"', `<circle cx="9" cy="9" r="2"/><circle cx="27" cy="27" r="2"/>`),
  },

  // Papel cuadriculado (milimetrado sencillo)
  grid: {
    label: 'Cuadriculado',
    category: 'geometric',
    width: 24,
    svg: svg(24, 24, STROKE, `<path d="M24 0V24H0" stroke-width="0.8"/>`),
  },

  blueprint: {
    label: 'Ingeniería',
    category: 'geometric',
    width: 100,
    svg: svg(
      100,
      100,
      'fill="none"',
      `<path d="M100 0H0V100" stroke="black" stroke-width="1.5"/>
      <path d="M20 0V100M40 0V100M60 0V100M80 0V100M0 20H100M0 40H100M0 60H100M0 80H100" stroke="black" stroke-width="0.6" stroke-dasharray="2 2"/>
      <circle cx="0" cy="0" r="3" stroke="black" stroke-width="1.2"/>
      <circle cx="100" cy="0" r="3" stroke="black" stroke-width="1.2"/>
      <circle cx="0" cy="100" r="3" stroke="black" stroke-width="1.2"/>
      <circle cx="100" cy="100" r="3" stroke="black" stroke-width="1.2"/>
      <path d="M46 50H54M50 46V54" stroke="black" stroke-width="1.2"/>`
    ),
  },

  // Panal de hexágonos (mosaico rectangular clásico)
  hexagons: {
    label: 'Panal',
    category: 'geometric',
    width: 56,
    height: 100,
    svg: svg(56, 100, `${STROKE} stroke-width="1.2"`, `<path d="M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100"/>`),
  },

  // Red de triángulos equiláteros
  triangles: {
    label: 'Triángulos',
    category: 'geometric',
    width: 60,
    height: 52,
    svg: svg(60, 52, `${STROKE} stroke-width="1"`, `<path d="M0 52L30 0L60 52M0 0H60"/>`),
  },

  // Rayado diagonal
  diagonal: {
    label: 'Rayado',
    category: 'geometric',
    width: 24,
    svg: svg(24, 24, 'fill="none" stroke="black" stroke-width="1.1"', `<path d="M-6 6L6 -6M0 24L24 0M18 30L30 18"/>`),
  },

  // Cruces suizas con puntos en las esquinas
  crosses: {
    label: 'Cruces',
    category: 'geometric',
    width: 40,
    svg: svg(
      40,
      40,
      `${STROKE} stroke-width="1.6"`,
      `<path d="M20 14V26M14 20H26"/>
      <circle cx="0" cy="0" r="1.6" fill="black" stroke="none"/>
      <circle cx="40" cy="0" r="1.6" fill="black" stroke="none"/>
      <circle cx="0" cy="40" r="1.6" fill="black" stroke="none"/>
      <circle cx="40" cy="40" r="1.6" fill="black" stroke="none"/>`
    ),
  },

  /* ------------------------------------------------------------------ Naturaleza y espacio */
  topographic: {
    label: 'Relieve',
    category: 'nature',
    width: 180,
    svg: svg(
      180,
      180,
      'fill="none" stroke="black" stroke-width="1.4"',
      `<path d="M0 30C45 10 90 50 135 30C157 20 168 25 180 30"/>
      <path d="M0 65C40 45 85 85 130 65C155 55 168 60 180 65"/>
      <path d="M0 105C50 85 95 125 140 105C160 95 170 100 180 105"/>
      <path d="M0 145C45 125 90 165 135 145C157 135 168 140 180 145"/>
      <ellipse cx="90" cy="85" rx="32" ry="14" transform="rotate(-8 90 85)"/>
      <ellipse cx="90" cy="85" rx="14" ry="6" transform="rotate(-8 90 85)"/>`
    ),
  },

  // Olas paralelas con espuma (los puntos marcan la cresta)
  waves: {
    label: 'Olas',
    category: 'nature',
    width: 80,
    height: 36,
    svg: svg(
      80,
      36,
      `${STROKE} stroke-width="1.4"`,
      `<path d="M0 12C10 4 30 4 40 12S70 20 80 12"/>
      <path d="M0 24C10 16 30 16 40 24S70 32 80 24" stroke-width="0.8"/>
      <circle cx="20" cy="4" r="1.2" fill="black" stroke="none"/>`
    ),
  },

  // Hojas con nervadura
  leaves: {
    label: 'Hojas',
    category: 'nature',
    width: 160,
    svg: svg(
      160,
      160,
      `${STROKE} stroke-width="1.5"`,
      ['translate(14 22) rotate(-30)', 'translate(92 18) rotate(20)', 'translate(48 92) rotate(15)', 'translate(108 104) rotate(-45)']
        .map(
          (t) => `<g transform="${t}">
            <path d="M0 0C10 -12 30 -12 42 0C30 12 10 12 0 0Z"/>
            <path d="M-6 0H34M14 0L20 -5M24 0L30 -5M14 0L20 5M24 0L30 5"/>
          </g>`
        )
        .join('') +
        `<circle cx="80" cy="66" r="2" fill="black"/><circle cx="20" cy="140" r="2" fill="black"/><circle cx="150" cy="70" r="2" fill="black"/>`
    ),
  },

  // Nubes y gotas
  clouds: {
    label: 'Nubes',
    category: 'nature',
    width: 180,
    svg: svg(
      180,
      180,
      `${STROKE} stroke-width="1.6"`,
      ['translate(12 18)', 'translate(100 80) scale(0.8)', 'translate(24 120) scale(0.9)']
        .map(
          (t) => `<g transform="${t}">
            <path d="M12 34H56C63 34 68 29 68 22C68 15 62 10 55 11C53 4 47 0 39 0C31 0 25 5 23 12C21 11 19 11 17 11C9 11 4 17 4 23C4 29 7 34 12 34Z"/>
          </g>`
        )
        .join('') +
        `<path d="M138 26C138 26 132 34 132 38C132 41 135 44 138 44C141 44 144 41 144 38C144 34 138 26 138 26Z"/>
        <path d="M150 148C150 148 145 155 145 158C145 161 147 163 150 163C153 163 155 161 155 158C155 155 150 148 150 148Z"/>
        <circle cx="96" cy="44" r="2" fill="black"/>
        <circle cx="160" cy="112" r="2" fill="black"/>`
    ),
  },

  // Planeta con anillo, luna, estrellas y cometa
  space: {
    label: 'Espacio',
    category: 'nature',
    width: 200,
    svg: svg(
      200,
      200,
      `${STROKE} stroke-width="1.6"`,
      `<g transform="translate(24 24)">
        <circle cx="26" cy="26" r="16"/>
        <ellipse cx="26" cy="26" rx="30" ry="9" transform="rotate(-20 26 26)"/>
      </g>
      <path d="M150 104A18 18 0 1 0 168 128A14 14 0 1 1 150 104Z"/>
      <g transform="translate(40 136)">
        <path d="M0 24L30 6"/>
        <path d="M6 30L34 14" stroke-width="1"/>
        <circle cx="36" cy="4" r="4" fill="black"/>
      </g>
      ${sparkle(132, 30, 9)}
      ${sparkle(100, 90, 6)}
      ${sparkle(176, 176, 7)}
      ${sparkle(26, 104, 5)}
      <circle cx="80" cy="30" r="1.8" fill="black"/>
      <circle cx="178" cy="62" r="1.8" fill="black"/>
      <circle cx="110" cy="160" r="1.8" fill="black"/>
      <circle cx="64" cy="186" r="1.8" fill="black"/>`
    ),
  },

  /* ------------------------------------------------------------------ Tecnología */
  constellation: {
    label: 'Nodos',
    category: 'tech',
    width: 160,
    svg: svg(
      160,
      160,
      'fill="none" stroke="black"',
      `<line x1="24" y1="28" x2="82" y2="52" stroke-width="1.1"/>
      <line x1="82" y1="52" x2="136" y2="26" stroke-width="1.1"/>
      <line x1="82" y1="52" x2="64" y2="118" stroke-width="1.1"/>
      <line x1="24" y1="28" x2="30" y2="96" stroke-width="1.1"/>
      <line x1="30" y1="96" x2="64" y2="118" stroke-width="1.1"/>
      <line x1="64" y1="118" x2="128" y2="106" stroke-width="1.1"/>
      <line x1="136" y1="26" x2="128" y2="106" stroke-width="1.1"/>
      <line x1="128" y1="106" x2="144" y2="146" stroke-width="1.1"/>
      <line x1="64" y1="118" x2="24" y2="148" stroke-width="1.1"/>
      <circle cx="24" cy="28" r="4" fill="black"/>
      <circle cx="82" cy="52" r="5" fill="black"/>
      <circle cx="136" cy="26" r="3.5" fill="black"/>
      <circle cx="30" cy="96" r="3.5" fill="black"/>
      <circle cx="64" cy="118" r="4.5" fill="black"/>
      <circle cx="128" cy="106" r="4" fill="black"/>
      <circle cx="24" cy="148" r="3" fill="black"/>
      <circle cx="144" cy="146" r="3" fill="black"/>`
    ),
  },

  // Código: llaves, etiquetas, terminal y binario
  code: {
    label: 'Código',
    category: 'tech',
    width: 200,
    svg: svg(
      200,
      200,
      'fill="black" stroke="none" font-family="\'Roboto Mono\', Consolas, monospace" font-weight="700"',
      `<text x="12" y="34" font-size="24">{ }</text>
      <text x="112" y="40" font-size="20">&lt;/&gt;</text>
      <text x="56" y="92" font-size="16">01101</text>
      <text x="150" y="104" font-size="22">;</text>
      <text x="16" y="146" font-size="20">( )</text>
      <text x="96" y="160" font-size="18">[ ]</text>
      <text x="150" y="186" font-size="14">=&gt;</text>
      <g transform="translate(20 166)" fill="none" stroke="black" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <rect x="0" y="0" width="44" height="26" rx="4"/>
        <path d="M8 9L13 13L8 17M17 18H24"/>
      </g>`
    ),
  },

  // Placa de circuito: pistas en ángulo recto con sus pads
  circuit: {
    label: 'Circuito',
    category: 'tech',
    width: 140,
    svg: svg(
      140,
      140,
      `${STROKE} stroke-width="1.5"`,
      `<path d="M14 20H50L64 34V64"/>
      <path d="M90 12V40H124"/>
      <path d="M20 72H40L52 84H86"/>
      <path d="M106 64V96L94 108H70"/>
      <path d="M24 108V126H56"/>
      <path d="M120 120H100"/>
      <circle cx="14" cy="20" r="3.5"/>
      <circle cx="64" cy="64" r="3.5"/>
      <circle cx="90" cy="12" r="3.5"/>
      <circle cx="124" cy="40" r="3.5"/>
      <circle cx="20" cy="72" r="3.5"/>
      <circle cx="86" cy="84" r="3.5"/>
      <circle cx="106" cy="64" r="3.5"/>
      <circle cx="70" cy="108" r="3.5"/>
      <circle cx="24" cy="108" r="3.5"/>
      <circle cx="56" cy="126" r="3.5"/>
      <rect x="112" y="114" width="16" height="12" rx="2"/>
      <circle cx="40" cy="44" r="1.8" fill="black"/>
      <circle cx="122" cy="84" r="1.8" fill="black"/>`
    ),
  },
};

/* ------------------------------------------------------------------ Temporadas */

/** Copo de nieve de seis brazos centrado en (x, y). */
const snowflake = (x: number, y: number, r: number) => {
  const b = r * 0.3;
  const arm = `<path d="M0 ${-r}V${r}M${-b} ${-r * 0.82}L0 ${-r * 0.55}L${b} ${-r * 0.82}M${-b} ${r * 0.82}L0 ${r * 0.55}L${b} ${r * 0.82}"/>`;
  return `<g transform="translate(${x} ${y})">${[0, 60, 120].map((a) => `<g transform="rotate(${a})">${arm}</g>`).join('')}</g>`;
};

/**
 * Patrones que la app pone sola durante una temporada (ver shared/seasons). No aparecen en la
 * galería: sustituyen al patrón elegido mientras dura la temporada.
 */
/** Estallido de fuego artificial: rayos y puntas alrededor de (x, y). */
const firework = (x: number, y: number, r: number, rays = 10) =>
  `<g transform="translate(${x} ${y})">${Array.from({ length: rays }, (_, i) => {
    const a = (i * 360) / rays;
    return `<g transform="rotate(${a})"><path d="M0 ${-r * 0.35}V${-r * 0.8}"/><circle cx="0" cy="${-r}" r="${Math.max(1, r * 0.08)}" fill="black" stroke="none"/></g>`;
  }).join('')}</g>`;

/**
 * Año Nuevo en Ecuador:
 * - el año viejo (monigote con sombrero) y la fogata donde se quema a medianoche;
 * - los fuegos artificiales;
 * - las 12 uvas, el reloj marcando las 12 y las copas del brindis.
 */
const NEW_YEAR_PATTERN: Omit<WallpaperPattern, 'category'> = {
  label: 'Año Nuevo',
  width: 220,
  svg: svg(
    220,
    220,
    `${STROKE} stroke-width="1.7"`,
    `<g transform="translate(140 10)">
      <path d="M8 14H40"/>
      <path d="M14 14C14 6 18 2 24 2C30 2 34 6 34 14"/>
      <circle cx="24" cy="22" r="8"/>
      <circle cx="21" cy="21" r="1" fill="black" stroke="none"/>
      <circle cx="27" cy="21" r="1" fill="black" stroke="none"/>
      <path d="M21 25.5C23 27 25 27 27 25.5"/>
      <path d="M14 32H34L36 54H12Z"/>
      <path d="M24 32V54M19 40H21M27 46H29"/>
      <path d="M14 34L2 46M34 34L46 46"/>
      <path d="M17 54L15 68M31 54L33 68"/>
    </g>
    <g transform="translate(18 132)">
      <path d="M22 2C29 10 33 15 30 24C28 30 25 33 21 33C16 33 12 29 11 24C10 18 13 14 16 9C17 14 19 16 21 17C20 11 20 7 22 2Z"/>
      <path d="M21 33C19 29 20 25 23 22C25 26 25 30 23 33"/>
      <path d="M2 44L42 33M2 33L42 44"/>
      <circle cx="8" cy="8" r="1.4" fill="black" stroke="none"/>
      <circle cx="38" cy="4" r="1.2" fill="black" stroke="none"/>
      <circle cx="44" cy="16" r="1" fill="black" stroke="none"/>
    </g>
    ${firework(46, 44, 26, 12)}
    ${firework(110, 110, 16, 9)}
    ${firework(196, 168, 14, 8)}
    <g transform="translate(150 96)">
      <path d="M16 0V6M16 6C16 3 21 1 24 3"/>
      <circle cx="10" cy="12" r="4.5"/><circle cx="19" cy="12" r="4.5"/>
      <circle cx="6" cy="20" r="4.5"/><circle cx="15" cy="20" r="4.5"/><circle cx="24" cy="20" r="4.5"/>
      <circle cx="10" cy="28" r="4.5"/><circle cx="19" cy="28" r="4.5"/>
      <circle cx="14" cy="36" r="4.5"/>
    </g>
    <g transform="translate(78 160)">
      <circle cx="18" cy="18" r="16"/>
      <path d="M18 18V7M18 18V9" stroke-width="2"/>
      <path d="M18 3V5M33 18H31M18 33V31M3 18H5"/>
      <circle cx="18" cy="18" r="1.6" fill="black" stroke="none"/>
    </g>
    <g transform="translate(18 80)">
      <path d="M2 2H16L14 14C13 18 5 18 4 14Z" transform="rotate(-14 9 10)"/>
      <path d="M9 17V28M4 28H14" transform="rotate(-14 9 10)"/>
      <path d="M26 2H40L38 14C37 18 29 18 28 14Z" transform="rotate(14 33 10)"/>
      <path d="M33 17V28M28 28H38" transform="rotate(14 33 10)"/>
      <path d="M18 -4L21 -9M21 -2L26 -5M16 -2L12 -7"/>
    </g>
    ${sparkle(96, 22, 6)}
    ${sparkle(206, 70, 5)}
    ${sparkle(140, 200, 5)}
    <rect x="72" y="70" width="5" height="2.4" rx="1" fill="black" stroke="none" transform="rotate(30 74 71)"/>
    <rect x="190" y="124" width="5" height="2.4" rx="1" fill="black" stroke="none" transform="rotate(-25 192 125)"/>
    <rect x="58" y="206" width="5" height="2.4" rx="1" fill="black" stroke="none" transform="rotate(60 60 207)"/>
    <circle cx="128" cy="62" r="1.8" fill="black" stroke="none"/>
    <circle cx="8" cy="200" r="1.8" fill="black" stroke="none"/>`
  ),
};

const SEASONAL_PATTERNS: Record<'christmas' | 'newyear', Omit<WallpaperPattern, 'category'>> = {
  christmas: {
    label: 'Navidad',
    width: 220,
    svg: svg(
      220,
      220,
      `${STROKE} stroke-width="1.7"`,
      `<g transform="translate(18 16)">
        <path d="M20 4L32 16H26L36 28H28L40 42H0L12 28H4L14 16H8Z"/>
        <path d="M17 42V50H23V42"/>
        <circle cx="16" cy="30" r="1.6" fill="black" stroke="none"/>
        <circle cx="25" cy="22" r="1.6" fill="black" stroke="none"/>
      </g>
      ${sparkle(38, 14, 6)}
      ${snowflake(150, 34, 16)}
      <g transform="translate(96 82)">
        <rect x="0" y="10" width="32" height="24" rx="3"/>
        <rect x="-3" y="4" width="38" height="8" rx="2"/>
        <path d="M16 4V34"/>
        <path d="M16 4C10 -6 3 -1 16 4C29 -1 22 -6 16 4"/>
      </g>
      <path d="M38 150V112C38 104 44 98 51 98C58 98 64 104 64 112" stroke-width="6" stroke-dasharray="5 4"/>
      <g transform="translate(160 132)">
        <path d="M2 30C7 26 7 21 7 14C7 7 11 3 17 3C23 3 27 7 27 14C27 21 27 26 32 30Z"/>
        <path d="M14 34A3 3 0 0 0 20 34"/>
        <path d="M13 3C11 -2 17 -2 17 3C17 -2 23 -2 21 3"/>
      </g>
      <g transform="translate(96 168)">
        <circle cx="12" cy="22" r="12"/>
        <rect x="8" y="6" width="8" height="5" rx="1"/>
        <path d="M12 6C12 2 15 1 16 3"/>
        <path d="M2 18C8 22 16 22 22 18" stroke-width="1.2"/>
      </g>
      ${snowflake(194, 196, 9)}
      ${snowflake(30, 196, 7)}
      ${snowflake(80, 50, 6)}
      ${sparkle(194, 92, 5)}
      ${sparkle(130, 140, 4)}
      <circle cx="76" cy="132" r="2" fill="black" stroke="none"/>
      <circle cx="200" cy="10" r="2" fill="black" stroke="none"/>
      <circle cx="12" cy="88" r="2" fill="black" stroke="none"/>`
    ),
  },
  newyear: NEW_YEAR_PATTERN,
};

/** Máscara del patrón de una temporada. */
export function getSeasonalMask(season: keyof typeof SEASONAL_PATTERNS): PatternMask {
  const entry = SEASONAL_PATTERNS[season];
  const encoded = encodeURIComponent(entry.svg.replace(/\s+/g, ' ').trim());
  return { dataUri: `url("data:image/svg+xml,${encoded}")`, width: entry.width, height: entry.height ?? entry.width };
}

export function isPatternWallpaper(style: WallpaperStyle): style is PatternWallpaperId {
  return style !== 'custom' && style !== 'none' && style in WALLPAPER_PATTERNS;
}

export interface PatternMask {
  dataUri: string;
  width: number;
  height: number;
}

/** Máscara CSS del patrón y su tamaño natural. Un id desconocido cae en «Campus». */
export function getPatternMask(style: PatternWallpaperId): PatternMask {
  const entry = WALLPAPER_PATTERNS[style] ?? WALLPAPER_PATTERNS.campus;
  const encoded = encodeURIComponent(entry.svg.replace(/\s+/g, ' ').trim());
  return {
    dataUri: `url("data:image/svg+xml,${encoded}")`,
    width: entry.width,
    height: entry.height ?? entry.width,
  };
}

/** Tamaño de la máscara (`mask-size`) para una escala dada (1 = tamaño natural). */
export function patternMaskSize(mask: PatternMask, scale: number, minSide = 14): string {
  const factor = Math.max(minSide / Math.min(mask.width, mask.height), scale);
  return `${Math.round(mask.width * factor)}px ${Math.round(mask.height * factor)}px`;
}
