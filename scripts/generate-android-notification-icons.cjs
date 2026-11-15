/**
 * Genera los íconos GRANDES de las notificaciones de Android: el ícono de cada materia sobre un
 * círculo de cada color de la paleta de materias (PNG, res/drawable-nodpi/ic_lg_<ícono>_<color>.png).
 *
 *   npx electron scripts/generate-android-notification-icons.cjs
 *
 * ¿Por qué PNG y uno por color? El plugin de notificaciones solo acepta como ícono grande una imagen
 * de mapa de bits empaquetada en la app (decodeResource no lee vectores ni imágenes creadas al
 * vuelo). Un color propio de una materia usa el color de la paleta más parecido
 * (androidSubjectLargeIcon en src/features/subjects/utils/subjectIconResource.ts).
 *
 * Se dibuja con Electron (Chromium) para usar el mismo motor SVG que la app. Si cambian los íconos
 * (SUBJECT_ICONS) o la paleta (SUBJECT_PRESET_COLORS), actualiza ICONS / COLORS y vuelve a ejecutarlo.
 */
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const lucideDir = path.join(root, 'node_modules', 'lucide-react', 'dist', 'esm', 'icons');
const outDir = path.join(root, 'android', 'app', 'src', 'main', 'res', 'drawable-nodpi');
const SIZE = 160;

/** id del ícono en la app → archivo de lucide (SUBJECT_ICONS de SubjectIcon.tsx). */
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
};

/** SUBJECT_PRESET_COLORS de SubjectIcon.tsx (mismo orden). */
const COLORS = [
  '#006BBB', '#30A0E0', '#004d88', '#081d33', '#0d9488', '#10b981', '#059669', '#f59e0b',
  '#ea580c', '#ef4444', '#e11d48', '#8b5cf6', '#6366f1', '#ec4899', '#64748b',
];

function readIconNode(file) {
  const source = fs.readFileSync(path.join(lucideDir, `${file}.mjs`), 'utf8');
  const match = source.match(/node:\s*(\[[\s\S]*?\])\s*(?:,\s*aliases|\n\s*\};)/);
  if (!match) throw new Error(`No se encontró el dibujo de ${file}`);
  return new Function(`return ${match[1]};`)();
}

/** Elementos del ícono como SVG (sin la clave de React). */
function glyphMarkup(node) {
  return node
    .map(([tag, attrs]) => {
      const attributes = Object.entries(attrs)
        .filter(([name]) => name !== 'key')
        .map(([name, value]) => `${name}="${String(value).replace(/"/g, '&quot;')}"`)
        .join(' ');
      return `<${tag} ${attributes}/>`;
    })
    .join('');
}

function badgeSvg(glyph, color) {
  // Círculo del color de la materia con el ícono en blanco centrado (cabe al recortarse en círculo)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 24 24">` +
    `<circle cx="12" cy="12" r="12" fill="${color}"/>` +
    `<g transform="translate(6.24 6.24) scale(0.48)" fill="none" stroke="#ffffff" stroke-width="2.2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${glyph}</g></svg>`
  );
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 200, height: 200, webPreferences: { offscreen: true } });
  await win.loadURL('data:text/html,<html><body></body></html>');
  fs.mkdirSync(outDir, { recursive: true });
  let count = 0;
  for (const [iconId, file] of Object.entries(ICONS)) {
    const glyph = glyphMarkup(readIconNode(file));
    for (const color of COLORS) {
      const svg = badgeSvg(glyph, color);
      const dataUrl = await win.webContents.executeJavaScript(`(async () => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(${JSON.stringify(svg)});
        await img.decode();
        const canvas = document.createElement('canvas');
        canvas.width = ${SIZE};
        canvas.height = ${SIZE};
        canvas.getContext('2d').drawImage(img, 0, 0, ${SIZE}, ${SIZE});
        return canvas.toDataURL('image/png');
      })()`);
      const name = `ic_lg_${iconId.replace(/-/g, '_')}_${color.slice(1).toLowerCase()}.png`;
      fs.writeFileSync(path.join(outDir, name), Buffer.from(dataUrl.split(',')[1], 'base64'));
      count++;
    }
  }
  console.log(`✓ ${count} íconos grandes en ${path.relative(root, outDir)}`);
  app.quit();
});
