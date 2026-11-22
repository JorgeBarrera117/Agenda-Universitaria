import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { Modal } from '../Modal';
import { formInputClass } from './formStyles';
import {
  PHONE_COUNTRIES,
  defaultPhoneCountry,
  joinPhone,
  rememberPhoneCountry,
  splitPhone,
  type PhoneCountry,
} from '../../utils/phoneCountries';

interface PhoneFieldProps {
  id: string;
  /** Número completo guardado ("+593 99 123 4567"). */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/** Quita tildes y mayúsculas para buscar "peru" y encontrar "Perú". */
const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Al abrir la lista, el país elegido queda a la vista. */
const scrollIntoCenter = (el: HTMLLIElement | null) => el?.scrollIntoView({ block: 'center' });

/**
 * Teléfono con selector de país: a la izquierda el país con su código (+593), a la derecha el
 * número. Se guarda en formato internacional para que WhatsApp y Telegram funcionen siempre.
 * Si se pega un número que ya trae su código (+52 55…), el país se elige solo.
 */
export const PhoneField: React.FC<PhoneFieldProps> = ({ id, value, onChange, placeholder = '99 123 4567' }) => {
  const [initial] = useState(() => splitPhone(value, defaultPhoneCountry()));
  const [country, setCountry] = useState<PhoneCountry>(initial.country);
  const [local, setLocal] = useState(initial.local);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = normalize(query.trim().replace(/^\+/, ''));
    if (!q) return PHONE_COUNTRIES;
    return PHONE_COUNTRIES.filter((c) => normalize(c.name).includes(q) || c.dial.startsWith(q) || c.iso.toLowerCase() === q);
  }, [query]);

  const changeLocal = (text: string) => {
    // Pegaron el número con su código: se reparte entre país y número
    if (/^\s*(\+|00)/.test(text)) {
      const split = splitPhone(text, country);
      setCountry(split.country);
      setLocal(split.local);
      onChange(joinPhone(split.country, split.local));
      return;
    }
    setLocal(text);
    onChange(joinPhone(country, text));
  };

  const chooseCountry = (next: PhoneCountry) => {
    setCountry(next);
    rememberPhoneCountry(next);
    onChange(joinPhone(next, local));
    setIsPickerOpen(false);
    setQuery('');
  };

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        aria-haspopup="dialog"
        aria-label={`País: ${country.name} (+${country.dial}). Cambiar`}
        className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container-high)] px-2.5 text-sm font-bold text-[var(--color-md-on-surface)] transition-colors hover:border-[var(--color-md-outline)] focus:border-[var(--color-md-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-md-primary)]/30"
      >
        <span className="rounded-md bg-[var(--color-md-primary-container)] px-1.5 py-0.5 font-mono text-10px font-black text-[var(--color-md-on-primary-container)]">
          {country.iso}
        </span>
        <span className="font-mono">+{country.dial}</span>
        <ChevronDown className="h-4 w-4 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
      </button>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={local}
        onChange={(e) => changeLocal(e.target.value)}
        placeholder={placeholder}
        className={`${formInputClass} min-w-0 flex-1 font-mono`}
      />

      <Modal
        isOpen={isPickerOpen}
        onClose={() => {
          setIsPickerOpen(false);
          setQuery('');
        }}
        title="Código de país"
        maxWidth="sm"
      >
        <div className="space-y-3">
          <label className="relative block">
            <span className="sr-only">Buscar país o código</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Enter elige el primer resultado (y no envía el formulario de fondo)
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (filtered[0]) chooseCountry(filtered[0]);
              }}
              placeholder="Buscar país o código"
              className={`${formInputClass} pl-9`}
            />
          </label>
          <ul className="-mx-2 max-h-[50vh] overflow-y-auto" role="listbox" aria-label="Países">
            {filtered.map((c) => {
              const selected = c.iso === country.iso;
              return (
                <li key={c.iso} ref={selected ? scrollIntoCenter : undefined}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => chooseCountry(c)}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm transition-colors ${
                      selected
                        ? 'bg-[var(--color-md-primary-container)] font-bold text-[var(--color-md-on-primary-container)]'
                        : 'text-[var(--color-md-on-surface)] hover:bg-[var(--color-md-surface-container)]'
                    }`}
                  >
                    <span className="w-7 shrink-0 font-mono text-11px font-black text-[var(--color-md-on-surface-variant)]">{c.iso}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="font-mono text-[var(--color-md-on-surface-variant)]">+{c.dial}</span>
                    {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-4 text-sm text-[var(--color-md-on-surface-variant)]">Ningún país coincide con «{query}».</li>
            )}
          </ul>
        </div>
      </Modal>
    </div>
  );
};
