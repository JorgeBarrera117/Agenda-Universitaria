/**
 * Genera los íconos de materia para Android (notificaciones y widgets) a partir de los mismos
 * dibujos de lucide que usa la app, para que se vean idénticos en todas partes.
 *
 *   node scripts/generate-android-subject-icons.mjs
 *
 * Escribe android/app/src/main/res/drawable/ic_subject_<id>.xml (VectorDrawable de 24 dp, trazo
 * blanco): el sistema lo tiñe con el color de la materia (iconColor en la notificación,
 * setColorFilter en el widget). Si se agrega un ícono a SUBJECT_ICONS (SubjectIcon.tsx), agrégalo
 * también a ICONS y vuelve a ejecutar el script.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lucideDir = join(root, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const outDir = join(root, 'android', 'app', 'src', 'main', 'res', 'drawable');

/** id del ícono en la app → archivo de lucide (mismo orden que SUBJECT_ICONS + «personal»). */
const ICONS = {
  book: 'book-open',
  code: 'code',
  cpu: 'cpu',
  calculator: 'calculator',
  atom: 'atom',
  flask: 'flask-conical',
  scale: 'scale',
  briefcase: 'briefcase',
  'trending-up': 'trending-up',
  compass: 'compass',
  languages: 'languages',
  heart: 'heart-pulse',
  palette: 'palette',
  brain: 'brain',
  globe: 'globe',
  shield: 'shield-check',
  award: 'award',
  sparkles: 'sparkles',
  personal: 'user-round',
};

/** Lee el arreglo `node` de un ícono de lucide (["path", { d }], ["circle", { cx, cy, r }]…). */
function readIconNode(file) {
  const source = readFileSync(join(lucideDir, `${file}.mjs`), 'utf8');
  const match = source.match(/node:\s*(\[[\s\S]*?\])\s*(?:,\s*aliases|\n\s*\};)/);
  if (!match) throw new Error(`No se encontró el dibujo de ${file}`);
  // El arreglo es un literal JS simple (cadenas y objetos): se evalúa sin acceso a nada más
  return new Function(`return ${match[1]};`)();
}

const ARITY = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };

/**
 * Reescribe un trazado SVG con todos sus números separados. lucide usa la forma compacta de los
 * arcos («a2 2 0 00-1.999-2», banderas pegadas) que el lector de Android interpreta mal.
 */
function normalizePath(d) {
  const out = [];
  let i = 0;
  let command = '';
  const skip = () => {
    while (i < d.length && /[\s,]/.test(d[i])) i++;
  };
  const readNumber = () => {
    skip();
    const m = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(d.slice(i));
    if (!m) throw new Error(`Número inválido en «${d}» (posición ${i})`);
    i += m[0].length;
    return m[0];
  };
  const readFlag = () => {
    skip();
    const flag = d[i];
    if (flag !== '0' && flag !== '1') throw new Error(`Bandera de arco inválida en «${d}»`);
    i++;
    return flag;
  };
  while (true) {
    skip();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) {
      command = d[i++];
      out.push(command);
      if (command.toUpperCase() === 'Z') continue;
    } else if (!command || command.toUpperCase() === 'Z') {
      throw new Error(`Trazado inválido: «${d}»`);
    }
    const upper = command.toUpperCase();
    const params = [];
    for (let k = 0; k < ARITY[upper]; k++) {
      params.push(upper === 'A' && (k === 3 || k === 4) ? readFlag() : readNumber());
    }
    out.push(params.join(' '));
    // Tras un «M», los pares siguientes son «L» implícitos: se dejan como repetición del comando
    if (command === 'M') command = 'L';
    if (command === 'm') command = 'l';
  }
  return out.join(' ');
}

const num = (value) => Number.parseFloat(value);

/** Cada elemento de lucide como trazado (Android VectorDrawable solo entiende <path>). */
function toPathData([tag, attrs]) {
  switch (tag) {
    case 'path':
      return normalizePath(attrs.d);
    case 'circle': {
      const cx = num(attrs.cx);
      const cy = num(attrs.cy);
      const r = num(attrs.r);
      return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
    }
    case 'line':
      return `M ${num(attrs.x1)} ${num(attrs.y1)} L ${num(attrs.x2)} ${num(attrs.y2)}`;
    case 'rect': {
      const x = num(attrs.x ?? '0');
      const y = num(attrs.y ?? '0');
      const w = num(attrs.width);
      const h = num(attrs.height);
      const r = Math.min(num(attrs.rx ?? attrs.ry ?? '0'), w / 2, h / 2);
      if (!r) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
      return [
        `M ${x + r} ${y}`,
        `H ${x + w - r}`,
        `A ${r} ${r} 0 0 1 ${x + w} ${y + r}`,
        `V ${y + h - r}`,
        `A ${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
        `H ${x + r}`,
        `A ${r} ${r} 0 0 1 ${x} ${y + h - r}`,
        `V ${y + r}`,
        `A ${r} ${r} 0 0 1 ${x + r} ${y}`,
        'Z',
      ].join(' ');
    }
    case 'polyline':
    case 'polygon': {
      const points = attrs.points.trim().split(/[\s,]+/).map(num);
      const pairs = [];
      for (let k = 0; k < points.length; k += 2) pairs.push(`${points[k]} ${points[k + 1]}`);
      return `M ${pairs.join(' L ')}${tag === 'polygon' ? ' Z' : ''}`;
    }
    default:
      throw new Error(`Elemento SVG no soportado: ${tag}`);
  }
}

function vectorDrawable(iconId, node) {
  const paths = node
    .map(
      (element) => `    <path
        android:pathData="${toPathData(element)}"
        android:fillColor="#00000000"
        android:strokeColor="#FFFFFFFF"
        android:strokeWidth="2"
        android:strokeLineCap="round"
        android:strokeLineJoin="round" />`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- Generado por scripts/generate-android-subject-icons.mjs (ícono «${iconId}» de lucide). No editar a mano. -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
${paths}
</vector>
`;
}

mkdirSync(outDir, { recursive: true });
for (const [iconId, file] of Object.entries(ICONS)) {
  const name = `ic_subject_${iconId.replace(/-/g, '_')}`;
  writeFileSync(join(outDir, `${name}.xml`), vectorDrawable(iconId, readIconNode(file)));
  console.log(`✓ ${name}.xml`);
}
