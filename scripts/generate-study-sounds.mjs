/**
 * Genera por síntesis los sonidos del Estudio (Pomodoro) y los guarda como WAV mono de 16 bits a
 * 44,1 kHz (el mismo formato que el resto de tonos) en:
 *   - public/sounds/            → web y Windows (vista previa y avisos con la app abierta)
 *   - android/app/src/main/res/raw/ → canales de notificación de Android (suenan con la app cerrada)
 *
 * Son archivos y no Web Audio en vivo porque en Android, con la app cerrada, el sonido lo pone el
 * sistema desde res/raw. Uso: node scripts/generate-study-sounds.mjs
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const RATE = 44100;
const PEAK = 0.7; // ≈ -3 dBFS: deja margen y suena parejo con los demás tonos

/** Mezcla de "voces": cada una suma su onda en el buffer. */
function render(seconds, voices) {
  const n = Math.round(seconds * RATE);
  const out = new Float64Array(n);
  for (const voice of voices) voice(out);
  // Normaliza al pico y suaviza el final (5 ms) para que no haga clic
  let max = 0;
  for (const v of out) max = Math.max(max, Math.abs(v));
  const gain = max > 0 ? PEAK / max : 0;
  const tail = Math.round(0.005 * RATE);
  for (let i = 0; i < n; i++) {
    const fadeOut = i > n - tail ? (n - i) / tail : 1;
    out[i] *= gain * fadeOut;
  }
  return out;
}

/**
 * Nota con parciales (frecuencia relativa, amplitud, caída por segundo), ataque corto y caída
 * exponencial: la base de campanas, cuencos y marimbas.
 */
function note({ at = 0, freq, partials, attack = 0.004, length = 2, detune = 0 }) {
  return (out) => {
    const start = Math.round(at * RATE);
    const end = Math.min(out.length, start + Math.round(length * RATE));
    for (let i = start; i < end; i++) {
      const t = (i - start) / RATE;
      const env = Math.min(1, t / attack);
      let v = 0;
      for (const [ratio, amp, decay] of partials) {
        const f = freq * ratio;
        v += amp * Math.exp(-decay * t) * Math.sin(2 * Math.PI * f * t);
        // Batido suave (dos frecuencias muy cercanas), como en un cuenco real
        if (detune) v += amp * 0.5 * Math.exp(-decay * t) * Math.sin(2 * Math.PI * (f + detune) * t);
      }
      out[i] += env * v;
    }
  };
}

/** Tono corto y plano (pitido) con rampas de 5 ms: sonidos digitales y alarmas. */
function beep({ at, freq, duration, harmonics = [[1, 1]], amp = 1 }) {
  return (out) => {
    const start = Math.round(at * RATE);
    const len = Math.round(duration * RATE);
    const ramp = Math.round(0.005 * RATE);
    for (let k = 0; k < len && start + k < out.length; k++) {
      const t = k / RATE;
      const env = Math.min(1, k / ramp, (len - k) / ramp);
      let v = 0;
      for (const [ratio, a] of harmonics) v += a * Math.sin(2 * Math.PI * freq * ratio * t);
      out[start + k] += amp * env * v;
    }
  };
}

const SOUNDS = {
  // Campana zen / cuenco: grave, larga y con parciales inarmónicos que batan (suave y armónico)
  study_zen_bowl: render(3.2, [
    note({ freq: 196, detune: 0.9, length: 3.2, attack: 0.012, partials: [[1, 1, 1.0], [2.71, 0.45, 1.6], [5.15, 0.22, 2.6], [8.21, 0.1, 3.8]] }),
  ]),
  // Chime de cristal: dos notas agudas y limpias, caída rápida (sutil)
  study_crystal_chime: render(1.7, [
    note({ at: 0, freq: 1318.5, length: 1.6, partials: [[1, 1, 3.2], [2.76, 0.28, 6], [5.4, 0.1, 9]] }),
    note({ at: 0.14, freq: 1975.5, length: 1.5, partials: [[1, 0.85, 3.6], [2.76, 0.22, 7], [5.4, 0.08, 10]] }),
  ]),
  // Pulso digital: dos pitidos cortos y uno más agudo (corto y moderno)
  study_digital_pulse: render(0.62, [
    beep({ at: 0.0, freq: 988, duration: 0.07, harmonics: [[1, 1], [2, 0.12]] }),
    beep({ at: 0.13, freq: 988, duration: 0.07, harmonics: [[1, 1], [2, 0.12]] }),
    beep({ at: 0.26, freq: 1480, duration: 0.16, harmonics: [[1, 1], [2, 0.1]] }),
  ]),
  // Marimba cálida: acorde arpegiado Do–Mi–Sol con timbre de madera (amigable y orgánico)
  study_warm_marimba: render(1.5, [
    note({ at: 0.0, freq: 523.25, length: 1.4, partials: [[1, 1, 4.5], [4, 0.32, 14], [9.9, 0.08, 24]] }),
    note({ at: 0.07, freq: 659.25, length: 1.35, partials: [[1, 0.9, 4.8], [4, 0.28, 15], [9.9, 0.06, 26]] }),
    note({ at: 0.14, freq: 783.99, length: 1.3, partials: [[1, 0.85, 5], [4, 0.26, 16], [9.9, 0.05, 28]] }),
  ]),
  // Alarma clásica suave: patrón de dos tonos repetido 3 veces, que sube un poco (más perceptible)
  study_soft_alarm: render(2.25, [
    ...[0, 0.75, 1.5].flatMap((at, rep) => [
      beep({ at, freq: 880, duration: 0.17, harmonics: [[1, 1], [3, 0.11]], amp: 0.7 + rep * 0.15 }),
      beep({ at: at + 0.25, freq: 659.25, duration: 0.17, harmonics: [[1, 1], [3, 0.11]], amp: 0.7 + rep * 0.15 }),
    ]),
  ]),
};

function wav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // tamaño del bloque fmt
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // bytes por segundo
  header.writeUInt16LE(2, 32); // bytes por muestra
  header.writeUInt16LE(16, 34); // bits
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const targets = ['public/sounds', 'android/app/src/main/res/raw'];
for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = wav(samples);
  for (const dir of targets) writeFileSync(join(dir, `${name}.wav`), file);
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)} s  ${(file.length / 1024).toFixed(0)} KB`);
}
