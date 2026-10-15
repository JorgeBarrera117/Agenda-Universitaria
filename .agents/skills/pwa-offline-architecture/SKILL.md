---
name: pwa-offline-architecture
description: Directrices, mejores prácticas y patrones para diseñar e implementar Progressive Web Apps (PWA) Offline-First con IndexedDB (Dexie.js), Service Workers (Vite PWA / Workbox) y arquitectura desacoplada.
---

# PWA Offline-First Architecture & Engineering

## 1. Principios Fundamentales

1. **Offline-First por Diseño (Local-First):**
   - La base de datos local (IndexedDB) es la **fuente de la verdad inmediata** de la aplicación.
   - La interfaz de usuario nunca debe bloquearse esperando la red para lecturas o escrituras locales.
   - Cualquier mutación (crear, editar, borrar materia/horario/apunte) se persiste sincrónica o asincrónicamente en la base de datos local del cliente antes de cualquier sincronización remota opcional.

2. **Almacenamiento Local Robusto:**
   - Usar **IndexedDB** a través de una abstracción tipada como **Dexie.js**.
   - Evitar `localStorage` para datos relacionales o de tamaño no trivial (como apuntes con texto largo o imágenes), debido a su límite de ~5MB y su naturaleza bloqueante síncrona en el hilo principal.
   - Modelar esquemas relacionales o documentos indexados por claves primarias y secundarias (ej: `materiaId`, `diaSemana`, `horaInicio`).

3. **Ciclo de Vida de PWA & Service Worker:**
   - Configuración con `vite-plugin-pwa` utilizando Workbox.
   - Estrategia de caching para assets estáticos: `Precache` de bundles JS, CSS, fuentes e íconos.
   - Estrategia de runtime caching: `StaleWhileRevalidate` o `CacheFirst` para recursos estáticos y fuentes web.
   - Notificación de actualización no intrusiva al usuario cuando hay una nueva versión del Service Worker disponible (`registerSW` / prompt de actualización).

## 2. Patrones de Diseño Recomendados

### A. Repository Pattern (Patrón Repositorio)
Desacoplar la capa de persistencia (IndexedDB / Dexie) de los componentes de React o lógica de presentación.
- `ScheduleRepository`: Métodos `getByDay(day)`, `create(slot)`, `update(id, slot)`, `delete(id)`.
- `SubjectRepository`: Métodos `getAll()`, `getById(id)`, `create(subject)`, `delete(id)`.
- `NoteRepository`: Métodos `getBySubject(subjectId)`, `search(query)`, `create(note)`, `update(id, note)`, `delete(id)`.

### B. Custom Hooks con Consultas Reactivas (`useLiveQuery`)
Exponer el estado de la base de datos local hacia los componentes React mediante Custom Hooks que encapsulen las suscripciones a Dexie:
- `useSchedule()`
- `useSubjects()`
- `useNotes(subjectId)`

### C. Clean Feature-First Directory Structure
```
src/
├── app/                  # Providers, Router, Configuración PWA / Service Worker
├── shared/               # Componentes atómicos (UI), utilitarios, tipos comunes
│   ├── components/       # Button, Modal, Input, Card, Header, Layout
│   ├── db/               # Instancia central de Dexie (`AppDatabase.ts`)
│   └── types/            # Tipos de dominio compartidos
└── features/             # Módulos por capacidad de negocio
    ├── schedule/         # Horario y bloques de clase
    │   ├── components/   # ScheduleGrid, ScheduleSlotForm, ScheduleCard
    │   ├── hooks/        # useSchedule
    │   ├── repositories/ # scheduleRepository.ts
    │   └── types/        # ScheduleSlot.ts
    ├── professors/       # Directorio de docentes y contacto
    │   ├── components/   # ProfessorList, ProfessorForm, ProfessorCard
    │   ├── hooks/        # useProfessors
    │   ├── repositories/ # professorRepository.ts
    │   └── types/        # Professor.ts
    ├── subjects/         # Materias universitarias
    │   ├── components/   # SubjectBadge, SubjectSelector
    │   ├── hooks/        # useSubjects
    │   ├── repositories/ # subjectRepository.ts
    │   └── types/        # Subject.ts
    └── notes/            # Apuntes categorizados por materia
        ├── components/   # NoteEditor, NoteList, NoteCard, MarkdownViewer
        ├── hooks/        # useNotes
        ├── repositories/ # noteRepository.ts
        └── types/        # Note.ts
```

## 3. Checklist de Calidad PWA
- [ ] `manifest.webmanifest` con `name`, `short_name`, `theme_color`, `background_color`, `display: standalone`, `icons` (192x192, 512x512 y maskable).
- [ ] Service worker registrado y cacheando los bundles de la app para funcionamiento 100% offline.
- [ ] UI adaptativa para mobile (Bottom Navigation bar o Drawer, touch targets >= 48px) y desktop (Sidebar / Grid semanal completo).
- [ ] Integridad referencial en borrado: si se borra una materia, advertir o manejar apuntes y horarios vinculados.
