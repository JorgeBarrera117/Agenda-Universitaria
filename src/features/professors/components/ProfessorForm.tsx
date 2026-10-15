import React, { useState } from 'react';
import { useSubjects } from '../../subjects/hooks/useSubjects';
import type { Professor, CreateProfessorDTO } from '../types';
import {
  ProfessorAvatar,
  PROFESSOR_ICONS,
  PROFESSOR_PRESET_COLORS,
} from './ProfessorAvatar';

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
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      {/* Selector de Avatar: Ícono y Fondo del Muñequito */}
      <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
        <div className="flex items-center gap-3.5">
          {/* Vista Previa en Vivo */}
          <ProfessorAvatar
            name={name || 'Docente'}
            icon={icon}
            color={color}
            size="xl"
            className="ring-2 ring-cove-sky/40"
          />

          <div className="min-w-0 flex-1">
            <span className="block text-xs font-black text-slate-800 uppercase tracking-wider mb-0.5">
              Avatar y Color del Docente
            </span>
            <p className="text-[11px] text-slate-500 leading-snug">
              Personaliza el muñequito y el fondo distintivo de este catedrático.
            </p>
          </div>
        </div>

        {/* 1. Selector de Ícono */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
            1. Elige un ícono o muñequito
          </label>
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {PROFESSOR_ICONS.map((opt) => {
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

        {/* 2. Selector de Color de Fondo */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
            2. Color de fondo del muñequito
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            {PROFESSOR_PRESET_COLORS.map((c) => (
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
              title="Elegir otro color"
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

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Nombre completo del docente *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Dra. María Fernández, Ing. Roberto Silva"
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Correo electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="profesor@universidad.edu"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Teléfono / WhatsApp
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+52 55 1234 5678"
            className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Cubículo / Oficina / Sala Virtual
        </label>
        <input
          type="text"
          value={office}
          onChange={(e) => setOffice(e.target.value)}
          placeholder="Ej: Edificio C, Cubículo 204 o Enlace de Zoom"
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Materias que imparte
        </label>
        {subjects.length === 0 ? (
          <p className="text-xs text-slate-500 italic">
            Primero crea materias en la sección de materias para asignarlas aquí.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 border border-slate-200 rounded-xl bg-slate-50">
            {subjects.map((sub) => {
              const isSelected = selectedSubjectIds.includes(sub.id);
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => toggleSubject(sub.id)}
                  className={`px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-cove-blue text-white border-cove-blue shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
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
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Horarios de Asesoría o Notas Adicionales
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: Asesorías los viernes a las 11:00 am previa cita."
          className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-cove-sky text-slate-900 text-sm resize-none"
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
          {isSubmitting ? 'Guardando...' : initialData ? 'Actualizar Profesor' : 'Registrar Profesor'}
        </button>
      </div>
    </form>
  );
};
