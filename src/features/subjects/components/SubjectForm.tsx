import React, { useState } from 'react';
import type { Subject, CreateSubjectDTO } from '../types';

interface SubjectFormProps {
  initialData?: Subject;
  onSubmit: (data: CreateSubjectDTO) => Promise<void>;
  onCancel: () => void;
}

const PRESET_COLORS = [
  '#006BBB', // Cove blue
  '#30A0E0', // Cove sky
  '#FFC872', // Cove gold
  '#004d88', // Cove deep
  '#10b981', // emerald
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#64748b', // slate
];

export const SubjectForm: React.FC<SubjectFormProps> = ({
  initialData,
  onSubmit,
  onCancel,
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [code, setCode] = useState(initialData?.code || '');
  const [color, setColor] = useState(initialData?.color || PRESET_COLORS[0]);
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
        credits: credits ? Number(credits) : undefined,
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nombre de la Materia *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Cálculo Integral, Arquitectura de Software"
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
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
            placeholder="Ej: INF-301"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
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
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Aula habitual / Edificio
        </label>
        <input
          type="text"
          value={classroomDefault}
          onChange={(e) => setClassroomDefault(e.target.value)}
          placeholder="Ej: Aula 302, Edificio B"
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Color distintivo
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-transform cursor-pointer ${
                color === c ? 'scale-115 border-slate-900 ring-2 ring-cove-sky' : 'border-white hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
              aria-label={`Color ${c}`}
            />
          ))}
        </div>
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
