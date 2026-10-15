import React, { useState } from 'react';
import type { Subject, CreateSubjectDTO } from '../types';
import {
  SubjectIcon,
  SUBJECT_ICONS,
  SUBJECT_PRESET_COLORS,
} from './SubjectIcon';

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
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [color, setColor] = useState(initialData?.color || SUBJECT_PRESET_COLORS[0]);
  const [icon, setIcon] = useState(initialData?.icon || 'book');
  const [credits, setCredits] = useState<number | undefined>(initialData?.credits);
  const [classroomDefault, setClassroomDefault] = useState(initialData?.classroomDefault || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
            <p className="text-[11px] text-slate-500 truncate">
              {classroomDefault.trim() || 'Aula por asignar'}
            </p>
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
