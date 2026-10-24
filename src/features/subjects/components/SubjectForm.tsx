import React, { useState, useMemo } from 'react';
import { Plus, X, GraduationCap, ArrowLeft, Check, UserX } from 'lucide-react';
import type { Subject, CreateSubjectDTO } from '../types';
import {
  SubjectIcon,
  SUBJECT_ICONS,
  SUBJECT_PRESET_COLORS,
} from './SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';
import { M3Select } from '../../../shared/components/M3Select';
import { ContextualToast } from '../../../shared/components/ContextualToast';

interface SubjectFormProps {
  initialData?: Subject;
  onSubmit: (data: CreateSubjectDTO) => Promise<void>;
  onCancel: () => void;
}

export const SubjectForm: React.FC<SubjectFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { professors, addProfessor } = useProfessors();

  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [color, setColor] = useState(initialData?.color || SUBJECT_PRESET_COLORS[0]);
  const [icon, setIcon] = useState(initialData?.icon || 'book');
  const [credits, setCredits] = useState<number | undefined>(initialData?.credits);
  const [classroomDefault, setClassroomDefault] = useState(initialData?.classroomDefault || '');
  const [professorId, setProfessorId] = useState<string>(initialData?.professorId || '');

  // Estado para creación rápida de docente inline
  const [isCreatingProf, setIsCreatingProf] = useState(false);
  const [newProfName, setNewProfName] = useState('');
  const [newProfOffice, setNewProfOffice] = useState('');
  const [newProfEmail, setNewProfEmail] = useState('');
  const [isSavingProf, setIsSavingProf] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Soporte de navegación con botón "Atrás" de Android
  useBackButton(() => {
    onCancel();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  const selectedProfessor = useMemo(
    () => professors.find((p) => p.id === professorId),
    [professors, professorId]
  );

  // Opciones de profesor para M3Select memoizadas
  const professorOptions = useMemo(
    () => [
      {
        value: '',
        label: '-- Sin profesor asignado --',
        icon: (
          <div className="w-6 h-6 rounded-lg bg-[#E2E7EF] dark:bg-[#272A2F] text-[#72777F] dark:text-[#8C9199] flex items-center justify-center shrink-0">
            <UserX className="w-3.5 h-3.5" />
          </div>
        ),
      },
      ...professors.map((p) => ({
        value: p.id,
        label: p.name,
        sublabel: p.office || p.email,
        color: p.color,
        icon: (
          <ProfessorAvatar
            name={p.name}
            icon={p.icon}
            color={p.color}
            size="select"
            shape="squircle"
          />
        ),
      })),
    ],
    [professors]
  );

  const handleQuickCreateProfessor = async () => {
    if (!newProfName.trim()) return;
    try {
      setIsSavingProf(true);
      const created = await addProfessor({
        name: newProfName.trim(),
        office: newProfOffice.trim() || undefined,
        email: newProfEmail.trim() || undefined,
        subjectIds: [],
        icon: 'user',
        color: '#081d33',
      });
      setProfessorId(created.id);
      setIsCreatingProf(false);
      setNewProfName('');
      setNewProfOffice('');
      setNewProfEmail('');
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setIsSavingProf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre de la materia es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        code: code.trim() || undefined,
        color,
        icon,
        credits: credits !== undefined && !isNaN(Number(credits)) ? Number(credits) : undefined,
        classroomDefault: classroomDefault.trim() || undefined,
        professorId: professorId || undefined,
      });
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('Ocurrió un error inesperado');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 animate-in fade-in duration-150 pb-8">
      {/* 1. Barra Superior Compacta (Top App Bar) */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 py-2.5 bg-[#FDFBFF]/95 dark:bg-[#14171B]/95 backdrop-blur-xl border-b border-[#C3C7D0]/40 dark:border-[#43474E]/40 flex items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver al catálogo"
            title="Volver"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center justify-center text-[#191C20] dark:text-[#E2E2E6] transition-all active:scale-90 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {initialData ? 'Editar Asignatura' : 'Inscribir Asignatura'}
            </h2>
            <p className="text-[10px] sm:text-[11px] text-[#43474E] dark:text-[#8C9199] truncate leading-none mt-0.5">
              {code.trim() ? `${code.trim()} • Plan Curricular` : 'Plan de Estudios Semestral'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#43474E] dark:text-[#C3C7D0] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white dark:text-[#003353] bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[2.8]" />
            <span>{isSubmitting ? 'Guardando...' : initialData ? 'Actualizar' : 'Guardar'}</span>
          </button>
        </div>
      </div>

      <ContextualToast
        message={error}
        variant="error"
        bottomOffset="compact"
        onClose={() => setError(null)}
      />

      {/* 2. Píldora de Estado Compacta (Live Status Strip) */}
      <div className="px-3 py-2 rounded-2xl bg-[var(--color-md-surface-container)] border border-[var(--color-md-outline-variant)] flex items-center justify-between gap-2.5 text-xs shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center text-white shrink-0 shadow-2xs transition-transform active:scale-95"
            style={{ backgroundColor: color }}
          >
            <SubjectIcon icon={icon} className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-[#191C20] dark:text-[#E2E2E6] truncate block leading-tight">
              {name.trim() || 'Nombre de la Materia'}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-[#72777F] dark:text-[#8C9199] font-mono mt-0.5">
              <span>{code.trim() || 'ASIGNATURA'}</span>
              {credits !== undefined && credits > 0 && (
                <>
                  <span>•</span>
                  <span>{credits} créditos</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
          {selectedProfessor ? (
            <span className="inline-flex items-center gap-1 font-medium text-[#43474E] dark:text-[#C3C7D0] bg-[var(--color-md-card-bg)] px-2 py-0.5 rounded-lg border border-[var(--color-md-outline-variant)] truncate max-w-[140px]">
              Prof. {selectedProfessor.name}
            </span>
          ) : (
            <span className="text-[10px] text-[#72777F] dark:text-[#8C9199] italic hidden sm:inline">
              Sin docente
            </span>
          )}
        </div>
      </div>

      {/* 3. Selector Compacto de Ícono y Color */}
      <div className="p-3 sm:p-4 bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] rounded-2xl sm:rounded-3xl shadow-xs space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          {/* Fila de Colores Distintivos */}
          <div className="space-y-1">
            <span className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
              Color Distintivo
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SUBJECT_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg border transition-transform cursor-pointer shrink-0 ${
                    color.toLowerCase() === c.toLowerCase()
                      ? 'scale-115 border-[#191C20] dark:border-[#E2E2E6] ring-2 ring-[#00639B] shadow-xs'
                      : 'border-white/80 dark:border-[#1D2024] hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Color ${c}`}
                />
              ))}
              <label
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg border border-dashed border-[#C3C7D0] dark:border-[#43474E] hover:border-[#00639B] dark:hover:border-[#92CCFF] flex items-center justify-center cursor-pointer transition-transform hover:scale-105 bg-[#F1F4FA] dark:bg-[#272A2F] relative overflow-hidden shrink-0"
                title="Color personalizado"
              >
                <span className="text-xs font-black text-[#72777F]">+</span>
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="opacity-0 absolute inset-0 cursor-pointer w-full h-full"
                />
              </label>
            </div>
          </div>
        </div>

        {/* Fila de Íconos Temáticos Condensados */}
        <div className="space-y-1 pt-1.5 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30">
          <span className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
            Ícono Temático
          </span>
          <div className="flex gap-1.5 overflow-x-auto p-0.5 custom-scrollbar">
            {SUBJECT_ICONS.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = icon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  title={opt.label}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-2xs'
                      : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Formulario Principal de Datos Curriculares */}
      <div className="p-3.5 sm:p-5 bg-[var(--color-md-card-bg)] border border-[var(--color-md-outline-variant)] rounded-2xl sm:rounded-3xl shadow-xs space-y-3.5">
        
        {/* Fila 1: Nombre de la Materia */}
        <div>
          <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
            Nombre de la Asignatura *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cálculo Integral, Arquitectura de Software, Robótica"
            className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm transition-all"
            required
          />
        </div>

        {/* Fila 2: Código + Créditos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
              Código / Sigla Curricular (Opcional)
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: INF-301, MAT-102"
              className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm font-mono"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
              Créditos Académicos (Opcional)
            </label>
            <input
              type="number"
              min="0"
              max="40"
              value={credits ?? ''}
              onChange={(e) => setCredits(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Ej: 6"
              className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm"
            />
          </div>
        </div>

        {/* Fila 3: Aula Habitual o Modalidad */}
        <div>
          <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1 uppercase tracking-wider">
            Aula Habitual / Edificio o Modalidad
          </label>
          <input
            type="text"
            value={classroomDefault}
            onChange={(e) => setClassroomDefault(e.target.value)}
            placeholder="Ej: Aula 204, Edificio de Cómputo o Virtual Zoom"
            className="w-full px-3 py-2 rounded-xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/40 dark:bg-[#272A2F]/40 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-xs sm:text-sm"
          />
        </div>

        {/* Fila 4: Catedrático Titular */}
        <div className="pt-2 border-t border-[#C3C7D0]/30 dark:border-[#43474E]/30 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <label className="block text-[11px] font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
                Docente Titular
              </label>
              <p className="text-[10px] text-[#72777F] dark:text-[#8C9199]">
                Se vinculará automáticamente al crear clases en el horario.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreatingProf(!isCreatingProf)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF] dark:bg-[#004B76] hover:opacity-90 rounded-full transition-all cursor-pointer shadow-2xs"
            >
              {isCreatingProf ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              <span>{isCreatingProf ? 'Cancelar' : 'Nuevo Docente'}</span>
            </button>
          </div>

          {/* Panel de Creación Rápida Inline */}
          {isCreatingProf && (
            <div className="p-2.5 bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#00639B]/30 dark:border-[#92CCFF]/30 rounded-xl space-y-2 shadow-2xs">
              <div className="text-[11px] font-black text-[#191C20] dark:text-[#E2E2E6] flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#00639B] dark:text-[#92CCFF]" />
                <span>Registrar Catedrático Rápido</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Nombre del Docente *"
                  value={newProfName}
                  onChange={(e) => setNewProfName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00639B] font-medium text-[#191C20] dark:text-[#E2E2E6] bg-white dark:bg-[#1D2024]"
                />
                <input
                  type="text"
                  placeholder="Cubículo / Oficina (opcional)"
                  value={newProfOffice}
                  onChange={(e) => setNewProfOffice(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00639B] font-medium text-[#191C20] dark:text-[#E2E2E6] bg-white dark:bg-[#1D2024]"
                />
              </div>
              <div className="flex justify-end gap-1.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => setIsCreatingProf(false)}
                  className="px-2.5 py-1 text-[11px] font-medium text-[#43474E] dark:text-[#C3C7D0] hover:bg-slate-200 dark:hover:bg-white/10 rounded-full cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="button"
                  disabled={!newProfName.trim() || isSavingProf}
                  onClick={handleQuickCreateProfessor}
                  className="px-3 py-1 text-[11px] font-bold text-white dark:text-[#003353] bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] disabled:opacity-50 rounded-full shadow-2xs transition-colors cursor-pointer"
                >
                  {isSavingProf ? 'Guardando...' : 'Crear y Asignar'}
                </button>
              </div>
            </div>
          )}

          <M3Select
            value={professorId}
            onChange={(val) => setProfessorId(val)}
            options={professorOptions}
            placeholder="-- Sin profesor asignado --"
          />
        </div>
      </div>
    </form>
  );
};
