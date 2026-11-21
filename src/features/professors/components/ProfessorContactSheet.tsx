import React from 'react';
import { MessageCircle, Phone, Send, Share2, UserPlus } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Modal } from '../../../shared/components/Modal';
import type { Professor } from '../types';
import {
  MISSING_COUNTRY_CODE,
  callPhone,
  openTelegram,
  openWhatsApp,
  parsePhoneNumber,
  saveProfessorToContacts,
  shareProfessorVCard,
} from '../services/professorContactService';

interface ProfessorContactSheetProps {
  professor: Professor | null;
  subjectNames: string[];
  onClose: () => void;
  /** Mensaje corto para el estudiante (errores o lo que pasó). */
  onNotify: (message: string) => void;
}

interface ContactOption {
  id: string;
  icon: React.ReactNode;
  label: string;
  detail: string;
  disabled?: boolean;
  run: () => Promise<unknown> | void;
}

/**
 * "Contacto": el estudiante elige cómo comunicarse con el docente o dónde guardarlo, en vez de
 * que la app decida llamar. Filas grandes (56 px) agrupadas en dos bloques de Material 3:
 * hablar ahora (llamar, WhatsApp, Telegram) y guardar o pasar el contacto.
 */
export const ProfessorContactSheet: React.FC<ProfessorContactSheetProps> = ({ professor, subjectNames, onClose, onNotify }) => {
  const phone = parsePhoneNumber(professor?.phone);
  if (!professor || !phone) return null;

  const isNative = Capacitor.isNativePlatform();
  const needsCountryCode = !phone.international;

  const talk: ContactOption[] = [
    {
      id: 'call',
      icon: <Phone className="h-5 w-5" />,
      label: 'Llamar',
      detail: phone.display,
      run: () => callPhone(phone),
    },
    {
      id: 'whatsapp',
      icon: <MessageCircle className="h-5 w-5" />,
      label: 'WhatsApp',
      detail: needsCountryCode ? 'Falta el código de país en el número' : 'Abrir el chat',
      disabled: needsCountryCode,
      run: () => openWhatsApp(phone),
    },
    {
      id: 'telegram',
      icon: <Send className="h-5 w-5" />,
      label: 'Telegram',
      detail: needsCountryCode ? 'Falta el código de país en el número' : 'Abrir el chat',
      disabled: needsCountryCode,
      run: () => openTelegram(phone),
    },
  ];

  const keep: ContactOption[] = [
    {
      id: 'save',
      icon: <UserPlus className="h-5 w-5" />,
      label: 'Guardar en contactos',
      detail: isNative ? 'Elige la app de contactos y la cuenta' : 'Descarga la tarjeta .vcf (Outlook, Contactos…)',
      run: async () => {
        const result = await saveProfessorToContacts(professor, subjectNames);
        if (result === 'downloaded') onNotify('Se descargó la tarjeta de contacto (.vcf).');
      },
    },
    ...(isNative
      ? [
          {
            id: 'share-vcf',
            icon: <Share2 className="h-5 w-5" />,
            label: 'Enviar a otra app',
            detail: 'Tarjeta .vcf para WhatsApp, Telegram, correo…',
            run: () => shareProfessorVCard(professor, subjectNames),
          },
        ]
      : []),
  ];

  const handle = async (option: ContactOption) => {
    try {
      await option.run();
      onClose();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'No se pudo abrir esa opción.');
    }
  };

  const renderGroup = (title: string, options: ContactOption[]) => (
    <section aria-label={title}>
      <h3 className="px-1 pb-1.5 text-11px font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{title}</h3>
      <ul className="overflow-hidden rounded-3xl border border-[var(--color-md-outline-variant)]/60 bg-[var(--color-md-surface-container)]">
        {options.map((option, index) => (
          <li key={option.id} className={index > 0 ? 'border-t border-[var(--color-md-outline-variant)]/50' : ''}>
            <button
              type="button"
              disabled={option.disabled}
              onClick={() => void handle(option)}
              className="flex min-h-14 w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--color-md-surface-container-high)] active:bg-[var(--color-md-surface-container-high)] disabled:cursor-not-allowed disabled:opacity-55"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]"
                aria-hidden="true"
              >
                {option.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{option.label}</span>
                <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">{option.detail}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );

  return (
    <Modal isOpen onClose={onClose} title={`Contactar a ${professor.name}`} maxWidth="sm" dismissOnBackdrop>
      <div className="space-y-4">
        {renderGroup('Comunicarse', talk)}
        {renderGroup('Guardar o pasar el contacto', keep)}
        {needsCountryCode && (
          <p className="px-1 text-xs text-[var(--color-md-on-surface-variant)]">{MISSING_COUNTRY_CODE}</p>
        )}
      </div>
    </Modal>
  );
};
