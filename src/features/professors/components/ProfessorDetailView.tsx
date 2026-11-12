import React from 'react';
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  Edit2,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  Share2,
  Trash2,
  UserRound,
} from 'lucide-react';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { PAGE_HEADER_ICON_BUTTON, PAGE_HEADER_PRIMARY_BUTTON, PageHeader } from '../../../shared/components/PageHeader';
import { BACK_PRIORITY, useBackButton } from '../../../shared/hooks/useBackButton';
import { SubjectBadge } from '../../subjects/components/SubjectIcon';
import type { Subject } from '../../subjects/types';
import type { Professor } from '../types';
import { ProfessorAvatar } from './ProfessorAvatar';

interface ProfessorDetailViewProps {
  professor: Professor;
  /** Materias que imparte. */
  subjects: Subject[];
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onShareAgcontact: () => void;
  /** Compartir la ficha como texto (WhatsApp sin la app instalada, portapapeles…). */
  onShareText?: () => void;
  onSelectSubject?: (subject: Subject) => void;
}

const SECTION_CLASS =
  'md-card rounded-3xl border border-[var(--color-md-outline-variant)] bg-[var(--md-card-surface)] p-4 shadow-xs sm:p-5';

const SectionTitle: React.FC<{ icon: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">
    <span className="text-[var(--color-md-primary)]" aria-hidden="true">
      {icon}
    </span>
    {children}
  </h3>
);

/** Fila de acción de contacto: ícono, qué hace, el dato y un chevron. */
const ContactRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  onClick?: () => void;
  tone?: 'primary' | 'tonal';
}> = ({ icon, label, value, href, onClick, tone = 'tonal' }) => {
  const content = (
    <>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
          tone === 'primary'
            ? 'bg-[var(--color-md-primary)] text-[var(--color-md-on-primary)]'
            : 'bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]'
        }`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-[var(--color-md-on-surface)]">{label}</span>
        <span className="block truncate text-xs text-[var(--color-md-on-surface-variant)]">{value}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
    </>
  );
  const className =
    '-mx-2 flex items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-[var(--color-md-surface-container)] active:scale-[0.99]';
  return href ? (
    <a href={href} className={className}>
      {content}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={`w-[calc(100%+1rem)] ${className}`}>
      {content}
    </button>
  );
};

/**
 * Ficha de contacto de un catedrático a pantalla completa (consulta): canales directos (llamar,
 * correo, compartir), atención estudiantil y materias que imparte. Editar abre el formulario de
 * siempre; el botón atrás de Android vuelve al directorio.
 */
export const ProfessorDetailView: React.FC<ProfessorDetailViewProps> = ({
  professor,
  subjects,
  onBack,
  onEdit,
  onDelete,
  onShareAgcontact,
  onShareText,
  onSelectSubject,
}) => {
  useBackButton(() => {
    onBack();
    return true;
  }, BACK_PRIORITY.SUBVIEW);

  const phone = professor.phone?.trim();
  const email = professor.email?.trim();
  // tel: solo con dígitos y "+" (los espacios o guiones del número guardado confunden a algunos marcadores)
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, '')}` : undefined;

  return (
    <div className="m3-sheet-enter mx-auto w-full max-w-3xl space-y-3 pb-10">
      <PageHeader
        title="Catedrático"
        subtitle="Ficha de contacto"
        onBack={onBack}
        backLabel="Volver a profesores"
        actions={
          <>
            <button
              type="button"
              onClick={onShareAgcontact}
              aria-label="Compartir contacto (.agcontact)"
              title="Compartir contacto (.agcontact)"
              className={PAGE_HEADER_ICON_BUTTON}
            >
              <Share2 className="h-[18px] w-[18px]" aria-hidden="true" />
            </button>
            <button type="button" onClick={onEdit} className={`ml-1 ${PAGE_HEADER_PRIMARY_BUTTON}`}>
              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Editar</span>
            </button>
            <M3KebabMenu
              ariaLabel="Más opciones del catedrático"
              items={[
                ...(onShareText
                  ? [
                      {
                        id: 'share-text',
                        label: 'Compartir como texto',
                        icon: <MessageSquareText className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
                        onClick: onShareText,
                      },
                    ]
                  : []),
                {
                  id: 'delete',
                  label: 'Eliminar catedrático',
                  icon: <Trash2 className="h-3.5 w-3.5" />,
                  variant: 'destructive' as const,
                  onClick: onDelete,
                },
              ]}
            />
          </>
        }
      />

      {/* Identidad: avatar, nombre y materias */}
      <section className={SECTION_CLASS} aria-labelledby="professor-detail-name">
        <div className="flex items-center gap-4">
          <ProfessorAvatar name={professor.name} icon={professor.icon} color={professor.color} size="xl" shape="circle" />
          <div className="min-w-0 flex-1">
            <h2
              id="professor-detail-name"
              className="break-words text-xl font-black leading-tight text-[var(--color-md-on-surface)] sm:text-2xl"
            >
              {professor.name}
            </h2>
            {subjects.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1" aria-label="Materias que imparte">
                {subjects.map((subject) => (
                  <li
                    key={subject.id}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-[var(--color-md-surface-container-high)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--color-md-on-surface-variant)]"
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: subject.color }} aria-hidden="true" />
                    <span className="truncate">{subject.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* Canales de contacto directo */}
      <section className={SECTION_CLASS}>
        <SectionTitle icon={<UserRound className="h-4 w-4" />}>Contacto directo</SectionTitle>
        <div className="flex flex-col">
          {phone && telHref && (
            <ContactRow icon={<Phone className="h-[18px] w-[18px]" />} label="Llamar" value={phone} href={telHref} tone="primary" />
          )}
          {email && (
            <ContactRow
              icon={<Mail className="h-[18px] w-[18px]" />}
              label="Enviar correo"
              value={email}
              href={`mailto:${email}`}
              tone={phone ? 'tonal' : 'primary'}
            />
          )}
          <ContactRow
            icon={<Share2 className="h-[18px] w-[18px]" />}
            label="Compartir contacto"
            value=".agcontact por WhatsApp"
            onClick={onShareAgcontact}
          />
        </div>
        {!phone && !email && (
          <p className="mt-2 text-xs text-[var(--color-md-on-surface-variant)]">
            No hay teléfono ni correo guardados. Agrégalos con «Editar».
          </p>
        )}
      </section>

      {/* Atención estudiantil */}
      <section className={SECTION_CLASS}>
        <SectionTitle icon={<CalendarCheck className="h-4 w-4" />}>Atención estudiantil</SectionTitle>
        {professor.office || professor.notes ? (
          <dl className="space-y-3">
            {professor.office && (
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">Cubículo u oficina</dt>
                  <dd className="break-words text-sm text-[var(--color-md-on-surface)]">{professor.office}</dd>
                </div>
              </div>
            )}
            {professor.notes && (
              <div className="flex items-start gap-3">
                <CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-md-primary)]" aria-hidden="true" />
                <div className="min-w-0">
                  <dt className="text-[11px] font-semibold text-[var(--color-md-on-surface-variant)]">Asesorías y notas</dt>
                  <dd className="whitespace-pre-line break-words text-sm text-[var(--color-md-on-surface)]">{professor.notes}</dd>
                </div>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">Sin cubículo ni horarios de asesoría guardados.</p>
        )}
      </section>

      {/* Materias que imparte */}
      <section className={SECTION_CLASS}>
        <SectionTitle icon={<BookOpen className="h-4 w-4" />}>Materias que imparte</SectionTitle>
        {subjects.length === 0 ? (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">Todavía no está vinculado a ninguna materia.</p>
        ) : (
          <ul className="flex flex-col">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <button
                  type="button"
                  onClick={() => onSelectSubject?.(subject)}
                  disabled={!onSelectSubject}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-[var(--color-md-surface-container)] disabled:pointer-events-none"
                >
                  <SubjectBadge icon={subject.icon} color={subject.color} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-[var(--color-md-on-surface)]">{subject.name}</span>
                    {subject.code && (
                      <span className="block font-mono text-[11px] text-[var(--color-md-on-surface-variant)]">{subject.code}</span>
                    )}
                  </span>
                  {onSelectSubject && (
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--color-md-on-surface-variant)]" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
