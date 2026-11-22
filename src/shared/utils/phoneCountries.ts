/**
 * Códigos telefónicos por país para el campo de teléfono: el estudiante elige el país y el número
 * se guarda ya en formato internacional (+593 99 123 4567), que es lo que necesitan WhatsApp y
 * Telegram para abrir el chat.
 */

export interface PhoneCountry {
  /** ISO 3166-1 alfa-2 (EC, MX…). */
  iso: string;
  name: string;
  /** Código de marcación sin "+". */
  dial: string;
}

export const PHONE_COUNTRIES: readonly PhoneCountry[] = [
  { iso: 'AR', name: 'Argentina', dial: '54' },
  { iso: 'BO', name: 'Bolivia', dial: '591' },
  { iso: 'BR', name: 'Brasil', dial: '55' },
  { iso: 'CL', name: 'Chile', dial: '56' },
  { iso: 'CO', name: 'Colombia', dial: '57' },
  { iso: 'CR', name: 'Costa Rica', dial: '506' },
  { iso: 'CU', name: 'Cuba', dial: '53' },
  { iso: 'EC', name: 'Ecuador', dial: '593' },
  { iso: 'SV', name: 'El Salvador', dial: '503' },
  { iso: 'ES', name: 'España', dial: '34' },
  { iso: 'US', name: 'Estados Unidos', dial: '1' },
  { iso: 'GT', name: 'Guatemala', dial: '502' },
  { iso: 'HN', name: 'Honduras', dial: '504' },
  { iso: 'MX', name: 'México', dial: '52' },
  { iso: 'NI', name: 'Nicaragua', dial: '505' },
  { iso: 'PA', name: 'Panamá', dial: '507' },
  { iso: 'PY', name: 'Paraguay', dial: '595' },
  { iso: 'PE', name: 'Perú', dial: '51' },
  { iso: 'PR', name: 'Puerto Rico', dial: '1' },
  { iso: 'DO', name: 'República Dominicana', dial: '1' },
  { iso: 'UY', name: 'Uruguay', dial: '598' },
  { iso: 'VE', name: 'Venezuela', dial: '58' },
  { iso: 'DE', name: 'Alemania', dial: '49' },
  { iso: 'AU', name: 'Australia', dial: '61' },
  { iso: 'CA', name: 'Canadá', dial: '1' },
  { iso: 'CN', name: 'China', dial: '86' },
  { iso: 'KR', name: 'Corea del Sur', dial: '82' },
  { iso: 'FR', name: 'Francia', dial: '33' },
  { iso: 'IN', name: 'India', dial: '91' },
  { iso: 'IT', name: 'Italia', dial: '39' },
  { iso: 'JP', name: 'Japón', dial: '81' },
  { iso: 'PT', name: 'Portugal', dial: '351' },
  { iso: 'GB', name: 'Reino Unido', dial: '44' },
];

const BY_ISO = new Map(PHONE_COUNTRIES.map((country) => [country.iso, country]));
const LAST_COUNTRY_KEY = 'agenda_phone_country';
const FALLBACK_ISO = 'EC';

export function phoneCountryByIso(iso: string | undefined): PhoneCountry | undefined {
  return iso ? BY_ISO.get(iso.toUpperCase()) : undefined;
}

/** País propuesto para un número nuevo: el último elegido, el de la configuración regional o Ecuador. */
export function defaultPhoneCountry(): PhoneCountry {
  try {
    const remembered = phoneCountryByIso(localStorage.getItem(LAST_COUNTRY_KEY) ?? undefined);
    if (remembered) return remembered;
  } catch {
    // Sin almacenamiento (ventana privada): se sigue con el idioma
  }
  const region = navigator.languages
    ?.map((tag) => tag.split('-')[1])
    .find((part) => part && part.length === 2 && BY_ISO.has(part.toUpperCase()));
  return phoneCountryByIso(region) ?? (BY_ISO.get(FALLBACK_ISO) as PhoneCountry);
}

export function rememberPhoneCountry(country: PhoneCountry): void {
  try {
    localStorage.setItem(LAST_COUNTRY_KEY, country.iso);
  } catch {
    // Solo es una comodidad: si no se puede guardar, no pasa nada
  }
}

export interface SplitPhone {
  country: PhoneCountry;
  /** El resto del número, tal como se escribió. */
  local: string;
}

/**
 * Separa un número guardado en país y número local. Con "+" o "00" se busca el código más largo
 * que coincida (+593 antes que +5…); si comparte código (+1), se prefiere el país propuesto.
 * Sin código de país, todo es número local y el país es el propuesto.
 */
export function splitPhone(raw: string | undefined, fallback: PhoneCountry): SplitPhone {
  const value = raw?.trim() ?? '';
  const international = value.startsWith('+') ? value.slice(1) : value.startsWith('00') ? value.slice(2) : null;
  if (international === null) return { country: fallback, local: value };
  const digits = international.replace(/\D/g, '');
  const match = [...PHONE_COUNTRIES]
    .filter((country) => digits.startsWith(country.dial))
    .sort((a, b) => b.dial.length - a.dial.length || (a.iso === fallback.iso ? -1 : b.iso === fallback.iso ? 1 : 0))[0];
  if (!match) return { country: fallback, local: value };
  // Quita el código del texto conservando los espacios que el estudiante haya puesto en el resto
  let seen = 0;
  let cut = 0;
  while (cut < international.length && seen < match.dial.length) {
    if (/\d/.test(international[cut])) seen += 1;
    cut += 1;
  }
  return { country: match, local: international.slice(cut).trim() };
}

/**
 * Une país y número: "+593 99 123 4567". El 0 inicial de los números nacionales (099…) se quita,
 * porque en formato internacional no va. Sin número, queda vacío.
 */
export function joinPhone(country: PhoneCountry, local: string): string {
  const cleaned = local.trim().replace(/^0+/, '').trim();
  if (!/\d/.test(cleaned)) return '';
  // Código de un país que no está en la lista (+999…): se respeta tal cual
  if (cleaned.startsWith('+')) return cleaned;
  return `+${country.dial} ${cleaned}`;
}
