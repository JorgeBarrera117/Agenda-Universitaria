import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Professor, CreateProfessorDTO } from '../types';
import {
  ProfessorAvatar,
  PROFESSOR_ICONS,
  PROFESSOR_PRESET_COLORS,
} from './ProfessorAvatar';
import { useBackButton, BACK_PRIORITY } from '../../../shared/hooks/useBackButton';

interface ProfessorFormProps {
  initialData?: Professor;
  onSubmit: (data: CreateProfessorDTO) => Promise<void>;
  onCancel: () => void;
}

export const ProfessorForm: React.FC<ProfessorFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const { subjects } = useSubjects();

  const [name, setName] = useState(initialData?.name || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [office, setOffice] = useState(initialData?.office || '');
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<string[]>(
    initialData?.subjectIds || []
  );
  const [icon, setIcon] = useState(initialData?.icon || 'user');
  const [color, setColor] = useState(initialData?.color || '#081d33');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Soporte de navegación con botón "Atrás" de Android
  useBackButton(() => {
    onCancel();
    return true;
  }, BACK_PRIORITY.MODAL, true);

  const toggleSubject = (subjectId: string) => {
    setSelectedSubjectIds((prev) =>
      prev.includes(subjectId)
        ? prev.filter((id) => id !== subjectId)
        : [...prev, subjectId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del profesor es obligatorio.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        office: office.trim() || undefined,
        notes: notes.trim() || undefined,
        subjectIds: selectedSubjectIds,
        icon,
        color,
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
            aria-label="Volver al directorio docente"
            title="Volver"
            className="w-10 h-10 rounded-full bg-[#E2E7EF] dark:bg-[#272A2F] hover:bg-[#D0E4FF] dark:hover:bg-[#004B76] flex items-center justify-center text-[#191C20] dark:text-[#E2E2E6] transition-all active:scale-90 cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-[#191C20] dark:text-[#E2E2E6] truncate leading-tight">
              {initialData ? 'Editar Catedrático' : 'Registrar Catedrático'}
            </h2>
            <p className="text-[11px] text-[#43474E] dark:text-[#8C9199] truncate leading-none mt-0.5">
              {name.trim() || 'Directorio Docente y Asesorías'}
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

      {error && (
        <div className="p-3.5 text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tarjeta 1: Avatar y Muñequito del Docente */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        {/* Vista previa en vivo */}
        <div className="p-3.5 bg-[#F1F4FA] dark:bg-[#272A2F] border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl flex items-center gap-3.5">
          <ProfessorAvatar
            name={name || 'Docente'}
            icon={icon}
            color={color}
            size="xl"
            className="ring-2 ring-[#00639B]/30 shadow-xs"
          />

          <div className="min-w-0 flex-1">
            <span className="block text-xs font-black text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-0.5">
              Avatar y Color Distintivo
            </span>
            <p className="text-[11px] text-[#72777F] dark:text-[#8C9199] leading-snug">
              Personaliza el muñequito y el tono de fondo para identificarlo rápidamente en el horario.
            </p>
          </div>
        </div>

        {/* 1. Selector de Ícono */}
        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-2">
            1. Elige un ícono o muñequito
          </label>
          <div className="flex gap-2 overflow-x-auto p-1 scrollbar-none">
            {PROFESSOR_ICONS.map((opt) => {
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

        {/* 2. Selector de Color de Fondo */}
        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider mb-2">
            2. Color de fondo del avatar
          </label>
          <div className="flex items-center gap-2.5 flex-wrap">
            {PROFESSOR_PRESET_COLORS.map((c) => (
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

      {/* Tarjeta 2: Datos Personales y Contacto */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
          Información Personal y Contacto
        </h3>

        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
            Nombre completo del docente *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Dra. María Fernández, Ing. Roberto Silva"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="profesor@universidad.edu"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
              Teléfono / WhatsApp
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+52 55 1234 5678"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
            Cubículo / Oficina / Sala Virtual
          </label>
          <input
            type="text"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            placeholder="Ej: Edificio C, Cubículo 204 o Enlace de Zoom"
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all"
          />
        </div>
      </div>

      {/* Tarjeta 3: Materias y Horarios de Asesoría */}
      <div className="p-4 sm:p-5 bg-[#FDFBFF] dark:bg-[#1D2024] border border-[#C3C7D0]/50 dark:border-[#43474E]/40 rounded-[28px] shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] uppercase tracking-wider">
          Cátedras y Asesorías
        </h3>

        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
            Materias que imparte
          </label>
          {subjects.length === 0 ? (
            <p className="text-xs text-[#72777F] dark:text-[#8C9199] italic">
              Primero inscribe asignaturas en la sección de materias para vincularlas aquí.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 p-3 border border-[#C3C7D0]/40 dark:border-[#43474E]/40 rounded-2xl bg-[#F1F4FA] dark:bg-[#272A2F]">
              {subjects.map((sub) => {
                const isSelected = selectedSubjectIds.includes(sub.id);
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => toggleSubject(sub.id)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#D0E4FF] dark:bg-[#004B76] text-[#001D32] dark:text-[#D0E4FF] border-[#00639B] dark:border-[#92CCFF] shadow-xs'
                        : 'bg-white dark:bg-[#1D2024] text-[#43474E] dark:text-[#C3C7D0] border-[#C3C7D0]/40 dark:border-[#43474E]/40 hover:border-[#72777F]'
                    }`}
                  >
                    {sub.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-[#191C20] dark:text-[#E2E2E6] mb-1.5">
            Horarios de Asesoría o Notas Adicionales
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: Asesorías los viernes a las 11:00 am previa cita por correo."
            className="w-full px-3.5 py-2.5 rounded-2xl border border-[#C3C7D0]/60 dark:border-[#43474E]/60 bg-[#E2E7EF]/50 dark:bg-[#272A2F]/50 text-[#191C20] dark:text-[#E2E2E6] placeholder:text-[#72777F] focus:outline-none focus:ring-2 focus:ring-[#00639B] dark:focus:ring-[#92CCFF] font-medium text-sm transition-all resize-none"
          />
        </div>
      </div>
    </form>
  );
};
