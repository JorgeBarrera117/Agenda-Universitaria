import React, { useState } from 'react';
import { Plus, X, GraduationCap, UserCheck, ArrowLeft, Check, UserX } from 'lucide-react';
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

  // Soporte de navegación con botón "Atrás" físico de Android
  useBackButton(() => {
    onCancel();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  const selectedProfessor = professors.find((p) => p.id === professorId);

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
    <form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in duration-200 pb-10">
      {/* 1. Barra Superior Fija (Material Design 3 Top App Bar) */}
      <div className="sticky top-0 z-30 -mx-3 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 py-3 bg-[#FDFBFF]/95 dark:bg-[#14171B]/95 backdrop-blur-xl border-b border-[#C3C7D0]/40 dark:border-[#43474E]/40 flex items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Volver al catálogo"
            title="Volver"
            className="w-10 h-10 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center justify-center text-[#191C20] dark:text-[#E2E2E6] transition-all active:scale-90 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {initialData ? 'Editar Asignatura' : 'Inscribir Asignatura'}
            </h2>
            <p className="text-[11px] text-[#43474E] dark:text-[#8C9199] truncate leading-none mt-0.5">
              {code.trim() ? `${code.trim()} • Plan Curricular` : 'Plan de Estudios Semestral'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="hidden sm:inline-flex px-4 py-2 rounded-full text-xs font-semibold text-[#43474E] dark:text-[#C3C7D0] hover:bg-[#E2E7EF] dark:hover:bg-[#272A2F] transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-white dark:text-[#003353] bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] active:scale-95 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[2.5]" />
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

      {/* Tarjeta 1: Identidad Visual y Live Preview */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        {/* Previsualización en Vivo de la Asignatura */}
        <div className="p-3.5 bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl flex items-center gap-3.5">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/40 shrink-0 transition-transform active:scale-95"
            style={{ backgroundColor: color }}
          >
            <SubjectIcon icon={icon} className="w-7 h-7 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-mono font-black bg-black text-white dark:bg-white dark:text-black shadow-2xs tracking-wider">
                {code.trim() || 'ASIGNATURA'}
              </span>
              {credits !== undefined && credits > 0 && (
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-950/50 border border-amber-300/60 dark:border-amber-700/60 px-1.5 py-0.5 rounded-md">
                  {credits} Créditos
                </span>
              )}
            </div>
            <h4 className="text-base font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {name.trim() || 'Nombre de la Materia'}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-[#72777F] dark:text-[#8C9199] truncate mt-1">
              <span>{classroomDefault.trim() || 'Aula por asignar'}</span>
              {selectedProfessor && (
                <>
                  <span>•</span>
                  <span className="font-bold text-[#00639B] dark:text-[#92CCFF] flex items-center gap-1 truncate">
                    <UserCheck className="w-3.5 h-3.5 shrink-0" />
                    {selectedProfessor.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 1. Selector de Ícono Temático */}
        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-2">
            1. Elige un ícono temático
          </label>
          <div className="flex gap-2 overflow-x-auto p-1 scrollbar-none">
            {SUBJECT_ICONS.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = icon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  title={opt.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-xs'
                      : 'bg-[#F1F4FA] dark:bg-[#272A2F] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
                  }`}
                >
                  <IconComp className="w-4 h-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Selector de Color Distintivo */}
        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-2">
            2. Color distintivo de la materia
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {SUBJECT_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-8 h-8 rounded-xl border-2 transition-transform cursor-pointer shrink-0 ${
                  color.toLowerCase() === c.toLowerCase()
                    ? 'scale-115 border-[#191C20] dark:border-[#E2E2E6] ring-2 ring-[#00639B] shadow-md'
                    : 'border-white dark:border-[#1D2024] hover:scale-105 shadow-2xs'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            {/* Color picker personalizado */}
            <label
              className="w-8 h-8 rounded-xl border-2 border-dashed border-[#C3C7D0] dark:border-[#43474E] hover:border-[#00639B] dark:hover:border-[#92CCFF] flex items-center justify-center cursor-pointer transition-transform hover:scale-105 bg-[#F1F4FA] dark:bg-[#272A2F] relative overflow-hidden shrink-0"
              title="Elegir otro color personalizado"
            >
              <span className="text-sm font-black text-[#72777F] dark:text-[#8C9199]">+</span>
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

      {/* Tarjeta 2: Datos Académicos */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
          Información Curricular
        </h3>

        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
            Nombre de la Asignatura *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Cálculo Integral, Arquitectura de Software, Robótica"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
              Código / Clave Curricular
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: INF-301, MAT-102"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
              Créditos Académicos
            </label>
            <input
              type="number"
              min="0"
              max="40"
              value={credits ?? ''}
              onChange={(e) => setCredits(e.target.value ? Number(e.target.value) : undefined)}
              placeholder="Ej: 6"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
            Aula habitual / Edificio o Modalidad
          </label>
          <input
            type="text"
            value={classroomDefault}
            onChange={(e) => setClassroomDefault(e.target.value)}
            placeholder="Ej: Aula 204, Edificio de Cómputo o Virtual Zoom"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
          />
        </div>
      </div>

      {/* Tarjeta 3: Docente Titular Asignado */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
              Docente / Profesor Titular
            </label>
            <p className="text-[11px] text-[#72777F] dark:text-[#8C9199]">
              Se vinculará automáticamente al programar clases de esta materia.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingProf(!isCreatingProf)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-[#00639B] dark:text-[#92CCFF] bg-[#D0E4FF] dark:bg-[#004B76] hover:bg-[#b9d7ff] dark:hover:bg-[#005d92] rounded-full transition-colors cursor-pointer shadow-2xs"
          >
            {isCreatingProf ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isCreatingProf ? 'Cancelar' : 'Nuevo Docente'}</span>
          </button>
        </div>

        {/* Panel de Creación Rápida Inline */}
        {isCreatingProf && (
          <div className="p-3.5 bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#00639B]/30 dark:border-[#92CCFF]/30 rounded-2xl space-y-3 shadow-xs">
            <div className="text-xs font-black text-[#191C20] dark:text-[#E2E2E6] flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-[#00639B] dark:text-[#92CCFF]" />
              <span>Registrar Catedrático Rápido</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                placeholder="Nombre del Docente *"
                value={newProfName}
                onChange={(e) => setNewProfName(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00639B] font-medium text-[#191C20] dark:text-[#E2E2E6] bg-white dark:bg-[#1D2024]"
              />
              <input
                type="text"
                placeholder="Cubículo / Oficina (opcional)"
                value={newProfOffice}
                onChange={(e) => setNewProfOffice(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00639B] font-medium text-[#191C20] dark:text-[#E2E2E6] bg-white dark:bg-[#1D2024]"
              />
            </div>
            <input
              type="email"
              placeholder="Correo electrónico (opcional)"
              value={newProfEmail}
              onChange={(e) => setNewProfEmail(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#C3C7D0]/60 dark:border-[#43474E]/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#00639B] font-medium text-[#191C20] dark:text-[#E2E2E6] bg-white dark:bg-[#1D2024]"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingProf(false)}
                className="px-3.5 py-1.5 text-xs font-medium text-[#43474E] dark:text-[#C3C7D0] hover:bg-[#E2E7EF] dark:hover:bg-[#1D2024] rounded-full transition-colors cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={!newProfName.trim() || isSavingProf}
                onClick={handleQuickCreateProfessor}
                className="px-4 py-1.5 text-xs font-bold text-white dark:text-[#003353] bg-[#00639B] hover:bg-[#005282] dark:bg-[#92CCFF] dark:hover:bg-[#72BAF5] disabled:opacity-50 rounded-full shadow-xs transition-colors cursor-pointer"
              >
                {isSavingProf ? 'Guardando...' : 'Crear y Asignar'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2.5">
          <M3Select
            value={professorId}
            onChange={(val) => setProfessorId(val)}
            options={[
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
            ]}
            placeholder="-- Sin profesor asignado --"
          />

          {/* Badge del profesor seleccionado */}
          {selectedProfessor && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <ProfessorAvatar
                  name={selectedProfessor.name}
                  icon={selectedProfessor.icon}
                  color={selectedProfessor.color}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] truncate">
                    {selectedProfessor.name}
                  </div>
                  <div className="text-[11px] text-[#72777F] dark:text-[#8C9199] truncate">
                    {selectedProfessor.office || selectedProfessor.email || 'Docente titular'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfessorId('')}
                className="text-xs text-[#72777F] hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                title="Quitar docente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </form>
  );
};
