import React, { useState } from 'react';
import { Plus, X, GraduationCap, UserCheck } from 'lucide-react';
import type { Subject, CreateSubjectDTO } from '../types';
import {
  SubjectIcon,
  SUBJECT_ICONS,
  SUBJECT_PRESET_COLORS,
} from './SubjectIcon';
import { useProfessors } from '../../professors/hooks/useProfessors';
import { ProfessorAvatar } from '../../professors/components/ProfessorAvatar';

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
          {error}
        </div>
      )}

      {/* Tarjeta de Identidad Visual: Ícono, Color y Live Preview */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
        <div className="flex items-center gap-3.5">
          {/* Vista previa en vivo del icono y color */}
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md ring-2 ring-white/40 shrink-0 transition-transform active:scale-95"
            style={{ backgroundColor: color }}
          >
            <SubjectIcon icon={icon} className="w-7 h-7 text-white" />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-black bg-cove-navy text-white shadow-2xs tracking-wider">
                {code.trim() || 'ASIGNATURA'}
              </span>
              {credits !== undefined && credits > 0 && (
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100/70 border border-amber-300/60 px-1.5 py-0.5 rounded-md">
                  {credits} Créditos
                </span>
              )}
            </div>
            <h4 className="text-sm font-black text-slate-900 truncate">
              {name.trim() || 'Nombre de la Materia'}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 truncate mt-0.5">
              <span>{classroomDefault.trim() || 'Aula por asignar'}</span>
              {selectedProfessor && (
                <>
                  <span>•</span>
                  <span className="font-bold text-cove-blue flex items-center gap-1 truncate">
                    <UserCheck className="w-3 h-3 text-cove-sky shrink-0" />
                    {selectedProfessor.name}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 1. Selector de Ícono Temático */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
            1. Elige un ícono para la materia
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {SUBJECT_ICONS.map((opt) => {
              const IconComp = opt.icon;
              const isSelected = icon === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIcon(opt.id)}
                  title={opt.label}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold shrink-0 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cove-navy text-white border-cove-navy shadow-xs ring-2 ring-cove-sky/40'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Selector de Color Característico */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
            2. Color característico de la materia
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {SUBJECT_PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer shrink-0 ${
                  color.toLowerCase() === c.toLowerCase()
                    ? 'scale-115 border-slate-900 ring-2 ring-cove-sky shadow-sm'
                    : 'border-white hover:scale-105 shadow-2xs'
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
            {/* Color picker nativo */}
            <label
              className="w-7 h-7 rounded-xl border-2 border-dashed border-slate-300 hover:border-cove-blue flex items-center justify-center cursor-pointer transition-transform hover:scale-105 bg-white relative overflow-hidden shrink-0"
              title="Elegir otro color personalizado"
            >
              <span className="text-xs font-black text-slate-500">+</span>
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

      {/* Datos Académicos */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nombre de la Materia *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Cálculo Integral, Arquitectura de Software"
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 font-medium"
          required
        />
      </div>

      {/* Selector de Profesor / Docente Asignado */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="block text-xs font-bold text-slate-800">
              Profesor / Docente Titular
            </label>
            <p className="text-[11px] text-slate-500">
              Se vinculará automáticamente a tus clases en el horario.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsCreatingProf(!isCreatingProf)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-cove-blue bg-cove-blue/10 hover:bg-cove-blue/20 rounded-lg transition-colors cursor-pointer"
          >
            {isCreatingProf ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {isCreatingProf ? 'Cancelar' : 'Nuevo Docente'}
          </button>
        </div>

        {/* Panel de Creación Rápida Inline */}
        {isCreatingProf && (
          <div className="p-3 bg-white border border-cove-sky/50 rounded-xl space-y-2.5 shadow-2xs">
            <div className="text-xs font-black text-cove-navy flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-cove-blue" />
              <span>Registrar Docente Rápido</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre del Docente *"
                value={newProfName}
                onChange={(e) => setNewProfName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cove-blue font-medium"
              />
              <input
                type="text"
                placeholder="Cubículo / Oficina (opcional)"
                value={newProfOffice}
                onChange={(e) => setNewProfOffice(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cove-blue font-medium"
              />
            </div>
            <input
              type="email"
              placeholder="Correo electrónico (opcional)"
              value={newProfEmail}
              onChange={(e) => setNewProfEmail(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-cove-blue font-medium"
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingProf(false)}
                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={!newProfName.trim() || isSavingProf}
                onClick={handleQuickCreateProfessor}
                className="px-3 py-1 text-xs font-bold text-white bg-cove-blue hover:bg-cove-deep disabled:opacity-50 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                {isSavingProf ? 'Guardando...' : 'Crear y Asignar'}
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <select
            value={professorId}
            onChange={(e) => setProfessorId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 font-medium bg-white text-sm"
          >
            <option value="">-- Sin profesor asignado --</option>
            {professors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.office ? `(${p.office})` : ''}
              </option>
            ))}
          </select>

          {/* Badge del profesor seleccionado */}
          {selectedProfessor && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <ProfessorAvatar
                  name={selectedProfessor.name}
                  icon={selectedProfessor.icon}
                  color={selectedProfessor.color}
                  size="sm"
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {selectedProfessor.name}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {selectedProfessor.office || selectedProfessor.email || 'Docente titular'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setProfessorId('')}
                className="text-xs text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors cursor-pointer"
                title="Quitar docente"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Código / Sigla
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ej: INF-301, MAT-101"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 font-medium"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Créditos
          </label>
          <input
            type="number"
            min="0"
            max="30"
            value={credits ?? ''}
            onChange={(e) => setCredits(e.target.value ? Number(e.target.value) : undefined)}
            placeholder="Ej: 5"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 font-medium"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Aula habitual / Edificio o Modalidad
        </label>
        <input
          type="text"
          value={classroomDefault}
          onChange={(e) => setClassroomDefault(e.target.value)}
          placeholder="Ej: Aula 302, Edificio B o Virtual"
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 font-medium"
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-cove-blue to-cove-sky hover:from-cove-deep hover:to-cove-blue disabled:opacity-50 rounded-xl transition-all shadow-md shadow-cove-blue/20 cursor-pointer"
        >
          {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Materia' : 'Crear Materia'}
        </button>
      </div>
    </form>
  );
};
