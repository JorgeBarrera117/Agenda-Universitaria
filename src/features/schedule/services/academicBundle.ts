import { db } from '../../../shared/db/AppDatabase';
import { comparableName } from '../../../shared/utils/comparableName';
import {
  cleanHexColor,
  cleanInteger,
  cleanLine,
  cleanWebUrl,
  isRecord,
  type UnknownRecord,
} from '../../../shared/utils/sharePackage';
import { cleanProfessorShareData, toProfessorShareData, type ProfessorShareData } from '../../professors/services/professorShareService';
import { professorRepository } from '../../professors/repositories/professorRepository';
import type { Professor } from '../../professors/types';
import { SUBJECT_ICONS, SUBJECT_PRESET_COLORS } from '../../subjects/components/SubjectIcon';
import { subjectRepository } from '../../subjects/repositories/subjectRepository';
import type { Subject, UpdateSubjectDTO } from '../../subjects/types';
import { scheduleRepository } from '../repositories/scheduleRepository';
import { SHORT_DAY_NAMES, type ClassModality, type DayOfWeek, type ScheduleSlot } from '../types';

/**
 * Paquete académico: materias, docentes y bloques de clase sin ids de la base local. Las
 * relaciones viajan como índices dentro del propio paquete (slot.subjectIndex → subjects[i]).
 * Lo usan .agclass (una materia) y .agschedule (el horario completo).
 */
export interface SharedSubjectData {
  name: string;
  code?: string;
  color: string;
  icon?: string;
  credits?: number;
  classroomDefault?: string;
  /** Índice en professors. */
  professorIndex?: number;
}

export interface SharedSlotData {
  /** Índice en subjects. */
  subjectIndex: number;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  modality?: ClassModality;
  classroom?: string;
  building?: string;
  virtualLink?: string;
  /** Índice en professors (solo si la clase la da otro docente). */
  professorIndex?: number;
}

export interface AcademicBundle {
  subjects: SharedSubjectData[];
  professors: ProfessorShareData[];
  slots: SharedSlotData[];
}

/* ------------------------------------------------------------------------------------------ */
/* Exportar                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/**
 * Arma el paquete con las materias dadas y sus clases. Incluye los docentes que estas usan, o
 * todos los de la lista si includeAllProfessors (horario completo: también los contactos sueltos).
 */
export function buildAcademicBundle(
  subjects: readonly Subject[],
  slots: readonly ScheduleSlot[],
  professors: readonly Professor[],
  options: { includeAllProfessors?: boolean } = {}
): AcademicBundle {
  const subjectIndex = new Map(subjects.map((s, i) => [s.id, i]));
  const ownSlots = slots
    .filter((slot) => subjectIndex.has(slot.subjectId))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime));

  const usedProfessorIds = new Set<string>();
  for (const s of subjects) if (s.professorId) usedProfessorIds.add(s.professorId);
  for (const slot of ownSlots) if (slot.professorId) usedProfessorIds.add(slot.professorId);
  const sharedProfessors = professors.filter((p) => options.includeAllProfessors || usedProfessorIds.has(p.id));
  const professorIndex = new Map(sharedProfessors.map((p, i) => [p.id, i]));

  const optional = (value?: string) => (value?.trim() ? value.trim() : undefined);
  return {
    professors: sharedProfessors.map(toProfessorShareData),
    subjects: subjects.map((s) => ({
      name: s.name.trim(),
      code: optional(s.code),
      color: s.color,
      icon: s.icon,
      credits: s.credits,
      classroomDefault: optional(s.classroomDefault),
      professorIndex: s.professorId ? professorIndex.get(s.professorId) : undefined,
    })),
    slots: ownSlots.map((slot) => ({
      subjectIndex: subjectIndex.get(slot.subjectId) ?? 0,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      modality: slot.modality,
      classroom: optional(slot.classroom),
      building: optional(slot.building),
      virtualLink: optional(slot.virtualLink),
      professorIndex: slot.professorId ? professorIndex.get(slot.professorId) : undefined,
    })),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Validar lo recibido                                                                        */
/* ------------------------------------------------------------------------------------------ */

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface BundleLimits {
  maxSubjects: number;
  maxProfessors: number;
  maxSlots: number;
}

function cleanSubject(
  raw: unknown,
  fallbackColor: string
): (Omit<SharedSubjectData, 'professorIndex'> & { rawProfessorIndex?: number }) | undefined {
  if (!isRecord(raw)) return undefined;
  const name = cleanLine(raw.name, 100);
  if (!name) return undefined;
  const icon = typeof raw.icon === 'string' && SUBJECT_ICONS.some((option) => option.id === raw.icon) ? raw.icon : undefined;
  return {
    name,
    code: cleanLine(raw.code, 20),
    color: cleanHexColor(raw.color) ?? fallbackColor,
    icon,
    credits: cleanInteger(raw.credits, 0, 60),
    classroomDefault: cleanLine(raw.classroomDefault, 120),
    rawProfessorIndex: cleanInteger(raw.professorIndex, 0, 10_000),
  };
}

function cleanSlot(raw: unknown): (Omit<SharedSlotData, 'subjectIndex' | 'professorIndex'> & { rawSubjectIndex: number; rawProfessorIndex?: number }) | undefined {
  if (!isRecord(raw)) return undefined;
  const rawSubjectIndex = cleanInteger(raw.subjectIndex, 0, 10_000);
  const dayOfWeek = cleanInteger(raw.dayOfWeek, 1, 7) as DayOfWeek | undefined;
  const startTime = typeof raw.startTime === 'string' && TIME_PATTERN.test(raw.startTime) ? raw.startTime : undefined;
  const endTime = typeof raw.endTime === 'string' && TIME_PATTERN.test(raw.endTime) ? raw.endTime : undefined;
  if (rawSubjectIndex === undefined || !dayOfWeek || !startTime || !endTime || startTime >= endTime) return undefined;
  const modality = raw.modality === 'presencial' || raw.modality === 'virtual' ? raw.modality : undefined;
  return {
    rawSubjectIndex,
    dayOfWeek,
    startTime,
    endTime,
    modality,
    classroom: cleanLine(raw.classroom, 80),
    building: cleanLine(raw.building, 200),
    virtualLink: cleanWebUrl(raw.virtualLink, 500),
    rawProfessorIndex: cleanInteger(raw.professorIndex, 0, 10_000),
  };
}

/**
 * Valida y limpia materias, docentes y clases de un paquete recibido. Descarta lo inválido y
 * rehace los índices para que sigan apuntando a lo que quedó; los docentes con el mismo nombre se
 * unen en uno. Las clases de una materia descartada se descartan también.
 */
export function parseAcademicBundle(body: UnknownRecord, limits: BundleLimits): AcademicBundle {
  // Docentes: índice original → índice limpio (los repetidos por nombre apuntan al primero)
  const professors: ProfessorShareData[] = [];
  const professorMap = new Map<number, number>();
  const professorByName = new Map<string, number>();
  if (Array.isArray(body.professors)) {
    body.professors.slice(0, limits.maxProfessors).forEach((raw, originalIndex) => {
      const professor = cleanProfessorShareData(raw);
      if (!professor) return;
      const key = comparableName(professor.name);
      const existing = professorByName.get(key);
      if (existing !== undefined) {
        professorMap.set(originalIndex, existing);
        return;
      }
      professorByName.set(key, professors.length);
      professorMap.set(originalIndex, professors.length);
      professors.push(professor);
    });
  }

  const subjects: SharedSubjectData[] = [];
  const subjectMap = new Map<number, number>();
  if (Array.isArray(body.subjects)) {
    body.subjects.slice(0, limits.maxSubjects).forEach((raw, originalIndex) => {
      const fallbackColor = SUBJECT_PRESET_COLORS[subjects.length % SUBJECT_PRESET_COLORS.length];
      const cleaned = cleanSubject(raw, fallbackColor);
      if (!cleaned) return;
      const { rawProfessorIndex, ...subject } = cleaned;
      subjectMap.set(originalIndex, subjects.length);
      subjects.push({
        ...subject,
        professorIndex: rawProfessorIndex === undefined ? undefined : professorMap.get(rawProfessorIndex),
      });
    });
  }

  const slots: SharedSlotData[] = [];
  if (Array.isArray(body.slots)) {
    for (const raw of body.slots.slice(0, limits.maxSlots)) {
      const cleaned = cleanSlot(raw);
      if (!cleaned) continue;
      const { rawSubjectIndex, rawProfessorIndex, ...slot } = cleaned;
      const subjectIndex = subjectMap.get(rawSubjectIndex);
      if (subjectIndex === undefined) continue;
      slots.push({
        ...slot,
        subjectIndex,
        professorIndex: rawProfessorIndex === undefined ? undefined : professorMap.get(rawProfessorIndex),
      });
    }
  }

  return { subjects, professors, slots };
}

/* ------------------------------------------------------------------------------------------ */
/* Planear la importación (sin escribir)                                                      */
/* ------------------------------------------------------------------------------------------ */

export interface LocalAcademicState {
  subjects: readonly Subject[];
  professors: readonly Professor[];
  slots: readonly ScheduleSlot[];
}

/** Destino de una materia recibida: emparejarla sola, crearla nueva o usar una local concreta. */
export type SubjectTarget = { kind: 'auto' } | { kind: 'create' } | { kind: 'existing'; subjectId: string };

export interface AcademicImportOptions {
  /**
   * merge: en las materias que ya existen solo se rellenan los datos vacíos.
   * replace: se reemplazan por los recibidos (el nombre local se conserva).
   */
  subjectMode: 'merge' | 'replace';
  /** Clases locales que se quitan antes de instalar las nuevas. */
  clearSlots: 'none' | 'target-subjects' | 'all';
  /** Destino por materia recibida (mismo orden que bundle.subjects); por defecto 'auto'. */
  subjectTargets?: readonly SubjectTarget[];
}

export type PlannedProfessor = { kind: 'existing'; professorId: string } | { kind: 'create'; data: ProfessorShareData };

export type PlannedSubject =
  | { kind: 'existing'; subjectId: string; localName: string; update: UpdateSubjectDTO; assignProfessor: boolean }
  | { kind: 'create'; data: SharedSubjectData };

export interface SkippedSlot {
  slot: SharedSlotData;
  subjectName: string;
  reason: 'duplicate' | 'conflict';
  /** Clase con la que choca, p. ej. "Cálculo · Lun 08:00–10:00". */
  conflictWith?: string;
}

export interface AcademicImportPlan {
  professors: PlannedProfessor[];
  subjects: PlannedSubject[];
  slotIdsToRemove: string[];
  slotsToAdd: SharedSlotData[];
  skipped: SkippedSlot[];
}

export interface AcademicImportSummary {
  createdSubjects: number;
  updatedSubjects: number;
  createdProfessors: number;
  addedSlots: number;
  removedSlots: number;
  duplicateSlots: number;
  conflictSlots: number;
}

/** Materia local equivalente: primero por código, después por nombre (sin tildes ni mayúsculas). */
export function findMatchingLocalSubject<T extends Pick<Subject, 'id' | 'name' | 'code'>>(
  subjects: readonly T[],
  shared: Pick<SharedSubjectData, 'name' | 'code'>,
  excludeIds: ReadonlySet<string> = new Set()
): T | undefined {
  const candidates = subjects.filter((s) => !excludeIds.has(s.id));
  if (shared.code) {
    const code = comparableName(shared.code);
    const byCode = candidates.find((s) => s.code && comparableName(s.code) === code);
    if (byCode) return byCode;
  }
  const name = comparableName(shared.name);
  return candidates.find((s) => comparableName(s.name) === name);
}

export function describeSlotTime(slot: Pick<SharedSlotData, 'dayOfWeek' | 'startTime' | 'endTime'>): string {
  return `${SHORT_DAY_NAMES[slot.dayOfWeek]} ${slot.startTime}–${slot.endTime}`;
}

/** Cambios para una materia que ya existe, según el modo. Solo incluye campos con valor. */
function subjectUpdate(local: Subject, shared: SharedSubjectData, mode: 'merge' | 'replace'): UpdateSubjectDTO {
  const update: UpdateSubjectDTO = {};
  const fields = ['code', 'icon', 'credits', 'classroomDefault'] as const;
  for (const field of fields) {
    const incoming = shared[field];
    if (incoming === undefined) continue;
    if (mode === 'replace' ? local[field] !== incoming : local[field] === undefined || local[field] === '') {
      Object.assign(update, { [field]: incoming });
    }
  }
  if (mode === 'replace' && local.color !== shared.color) update.color = shared.color;
  return update;
}

/**
 * Decide qué se crea, qué se actualiza y qué clases se agregan, sin escribir nada: los modales lo
 * usan para la vista previa y applyAcademicImport lo vuelve a calcular dentro de la transacción.
 * Una clase se omite si ya existe igual (misma materia, día y horas) o si choca con otra.
 */
export function planAcademicImport(
  bundle: AcademicBundle,
  local: LocalAcademicState,
  options: AcademicImportOptions
): AcademicImportPlan {
  const professors: PlannedProfessor[] = bundle.professors.map((shared) => {
    const name = comparableName(shared.name);
    const match = local.professors.find((p) => comparableName(p.name) === name);
    return match ? { kind: 'existing', professorId: match.id } : { kind: 'create', data: shared };
  });

  const usedSubjectIds = new Set<string>();
  const subjects: PlannedSubject[] = bundle.subjects.map((shared, index) => {
    const target = options.subjectTargets?.[index] ?? { kind: 'auto' };
    let localSubject: Subject | undefined;
    if (target.kind === 'existing') {
      localSubject = local.subjects.find((s) => s.id === target.subjectId);
      if (!localSubject) throw new Error('La materia elegida ya no existe.');
    } else if (target.kind === 'auto') {
      localSubject = findMatchingLocalSubject(local.subjects, shared, usedSubjectIds);
    }
    if (!localSubject) return { kind: 'create', data: shared };

    usedSubjectIds.add(localSubject.id);
    const hasIncomingProfessor = shared.professorIndex !== undefined;
    return {
      kind: 'existing',
      subjectId: localSubject.id,
      localName: localSubject.name,
      update: subjectUpdate(localSubject, shared, options.subjectMode),
      assignProfessor: hasIncomingProfessor && (options.subjectMode === 'replace' || !localSubject.professorId),
    };
  });

  const targetIds = new Set(subjects.flatMap((s) => (s.kind === 'existing' ? [s.subjectId] : [])));
  const slotIdsToRemove =
    options.clearSlots === 'all'
      ? local.slots.map((slot) => slot.id)
      : options.clearSlots === 'target-subjects'
        ? local.slots.filter((slot) => targetIds.has(slot.subjectId)).map((slot) => slot.id)
        : [];
  const removed = new Set(slotIdsToRemove);

  // Clave de materia: id local o "new:<índice>" para las que se crearán
  const subjectKey = (index: number) => {
    const planned = subjects[index];
    return planned.kind === 'existing' ? planned.subjectId : `new:${index}`;
  };
  const subjectNameOf = (index: number) => {
    const planned = subjects[index];
    return planned.kind === 'existing' ? planned.localName : planned.data.name;
  };
  const localNames = new Map(local.subjects.map((s) => [s.id, s.name]));

  const occupied: { key: string; dayOfWeek: DayOfWeek; startTime: string; endTime: string; label: string }[] = local.slots
    .filter((slot) => !removed.has(slot.id))
    .map((slot) => ({
      key: slot.subjectId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      label: `${localNames.get(slot.subjectId) ?? 'Otra materia'} · ${describeSlotTime(slot)}`,
    }));

  const slotsToAdd: SharedSlotData[] = [];
  const skipped: SkippedSlot[] = [];
  for (const slot of bundle.slots) {
    const key = subjectKey(slot.subjectIndex);
    const subjectName = subjectNameOf(slot.subjectIndex);
    const sameDay = occupied.filter((o) => o.dayOfWeek === slot.dayOfWeek);
    if (sameDay.some((o) => o.key === key && o.startTime === slot.startTime && o.endTime === slot.endTime)) {
      skipped.push({ slot, subjectName, reason: 'duplicate' });
      continue;
    }
    const conflict = sameDay.find((o) => slot.startTime < o.endTime && slot.endTime > o.startTime);
    if (conflict) {
      skipped.push({ slot, subjectName, reason: 'conflict', conflictWith: conflict.label });
      continue;
    }
    slotsToAdd.push(slot);
    occupied.push({ key, dayOfWeek: slot.dayOfWeek, startTime: slot.startTime, endTime: slot.endTime, label: `${subjectName} · ${describeSlotTime(slot)}` });
  }

  return { professors, subjects, slotIdsToRemove, slotsToAdd, skipped };
}

export function summarizeImportPlan(plan: AcademicImportPlan): AcademicImportSummary {
  return {
    createdSubjects: plan.subjects.filter((s) => s.kind === 'create').length,
    updatedSubjects: plan.subjects.filter((s) => s.kind === 'existing').length,
    createdProfessors: plan.professors.filter((p) => p.kind === 'create').length,
    addedSlots: plan.slotsToAdd.length,
    removedSlots: plan.slotIdsToRemove.length,
    duplicateSlots: plan.skipped.filter((s) => s.reason === 'duplicate').length,
    conflictSlots: plan.skipped.filter((s) => s.reason === 'conflict').length,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Aplicar                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * Importa el paquete en una sola transacción: lee el estado local, vuelve a planear (por si cambió
 * desde la vista previa) y aplica el plan con los repositorios. Si algo falla no queda nada a
 * medias. El paquete ya viene validado por parseAcademicBundle.
 */
export async function applyAcademicImport(
  bundle: AcademicBundle,
  options: AcademicImportOptions
): Promise<{ summary: AcademicImportSummary; subjectIds: string[] }> {
  // Las tres tablas: las transacciones anidadas de los repositorios usan subjects y professors
  return db.transaction('rw', [db.subjects, db.professors, db.scheduleSlots], async () => {
    const local: LocalAcademicState = {
      subjects: await db.subjects.toArray(),
      professors: await db.professors.toArray(),
      slots: await db.scheduleSlots.toArray(),
    };
    const plan = planAcademicImport(bundle, local, options);

    for (const id of plan.slotIdsToRemove) {
      await scheduleRepository.delete(id);
    }

    const professorIds: string[] = [];
    for (const planned of plan.professors) {
      professorIds.push(
        planned.kind === 'existing' ? planned.professorId : (await professorRepository.create({ ...planned.data, subjectIds: [] })).id
      );
    }
    const professorIdAt = (index?: number) => (index === undefined ? undefined : professorIds[index]);

    const subjectIds: string[] = [];
    for (const [index, planned] of plan.subjects.entries()) {
      const professorId = professorIdAt(bundle.subjects[index].professorIndex);
      if (planned.kind === 'create') {
        const { name, code, color, icon, credits, classroomDefault } = planned.data;
        subjectIds.push((await subjectRepository.create({ name, code, color, icon, credits, classroomDefault, professorId })).id);
      } else {
        const update: UpdateSubjectDTO = { ...planned.update, ...(planned.assignProfessor && professorId ? { professorId } : {}) };
        if (Object.keys(update).length > 0) await subjectRepository.update(planned.subjectId, update);
        subjectIds.push(planned.subjectId);
      }
    }

    for (const slot of plan.slotsToAdd) {
      await scheduleRepository.create({
        subjectId: subjectIds[slot.subjectIndex],
        professorId: professorIdAt(slot.professorIndex),
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        modality: slot.modality,
        classroom: slot.classroom,
        building: slot.building,
        virtualLink: slot.virtualLink,
      });
    }

    return { summary: summarizeImportPlan(plan), subjectIds };
  });
}
