import Dexie, { type Table } from 'dexie';
import type { Subject } from '../../features/subjects/types';
import type { Professor } from '../../features/professors/types';
import type { ScheduleSlot } from '../../features/schedule/types';
import type { Note, NoteImage } from '../../features/notes/types';

export class AppDatabase extends Dexie {
  subjects!: Table<Subject, string>;
  professors!: Table<Professor, string>;
  scheduleSlots!: Table<ScheduleSlot, string>;
  notes!: Table<Note, string>;
  noteImages!: Table<NoteImage, string>;

  constructor() {
    super('AgendaUniversitariaDB');
    this.version(1).stores({
      subjects: 'id, name, code',
      professors: 'id, name, *subjectIds',
      scheduleSlots: 'id, subjectId, professorId, dayOfWeek, startTime',
      notes: 'id, subjectId, title, updatedAt, *tags',
    });
    this.version(2).stores({
      noteImages: 'id, noteId, createdAt',
    });
  }
}

export const db = new AppDatabase();

// Función de inicialización con datos de muestra para el estudiante si está vacío
export async function seedInitialDataIfEmpty() {
  const subjectCount = await db.subjects.count();
  if (subjectCount > 0) return;

  const now = new Date().toISOString();

  // 1. Materias de muestra
  const mathSubject: Subject = {
    id: 'subj-math-1',
    name: 'Cálculo Diferencial',
    code: 'MAT-101',
    color: '#3b82f6', // blue
    credits: 5,
    classroomDefault: 'Aula 204, Edificio A',
    createdAt: now,
  };

  const csSubject: Subject = {
    id: 'subj-cs-2',
    name: 'Estructuras de Datos',
    code: 'INF-202',
    color: '#10b981', // emerald
    credits: 6,
    classroomDefault: 'Laboratorio de Cómputo 3',
    createdAt: now,
  };

  const physicsSubject: Subject = {
    id: 'subj-phys-3',
    name: 'Física Universitaria I',
    code: 'FIS-101',
    color: '#f59e0b', // amber
    credits: 4,
    classroomDefault: 'Aula Magna 102',
    createdAt: now,
  };

  await db.subjects.bulkAdd([mathSubject, csSubject, physicsSubject]);

  // 2. Profesores de muestra
  const prof1: Professor = {
    id: 'prof-garcia',
    name: 'Dra. Elena García',
    email: 'elena.garcia@universidad.edu',
    phone: '+52 55 1234 5678',
    office: 'Cubículo 312, Dpto. Matemáticas',
    notes: 'Horario de asesoría: Martes y Jueves de 14:00 a 16:00',
    subjectIds: [mathSubject.id],
    createdAt: now,
  };

  const prof2: Professor = {
    id: 'prof-torres',
    name: 'Ing. Carlos Torres',
    email: 'carlos.torres@universidad.edu',
    phone: '+52 55 8765 4321',
    office: 'Lab de Software Libre, 2do piso',
    notes: 'Acepta dudas por Teams / Discord estudiantil.',
    subjectIds: [csSubject.id],
    createdAt: now,
  };

  await db.professors.bulkAdd([prof1, prof2]);

  // 3. Horarios semanales
  const slots: ScheduleSlot[] = [
    {
      id: 'slot-1',
      subjectId: mathSubject.id,
      professorId: prof1.id,
      dayOfWeek: 1, // Lunes
      startTime: '08:00',
      endTime: '10:00',
      classroom: 'Aula 204',
      building: 'Edificio A',
      createdAt: now,
    },
    {
      id: 'slot-2',
      subjectId: csSubject.id,
      professorId: prof2.id,
      dayOfWeek: 1, // Lunes
      startTime: '10:30',
      endTime: '12:30',
      classroom: 'Lab 3',
      building: 'Edificio de Cómputo',
      createdAt: now,
    },
    {
      id: 'slot-3',
      subjectId: mathSubject.id,
      professorId: prof1.id,
      dayOfWeek: 3, // Miércoles
      startTime: '08:00',
      endTime: '10:00',
      classroom: 'Aula 204',
      building: 'Edificio A',
      createdAt: now,
    },
    {
      id: 'slot-4',
      subjectId: csSubject.id,
      professorId: prof2.id,
      dayOfWeek: 3, // Miércoles
      startTime: '10:30',
      endTime: '12:30',
      classroom: 'Lab 3',
      building: 'Edificio de Cómputo',
      createdAt: now,
    },
    {
      id: 'slot-5',
      subjectId: physicsSubject.id,
      dayOfWeek: 5, // Viernes
      startTime: '09:00',
      endTime: '11:00',
      classroom: 'Aula Magna 102',
      building: 'Edificio Central',
      createdAt: now,
    },
  ];

  await db.scheduleSlots.bulkAdd(slots);

  // 4. Apuntes iniciales en formato enriquecido (Word / WYSIWYG)
  const sampleNotes: Note[] = [
    {
      id: 'note-1',
      subjectId: csSubject.id,
      title: 'Árboles Binarios y Recorridos (In-order, Pre-order, Post-order)',
      content: `<h2>🌲 Definición de Árbol Binario</h2><p>Un árbol binario es una estructura de datos jerárquica en la que cada nodo tiene a lo sumo dos hijos (denominados hijo izquierdo e hijo derecho).</p><h3>Tipos de Recorridos en Profundidad (DFS):</h3><ul><li><strong>Pre-order:</strong> Raíz &rarr; Izquierda &rarr; Derecha</li><li><strong>In-order:</strong> Izquierda &rarr; Raíz &rarr; Derecha <em>(produce los elementos ordenados en un BST)</em></li><li><strong>Post-order:</strong> Izquierda &rarr; Derecha &rarr; Raíz</li></ul><blockquote>💡 <strong>Nota para examen:</strong> Recordar que la complejidad de búsqueda promedio es <u>O(log n)</u>, pero en el peor caso degenerado es O(n).</blockquote>`,
      tags: ['arboles', 'algoritmos', 'examen-parcial-1'],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'note-2',
      subjectId: mathSubject.id,
      title: 'Regla de la Cadena y Derivación Implícita',
      content: `<h2>📐 Teorema de la Regla de la Cadena</h2><p>Si <em>y = f(u)</em> es diferenciable en <em>u = g(x)</em> y <em>g</em> es diferenciable en <em>x</em>, la derivada de la función compuesta se calcula como:</p><p><strong>dy/dx = (dy/du) &middot; (du/dx)</strong></p><h3>Puntos Clave del Taller:</h3><ul><li><u>Ejercicio 14</u> resuelto paso a paso en el pizarrón.</li><li>Practicar derivación implícita con funciones trigonométricas antes del parcial.</li><li><strong>Fecha límite de entrega:</strong> Próximo miércoles a las 08:00 AM.</li></ul>`,
      tags: ['derivadas', 'calculo', 'taller'],
      createdAt: now,
      updatedAt: now,
    },
  ];

  await db.notes.bulkAdd(sampleNotes);
}
