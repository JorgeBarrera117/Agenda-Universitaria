import { Capacitor } from '@capacitor/core';
import { WidgetBridge } from '../../../shared/plugins/widgetBridge';
import { deliverSharedFile, shareFileBaseName } from '../../../shared/utils/sharePackage';
import type { Professor } from '../types';

/**
 * Formas de contactar a un docente desde su teléfono guardado: llamar, WhatsApp, Telegram,
 * guardarlo en la app de contactos o pasar su tarjeta (.vcf) a la app que el estudiante elija.
 * La interfaz (ProfessorContactSheet) solo decide qué mostrar; aquí vive cómo se abre cada canal.
 */

export interface PhoneNumber {
  /** Tal como lo escribió el estudiante, para mostrarlo. */
  display: string;
  /** Solo dígitos y "+": lo que entienden los marcadores (tel:). */
  dial: string;
  /**
   * Número internacional sin "+" ni "00" (p. ej. 593991234567). WhatsApp y Telegram lo exigen;
   * null si se guardó sin código de país (0991234567), porque no se puede adivinar cuál es.
   */
  international: string | null;
}

export function parsePhoneNumber(raw?: string): PhoneNumber | null {
  const display = raw?.trim() ?? '';
  const dial = display.replace(/[^\d+]/g, '');
  const digits = dial.replace(/\D/g, '');
  if (digits.length < 5) return null;
  const hasCountryCode = dial.startsWith('+') || dial.startsWith('00');
  const international = dial.startsWith('00') ? digits.slice(2) : digits;
  return { display, dial, international: hasCountryCode && international.length >= 8 ? international : null };
}

/** Abre un enlace https fuera de la app: en Android con la app que lo maneje (WhatsApp, Telegram…). */
async function openExternal(url: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await WidgetBridge.openExternalUrl({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function callPhone(phone: PhoneNumber): void {
  window.location.href = `tel:${phone.dial}`;
}

export function openWhatsApp(phone: PhoneNumber): Promise<void> {
  if (!phone.international) return Promise.reject(new Error(MISSING_COUNTRY_CODE));
  return openExternal(`https://wa.me/${phone.international}`);
}

export function openTelegram(phone: PhoneNumber): Promise<void> {
  if (!phone.international) return Promise.reject(new Error(MISSING_COUNTRY_CODE));
  return openExternal(`https://t.me/+${phone.international}`);
}

export const MISSING_COUNTRY_CODE = 'Edita el número y agrégale el código de país (por ejemplo +593) para abrirlo en esta app.';

/* -------------------------------------------------------------------------------------------- */
/* Tarjeta de contacto (vCard 3.0)                                                               */
/* -------------------------------------------------------------------------------------------- */

/** Escapa un valor de vCard: barra invertida, punto y coma, coma y saltos de línea. */
function vcardValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Notas del contacto: materias, cubículo y asesorías (solo lo que exista). */
function contactNotes(professor: Professor, subjectNames: string[]): string {
  const lines: string[] = [];
  if (subjectNames.length > 0) lines.push(`Materias: ${subjectNames.join(', ')}`);
  if (professor.office?.trim()) lines.push(`Cubículo: ${professor.office.trim()}`);
  if (professor.notes?.trim()) lines.push(`Asesorías: ${professor.notes.trim()}`);
  return lines.join('\n');
}

export function buildProfessorVCard(professor: Professor, subjectNames: string[]): string {
  const name = professor.name.trim() || 'Docente';
  const phone = parsePhoneNumber(professor.phone);
  const email = professor.email?.trim();
  const notes = contactNotes(professor, subjectNames);
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardValue(name)}`, `N:;${vcardValue(name)};;;`, 'TITLE:Docente'];
  if (phone) lines.push(`TEL;TYPE=WORK,VOICE:${phone.dial}`);
  if (email) lines.push(`EMAIL;TYPE=INTERNET,WORK:${vcardValue(email)}`);
  if (notes) lines.push(`NOTE:${vcardValue(notes)}`);
  lines.push('END:VCARD');
  // vCard pide fin de línea CRLF
  return `${lines.join('\r\n')}\r\n`;
}

const VCARD_MIME_TYPE = 'text/x-vcard';

function vcardFileName(name: string): string {
  return `${shareFileBaseName(name, 'docente')}.vcf`;
}

/**
 * Pasa la tarjeta .vcf a la app que elija el estudiante (Contactos, WhatsApp, Telegram, correo…)
 * con la hoja de compartir de Android. En PC o en el navegador se descarga.
 */
export function shareProfessorVCard(professor: Professor, subjectNames: string[]) {
  return deliverSharedFile(buildProfessorVCard(professor, subjectNames), vcardFileName(professor.name), VCARD_MIME_TYPE);
}

/**
 * Guarda al docente en los contactos. En Android abre "Crear contacto" con los datos ya escritos
 * (el estudiante elige la cuenta y guarda); si no hay app de contactos, ofrece la tarjeta .vcf.
 * En PC o en el navegador descarga la tarjeta .vcf, que abren Outlook, Contactos de Windows, etc.
 */
export async function saveProfessorToContacts(
  professor: Professor,
  subjectNames: string[]
): Promise<'opened' | 'shared' | 'downloaded'> {
  if (Capacitor.isNativePlatform()) {
    try {
      await WidgetBridge.addContact({
        name: professor.name.trim(),
        phone: parsePhoneNumber(professor.phone)?.display,
        email: professor.email?.trim() || undefined,
        notes: contactNotes(professor, subjectNames) || undefined,
      });
      return 'opened';
    } catch {
      await shareProfessorVCard(professor, subjectNames);
      return 'shared';
    }
  }
  await shareProfessorVCard(professor, subjectNames);
  return 'downloaded';
}
