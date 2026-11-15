/**
 * Notas de voz dentro del texto del apunte. El audio sigue guardado en la tabla noteAudios (como
 * Blob, fuera del HTML); el texto solo lleva un marcador `<div data-voice-note="<id>">` en la
 * posición donde se quiere escuchar. Así el HTML del apunte no crece con el audio en base64 y los
 * respaldos y archivos .agnote existentes siguen siendo válidos.
 *
 * Una grabación del apunte que no tiene marcador en el texto se muestra en la sección
 * «Notas de voz» de debajo (las antiguas, y las que se quitaron del texto sin borrarlas).
 */
export const VOICE_NOTE_ATTR = 'data-voice-note';

const EMBED_ID_PATTERN = /data-voice-note="([^"]+)"/g;

/** Ids de las notas de voz que tienen marcador en el HTML del apunte. */
export function getEmbeddedAudioIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const match of html.matchAll(EMBED_ID_PATTERN)) ids.add(match[1]);
  return ids;
}

/** Quita del HTML el marcador de una nota de voz (al borrar la grabación desde el lector). */
export function removeVoiceNoteEmbed(html: string, audioId: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll(`[${VOICE_NOTE_ATTR}]`).forEach((element) => {
    if (element.getAttribute(VOICE_NOTE_ATTR) === audioId) element.remove();
  });
  return doc.body.innerHTML;
}

/** Cambia los ids de los marcadores (al importar un .agnote las grabaciones reciben ids nuevos). */
export function remapVoiceNoteEmbeds(html: string, idMap: ReadonlyMap<string, string>): string {
  if (idMap.size === 0) return html;
  return html.replace(EMBED_ID_PATTERN, (whole, id: string) => {
    const next = idMap.get(id);
    return next ? `${VOICE_NOTE_ATTR}="${next}"` : whole;
  });
}
