import React from 'react';
import { BookOpen, CalendarCheck, Edit2, Mail, MapPin, MessageSquareText, Phone, Share2, Trash2, UserRound } from 'lucide-react';
import { M3KebabMenu } from '../../../shared/components/M3KebabMenu';
import { PAGE_HEADER_PRIMARY_BUTTON } from '../../../shared/components/PageHeader';
import {
  DetailAction,
  DetailActions,
  DetailHero,
  DetailRow,
  DetailRows,
  DetailScreen,
  DetailSection,
} from '../../../shared/components/detail/DetailKit';
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
  /** Abre "Contacto": llamar, WhatsApp, Telegram o guardarlo en la app que elija el estudiante. */
  onOpenContact: () => void;
  onSelectSubject?: (subject: Subject) => void;
}

const ROW_ICON = 'h-[18px] w-[18px]';

/**
 * Ficha de un catedrático (mismo patrón que las demás fichas): lo que más se hace es contactarlo,
 * así que «Contacto» (llamar, WhatsApp, Telegram o guardar) y «Correo» van destacados debajo de
 * su nombre; luego su atención estudiantil y las materias que imparte.
 */
export const ProfessorDetailView: React.FC<ProfessorDetailViewProps> = ({
  professor,
  subjects,
  onBack,
  onEdit,
  onDelete,
  onShareAgcontact,
  onShareText,
  onOpenContact,
  onSelectSubject,
}) => {
  const phone = professor.phone?.trim();
  const email = professor.email?.trim();
  const tint = professor.color ?? subjects[0]?.color;

  return (
    <DetailScreen
      title="Catedrático"
      subtitle="Profesores"
      onBack={onBack}
      backLabel="Volver a profesores"
      actions={
        <>
          <button type="button" onClick={onEdit} className={PAGE_HEADER_PRIMARY_BUTTON}>
            <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Editar</span>
          </button>
          <M3KebabMenu
            ariaLabel="Más opciones del catedrático"
            items={[
              {
                id: 'share',
                label: 'Compartir contacto',
                icon: <Share2 className="h-3.5 w-3.5 text-[var(--color-md-primary)]" />,
                onClick: onShareAgcontact,
              },
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
    >
      <DetailHero
        color={tint}
        titleId="professor-detail-name"
        leading={<ProfessorAvatar name={professor.name} icon={professor.icon} color={professor.color} size="xl" shape="circle" />}
        kicker={subjects.length === 1 ? subjects[0].name : subjects.length > 1 ? `${subjects.length} materias` : 'Catedrático'}
        title={professor.name}
        actions={
          <DetailActions>
            {phone && (
              <DetailAction
                variant="primary"
                icon={<Phone className="h-4 w-4" aria-hidden="true" />}
                label="Contacto"
                ariaLabel={`Contactar a ${professor.name}: llamar, WhatsApp, Telegram o guardar`}
                onClick={onOpenContact}
              />
            )}
            {email && (
              <DetailAction
                variant={phone ? 'tonal' : 'primary'}
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
                label="Correo"
                ariaLabel={`Escribir un correo a ${professor.name}`}
                href={`mailto:${email}`}
              />
            )}
            {!phone && !email && (
              <DetailAction variant="outlined" icon={<Edit2 className="h-4 w-4" aria-hidden="true" />} label="Agregar teléfono o correo" onClick={onEdit} />
            )}
          </DetailActions>
        }
      />

      {(phone || email) && (
        <DetailSection icon={<UserRound className="h-4 w-4" />} title="Datos de contacto">
          <DetailRows>
            {phone && <DetailRow icon={<Phone className={ROW_ICON} />} label="Teléfono" value={phone} onClick={onOpenContact} />}
            {email && <DetailRow icon={<Mail className={ROW_ICON} />} label="Correo" value={email} href={`mailto:${email}`} />}
          </DetailRows>
        </DetailSection>
      )}

      <DetailSection icon={<CalendarCheck className="h-4 w-4" />} title="Atención estudiantil">
        {professor.office || professor.notes ? (
          <DetailRows>
            {professor.office && <DetailRow icon={<MapPin className={ROW_ICON} />} label="Cubículo u oficina" value={professor.office} />}
            {professor.notes && (
              <DetailRow icon={<CalendarCheck className={ROW_ICON} />} label="Asesorías y notas" value={professor.notes} multiline />
            )}
          </DetailRows>
        ) : (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">Sin cubículo ni horarios de asesoría guardados.</p>
        )}
      </DetailSection>

      <DetailSection icon={<BookOpen className="h-4 w-4" />} title="Materias que imparte">
        {subjects.length === 0 ? (
          <p className="text-xs text-[var(--color-md-on-surface-variant)]">Todavía no está vinculado a ninguna materia.</p>
        ) : (
          <DetailRows>
            {subjects.map((subject) => (
              <DetailRow
                key={subject.id}
                icon={null}
                leading={<SubjectBadge icon={subject.icon} color={subject.color} size="lg" />}
                label={subject.code || 'Materia'}
                value={<span className="font-bold">{subject.name}</span>}
                onClick={onSelectSubject ? () => onSelectSubject(subject) : undefined}
              />
            ))}
          </DetailRows>
        )}
      </DetailSection>
    </DetailScreen>
  );
};
