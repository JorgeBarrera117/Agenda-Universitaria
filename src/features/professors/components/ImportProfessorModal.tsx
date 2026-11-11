import React, { useState } from 'react';
import { AlertTriangle, BookOpen, Clock, Mail, MapPin, Phone, Plus, UserPlus } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/atoms';
import { M3Select, type M3SelectOption } from '../../../shared/components/M3Select';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import { SUBJECT_PRESET_COLORS } from '../../subjects/components/SubjectIcon';
import { useProfessors } from '../hooks/useProfessors';
import { ProfessorAvatar } from './ProfessorAvatar';
import {
  findProfessorByName,
  findSubjectByName,
  importProfessorPackage,
  type AgcontactSubjectLink,
  type ProfessorSharePackage,
} from '../services/professorShareService';

/** Valores especiales del selector de cada materia (los demás son ids de materias locales). */
const CREATE = '__create__';
const SKIP = '__skip__';

interface ImportProfessorModalProps {
  /** Paquete ya validado y limpio por parseAgcontactContent. */
  sharePackage: ProfessorSharePackage;
  onClose: () => void;
  onImported: (result: { name: string; linkedSubjects: number; createdSubjects: number }) => void;
}

interface ContactRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  multiline?: boolean;
}

const ContactRow: React.FC<ContactRowProps> = ({ icon, label, value, multiline }) => (
  <li className="flex items-start gap-2.5">
    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]">
      {icon}
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-md-on-surface-variant)]">{label}</p>
      <p
        className={`text-xs font-semibold text-[var(--color-md-on-surface)] ${
          multiline ? 'whitespace-pre-line leading-relaxed' : 'break-words'
        }`}
      >
        {value}
      </p>
    </div>
  </li>
);

/**
 * Vista previa de un docente compartido (.agcontact) y vínculo con las materias del estudiante.
 * Cada materia que imparte se empareja sola por nombre si ya existe; si no, se propone crearla o
 * dejarla sin asignar. Todo el contenido del archivo se muestra como texto (React lo escapa).
 */
export const ImportProfessorModal: React.FC<ImportProfessorModalProps> = ({ sharePackage, onClose, onImported }) => {
  const { subjects } = useSubjects();
  const { professors } = useProfessors();
  const { professor, subjectNames } = sharePackage;

  // Elecciones del usuario por materia entrante; la opción por defecto se deriva en cada render
  // porque las materias llegan de IndexedDB después del primer render
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [extraChoice, setExtraChoice] = useState<string>(SKIP);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const duplicate = findProfessorByName(professors, professor.name);
  const localOptions: M3SelectOption[] = subjects.map((s) => ({ value: s.id, label: s.name, sublabel: s.code, color: s.color }));
  const skipOption: M3SelectOption = { value: SKIP, label: 'No asignar' };

  const rows = subjectNames.map((name, index) => {
    const match = findSubjectByName(subjects, name);
    const selected = choices[name] ?? (match ? match.id : CREATE);
    const newColor = SUBJECT_PRESET_COLORS[(subjects.length + index) % SUBJECT_PRESET_COLORS.length];
    return { name, match, selected, newColor };
  });

  /** Materia local que ya tiene otro docente: al guardar, pasará a este. */
  const replacedProfessorName = (subjectId: string): string | undefined => {
    const subject = subjects.find((s) => s.id === subjectId);
    if (!subject?.professorId) return undefined;
    return professors.find((p) => p.id === subject.professorId)?.name;
  };

  const links: AgcontactSubjectLink[] =
    rows.length > 0
      ? rows.flatMap((row): AgcontactSubjectLink[] => {
          if (row.selected === SKIP) return [];
          if (row.selected === CREATE) return [{ kind: 'create', name: row.name, color: row.newColor }];
          return [{ kind: 'existing', subjectId: row.selected }];
        })
      : extraChoice === SKIP
        ? []
        : [{ kind: 'existing', subjectId: extraChoice }];

  const sharedOn = new Date(sharePackage.exportedAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const { createdSubjects } = await importProfessorPackage(sharePackage, links);
      const linkedSubjects = new Set(links.map((link) => (link.kind === 'existing' ? link.subjectId : link.name))).size;
      onImported({ name: professor.name, linkedSubjects, createdSubjects });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el catedrático.');
      setIsSaving(false);
    }
  };

  const hasContactData = Boolean(professor.email || professor.phone || professor.office || professor.notes);

  const renderReplaceWarning = (subjectId: string) => {
    const previous = replacedProfessorName(subjectId);
    if (!previous) return null;
    return (
      <p className="flex items-start gap-1.5 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Hoy la tiene asignada {previous}; al guardar pasará a este contacto.
      </p>
    );
  };

  return (
    <Modal isOpen onClose={onClose} title="Contacto compartido" maxWidth="md">
      <div className="space-y-4">
        {/* Encabezado: avatar con el color e ícono originales */}
        <section className="flex items-center gap-3 rounded-2xl border border-[var(--color-md-outline-variant)] bg-[var(--color-md-surface-container)] p-3">
          <ProfessorAvatar name={professor.name} icon={professor.icon} color={professor.color} size="xl" />
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-black text-[var(--color-md-on-surface)]">{professor.name}</h3>
            <p className="mt-0.5 text-[11px] text-[var(--color-md-on-surface-variant)]">Compartido el {sharedOn}</p>
          </div>
        </section>

        {duplicate && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            Ya tienes a «{duplicate.name}» en tus catedráticos. Si lo guardas, quedará como un contacto aparte.
          </p>
        )}

        {/* Datos de contacto */}
        {hasContactData ? (
          <ul className="space-y-2.5">
            {professor.email && <ContactRow icon={<Mail className="h-3.5 w-3.5" aria-hidden="true" />} label="Correo" value={professor.email} />}
            {professor.phone && <ContactRow icon={<Phone className="h-3.5 w-3.5" aria-hidden="true" />} label="Teléfono" value={professor.phone} />}
            {professor.office && <ContactRow icon={<MapPin className="h-3.5 w-3.5" aria-hidden="true" />} label="Cubículo" value={professor.office} />}
            {professor.notes && (
              <ContactRow icon={<Clock className="h-3.5 w-3.5" aria-hidden="true" />} label="Asesorías" value={professor.notes} multiline />
            )}
          </ul>
        ) : (
          <p className="text-xs italic text-[var(--color-md-on-surface-variant)]">El contacto no incluye correo, teléfono ni cubículo.</p>
        )}

        {/* Materias */}
        <section className="space-y-3 border-t border-[var(--color-md-outline-variant)] pt-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-[var(--color-md-on-surface)]">
            <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
            {rows.length > 0 ? 'Materias que imparte' : 'Materia'}
          </p>

          {rows.map((row) => (
            <div key={row.name} className="space-y-1.5">
              <M3Select
                label={`«${row.name}»`}
                value={row.selected}
                onChange={(value) => setChoices((prev) => ({ ...prev, [row.name]: value }))}
                options={[
                  ...localOptions,
                  {
                    value: CREATE,
                    label: `Crear materia «${row.name}»`,
                    color: row.newColor,
                    icon: <Plus className="h-4 w-4" aria-hidden="true" />,
                  },
                  skipOption,
                ]}
              />
              {row.match && row.selected === row.match.id && (
                <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">Ya tienes esta materia: se vinculará.</p>
              )}
              {!row.match && row.selected === CREATE && (
                <p className="text-[11px] text-[var(--color-md-on-surface-variant)]">No la tienes: se creará al guardar.</p>
              )}
              {row.selected !== CREATE && row.selected !== SKIP && renderReplaceWarning(row.selected)}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="space-y-1.5">
              <M3Select
                label="Vincular a una de tus materias (opcional)"
                value={extraChoice}
                onChange={(value) => setExtraChoice(value)}
                options={[skipOption, ...localOptions]}
              />
              {extraChoice !== SKIP && renderReplaceWarning(extraChoice)}
            </div>
          )}
        </section>

        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 border-t border-[var(--color-md-outline-variant)] pt-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<UserPlus className="h-4 w-4" aria-hidden="true" />}
            isLoading={isSaving}
            onClick={() => void handleSave()}
          >
            Guardar catedrático
          </Button>
        </div>
      </div>
    </Modal>
  );
};
