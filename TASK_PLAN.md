# 📋 TASK_PLAN.md — Plan Maestro de Evolución: Agenda Universitaria PWA

> **Documento Puente de Colaboración Agéntica (Antigravity 🧠 ↔ Claude 🔨)**  
> **Versión Base:** `1.7.34` | **Rama activa:** `fix/backup-xss-electron-hardening` / `main`  
> **Propósito:** Este documento transfiere el contexto arquitectónico del Segundo Cerebro (Obsidian + Graphify) al entorno de implementación de Claude para ejecutar mejoras de rendimiento extremo, modernización visual (Bento UI) y ultra-personalización estudiantil.

---

## 🏛️ 1. Contexto Arquitectónico e Invariantes del Sistema (NO ROMPER)

Antes de modificar cualquier archivo, todo agente debe respetar las siguientes decisiones de arquitectura (ADRs) vigentes en el proyecto:

1. **Stack Tecnológico:** React 19 + TypeScript ~6.0 + Vite 8 + Tailwind CSS v4 + Dexie.js 4 (IndexedDB) + Capacitor 8 (Android) + Electron 45 (Windows).
2. **Offline-First Estricto (ADR-001):** Toda persistencia pasa por `src/shared/db/AppDatabase.ts` y los repositorios de cada feature (`src/features/*/repositories/`). Cero dependencias de servidores externos para funcionar.
3. **Seguridad Anti-XSS y CSP (ADR-004 & Commit `cd94970`):**
   - Mantener intacta la sanitización con `DOMPurify` (`src/shared/utils/sanitizeHtml.ts`) y la validación estricta de backups en `src/shared/utils/backup.ts`.
   - No usar estilos ni scripts inline que violen la política CSP de producción en `vite.config.ts` ni el filtro IPC de `electron/main.cjs`.
4. **Pila LIFO de Retroceso Físico (ADR-003):** Todo modal, editor o subvista nueva debe registrarse con `useBackButton` (`src/shared/hooks/useBackButton.ts`) respetando las prioridades `BACK_PRIORITY` para que el botón físico "Atrás" de Android nunca cierre la app accidentalmente.
5. **Sincronización Nativa (ADR-002):** No romper los contratos de `WidgetSyncService` (widget nativo de Android en pantalla de inicio) ni `NotificationService` (alarmas locales de clases).
6. **Sistema de Tokens Dinámicos (ADR-005):** Nunca usar colores hardcodeados de Tailwind (`bg-blue-500`, `text-gray-800`) en contenedores estructurales; usar siempre las variables semánticas CSS (`bg-[var(--color-md-surface)]`, `text-[var(--color-md-on-surface)]`, `border-[var(--color-md-outline-variant)]`, etc.) definidas en `src/shared/utils/theme.ts`.

---

## 🚀 2. Hoja de Ruta por Fases (Roadmap de Implementación)

Trabajaremos de manera incremental fase por fase. Cada fase debe compilar limpiamente con `npm run build` (`tsc -b && vite build`).

---

### ⚡ FASE 1: Optimización de Rendimiento y Carga Diferida (Performance & Bundle Splitting)
**Estado:** `COMPLETADA (Commit e935427)`

#### Problema Detectado
1. **Re-renderizado Global en `src/App.tsx`:** Actualmente `App.tsx` invoca `useSubjects()`, `useSchedule()`, `useProfessors()`, `useNotes()` y `useSubjectDocuments()` en el componente raíz solo para pasar `subjects.length`, `notes.length`, etc. a los badges de `Navbar` y `BottomNav`, y para alimentar los `useEffect` de sincronización. Cualquier edición en una nota o documento descarga arrays completos en memoria y fuerza el re-render de toda la aplicación.
2. **Carga Estática Pesada (Eager Loading):** `SettingsView` (82 KB), `NotesView` (54 KB + editor TipTap/ProseMirror), `DocumentsView` y `ProfessorsView` se importan estáticamente en `App.tsx`, penalizando el tiempo de arranque inicial cuando el estudiante solo abre la app para consultar su horario.

#### Tareas de Implementación (Fase 1)
- [x] **1.1. Crear `src/shared/hooks/useTabCounts.ts`:**
  - Implementar un hook ligero con `useLiveQuery` de `dexie-react-hooks` que consulte únicamente conteos a nivel de motor IndexedDB (`db.subjects.count()`, `db.professors.count()`, `db.notes.count()`, `db.subjectDocuments.count()`), retornando `{ subjectCount, professorsCount, notesCount, documentsCount }` sin hidratar objetos ni blobs en memoria.
- [x] **1.2. Aislar efectos de sincronización en Segundo Plano (`src/shared/components/BackgroundSyncManager.tsx`):**
  - Mover los `useEffect` de `NotificationService.syncScheduleNotifications` y `WidgetSyncService.syncWidgetData` fuera del cuerpo principal de `App.tsx` hacia un componente sin UI (`return null`) montado independientemente. Así, cuando cambien los datos en Dexie, solo se ejecutará la sincronización en background sin re-renderizar el layout ni las pestañas activas.
- [x] **1.3. Code-Splitting con `React.lazy` y `Suspense` en `src/App.tsx`:**
  - Mantener `ScheduleView` estático (es la vista inicial crítica).
  - Convertir `SubjectsView`, `ProfessorsView`, `NotesView`, `DocumentsView` y `SettingsView` a importaciones dinámicas con `React.lazy()`.
  - Añadir un esqueleto de transición limpio y sin parpadeos (*skeleton fallback*) acorde a los tokens `--color-md-*`.
  - Precarga de vistas secundarias mediante `requestIdleCallback` (`preloadSecondaryViewsWhenIdle`).

---

### 🎯 FASE 2: Descongestión Visual, Jerarquía de Controles y Ergonomía M3
**Estado:** `COMPLETADA`

#### Objetivo
Limpiar la saturación visual en tarjetas de horarios, materias, profesores y apuntes para que la interfaz respire como una app moderna de primer nivel (*Linear / Craft / Notion Calendar*).

#### Tareas de Implementación (Fase 2)
- [x] **2.1. Regla de "1 Acción Primaria + Kebab Menu":**
  - Auditar `SubjectsView.tsx`, `ProfessorsView.tsx` y `ScheduleView.tsx` para asegurar que ninguna tarjeta muestre múltiples botones de acción (Editar, Borrar, Reasignar) amontonados.
  - Consolidar acciones secundarias y destructivas en `M3KebabMenu` (`src/shared/components/M3KebabMenu.tsx`).
- [x] **2.2. Micro-interacciones y Densidad Adaptativa:**
  - Mejorar el feedback visual de botones y tarjetas (`active:scale-[0.98]`, transiciones suaves de 150ms `ease-out`, bordes sutiles de 1px con `outline-variant`).
  - Adaptación 100% fiel a los tokens CSS semánticos `--color-md-*`.

---

### 🧩 FASE 3: "Campus Pulse" — Bento Grid Header en el Horario
**Estado:** `COMPLETADA`

#### Objetivo
Transformar el encabezado de `ScheduleView` en un centro de mando inteligente y juvenil que responda en tiempo real al contexto del estudiante.

#### Tareas de Implementación (Fase 3)
- [x] **3.1. Crear hook `src/features/schedule/hooks/useCampusPulse.ts`:**
  - Calcular en tiempo real (actualizándose cada minuto):
    - **Clase en curso:** Materia actual, aula/modalidad, profesor, porcentaje de tiempo transcurrido (`0%` a `100%`) y minutos restantes.
    - **Próxima clase:** Si está en hora libre, cuánto falta para la siguiente cátedra del día o de mañana.
    - **Resumen de jornada:** Total de clases de hoy vs. completadas.
- [x] **3.2. Componente `CampusPulseBento.tsx`:**
  - Diseñar un bloque Bento compacto y colapsable en la parte superior de `ScheduleView` con:
    - Tarjeta principal dinámica (*En Curso Ahora* con barra de progreso viva o *Próxima Cátedra*) y botón directo `"Tomar Apunte"` / `"Ver Archivos"`.
    - Píldora de estado del día (ej. *"3 clases hoy • 1 virtual"*).

---

### 🎨 FASE 4: Motor de Ultra-Personalización ("Cada Agenda es Única")
**Estado:** `COMPLETADA`

#### Objetivo
Darle al estudiante libertad creativa para que su agenda refleje su personalidad, combinando estética juvenil, legibilidad profesional y temas de vanguardia.

#### Tareas de Implementación (Fase 4)
- [x] **4.1. Nuevas Paletas Estéticas en `src/shared/utils/theme.ts` y `src/features/settings/types.ts`:**
  - Añadir presets de tendencia manteniendo contraste WCAG AA/AAA:
    1. **`oled` (Cyberpunk OLED):** Fondo negro puro `#000000` (ahorro de batería en pantallas AMOLED) con contenedores `#0D0F14` y acentos neón cian/violeta.
    2. **`matcha` (Matcha & Cream Lofi):** Tonos papel cálido `#FAF7F2` en modo claro y bosque profundo en modo oscuro, con acentos verde matcha orgánico.
    3. **`sunset` (Sunset Horizon):** Tonos terracota, coral y ámbar cálido inspirados en atardeceres.
    4. **`slate` (Minimalist Mono):** Estética monocromática de ultra-alto contraste estilo *Linear / Vercel*.
- [x] **4.2. Personalización de Estilo de Superficie (Card & Glass Style):**
  - Permitir al usuario elegir en Ajustes el acabado de las tarjetas:
    - `solid`: Superficie sólida limpia (actual).
    - `glass`: Efecto *Glassmorphism* translúcido (`backdrop-blur-md`) que deja entrever sutilmente el `AppWallpaper` personalizado.
    - `bordered`: Estilo plano con bordes marcados de alto contraste.
- [x] **4.3. Perfil / Credencial Digital del Estudiante:**
  - Permitir personalizar en el encabezado o ajustes el nombre del estudiante, carrera/facultad y meta del semestre junto al `semesterName`.

---

### 📝 FASE 5: Rediseño Ergonómico y Unificación de Formularios de Creación (UX Sheet M3)
**Estado:** `COMPLETADA`

#### Objetivo
Erradicar la fragmentación visual ("Card Soup"), las scrollbars toscas y las etiquetas en mayúsculas en los formularios de creación/edición, transformándolos en hojas continuas elegantes (*M3 Modal Sheet / Canvas*) con identidad visual integrada, tokens semánticos `--color-md-*` y ergonomía táctil óptima.

#### Invariantes UX para Formularios (Reglas de Oro)
1. **Superficie Única Continua:** Prohibido anidar tarjetas dentro de tarjetas flotando sobre el wallpaper. El formulario es una sola superficie cohesionada (`bg-[var(--md-card-surface)]` o `bg-[var(--color-md-surface-container)]`) con divisores sutiles (`border-[var(--color-md-outline-variant)]`).
2. **Top App Bar Canónica M3:**
   - Izquierda: Botón circular de retorno `ArrowLeft` (`w-9 h-9 rounded-full bg-[var(--color-md-surface-container-high)] active:scale-95`).
   - Centro: Título H2 conciso (`text-base font-black`) + subtítulo contextual de una línea.
   - Derecha: **Únicamente el botón primario de acción** (`Guardar` o `Actualizar` con `active:scale-95` y disabled mientras guarda). Prohibido duplicar botón "Cancelar" si ya existe `ArrowLeft`.
3. **Erradicación de ALL CAPS:** Todas las etiquetas de campos deben usar *Sentence Case* limpio (`Nombre de la asignatura *`, `Código o sigla curricular`).
4. **Hero de Identidad Visual Unificada:** Color + Ícono + Vista Previa interactiva en un solo bloque armónico superior, sin scrollbars horizontales rígidas.
5. **Tokens Semánticos 100%:** Prohibido usar colores fijos (`#00639B`, `#FDFBFF`, etc.). Todo debe emplear `--color-md-*` y respetar los modos `oled`, `matcha`, `sunset`, `slate` y acabados de superficie (`glass`, `solid`, `bordered`).

#### Tareas de Implementación (Fase 5)
- [x] **5.1. `SubjectForm.tsx` (Materias / Asignaturas):**
  - Unificar en una superficie continua con Top App Bar canónica M3.
  - Hero integrado: Avatar de la materia grande con color e ícono en vivo; paleta de colores táctiles (32-36px con selector custom integrado) y cuadrícula compacta de íconos temáticos sin scrollbar.
  - Campos en 2 columnas para Código y Créditos.
  - Sección de Docente Titular con `M3Select` y botón sutil `+ Nuevo`.
- [x] **5.2. `ScheduleSlotForm.tsx` (Horarios / Clases):**
  - Top App Bar canónica M3.
  - Selector de materia mediante `M3Select` con badge cromático.
  - Selector de día en barra segmentada táctil o píldoras M3.
  - Horario (Inicio y Fin) en 2 columnas con píldora de duración calculada en vivo (*ej. "2 h de clase"*).
  - Segmented Button M3 para *Modalidad* (`Presencial` vs `Virtual`), con alternancia limpia de campos (Aula/Edificio vs Plataforma/Enlace).
- [x] **5.3. `ProfessorForm.tsx` (Profesores / Catedráticos):**
  - Top App Bar canónica M3.
  - Hero de Identidad con Avatar grande de profesor, paleta cromática e íconos temáticos.
  - Bloques semánticos: *Datos Personales y Grado*, *Canales de Contacto* (Email, Teléfono, Oficina) y *Cátedras Asignadas* (multiselect de chips con color de materia).
- [x] **5.4. `DocumentLinkForm.tsx` (Documentos / Archivos):**
  - Selector segmentado M3 (*Archivo Local* vs *Enlace Web*).
  - Dropzone moderno con drag & drop, indicador de tamaño y formato visual.
  - Selección de Asignatura mediante `M3Select`.

---

### 📖 FASE 6: Rediseño Editorial y Fluidez del Lector y Editor de Apuntes (UI/UX Pro Max)
**Estado:** `EN EJECUCIÓN (LISTA PARA IMPLEMENTAR)`

#### Objetivo
Transformar el Lector de Apuntes (`NotesView.tsx` modo `reader`) y el Editor TipTap (`NoteEditor.tsx` y `RichTextEditor.tsx`) en una experiencia de redacción y lectura de clase mundial (*Notion / Apple Notes / Craft*), aplicando inteligencia de diseño `ui-ux-pro-max`: ergonomía táctil en barra de herramientas (touch targets de 40px y espaciado mínimo de 8px), folio editorial con acabado de superficie continuo, eliminación del menú flotante artesanal en favor de `M3KebabMenu`, y recolocación canónica del botón Guardar a la derecha.

#### Tareas de Implementación (Fase 6)
- [ ] **6.1. Rediseño del Lector de Notas (`NotesView.tsx` - Modo Reader):**
  - **Top App Bar canónica:** Botón atrás `ArrowLeft` táctil a la izquierda, título y asignatura con badge cromático en el centro, y menú contextual a la derecha migrado a `M3KebabMenu` (desacoplado con React Portal y `BACK_PRIORITY.MODAL + 5`).
  - **Folio Editorial M3:** Contenedor unificado `.md-card` que respeta el acabado de superficie (`solid`, `glass` con `backdrop-blur-md`, `bordered`).
  - **Jerarquía Tipográfica:** Asignatura en chip sutil + fecha legible en lenguaje natural + título H1 prominente + tags en píldoras tonales.
  - **Galería de Fotos del Pizarrón descongestionada:** Eliminar la caja vacía punteada redundante cuando no hay fotos adjuntas; renderizar una cuadrícula limpia de miniaturas con zoom interactivo (`ImageZoomModal`) solo cuando existan fotos, y botones de acción rápida (*Cámara* y *Galería*) discretos.
  - **Tokens M3 al 100%:** Reemplazar todos los `slate-900`, `bg-[#00639B]/15`, etc. por `--color-md-*`.
- [ ] **6.2. Rediseño del Editor de Notas (`NoteEditor.tsx`):**
  - **Corrección de Ergonomía en Cabecera:** Mover el botón primario `Guardar` al extremo derecho (con icono `Check` y feedback `active:scale-95`). El extremo izquierdo queda exclusivamente para `ArrowLeft` (botón de volver).
  - **Metadatos Inline (Eliminar Modal Incómodo):** Eliminar el modal secundario "Opciones del Apunte". Integrar la selección de materia (chip interactivo `M3Select`) y las etiquetas (#tags) directamente en el encabezado del lienzo de escritura.
  - **Contador de Palabras y Caracteres:** Métrica sutil y discreta en la barra inferior o pie del documento sin interrumpir la escritura.
- [ ] **6.3. Rediseño de la Barra de Herramientas de Formato (`RichTextEditor.tsx`):**
  - **Ergonomía Táctil Móvil:** Botones de formato con target táctil adecuado (mínimo 36-40px, espaciado `gap-1.5`), esquinas `rounded-xl` y feedback táctil suave.
  - **Agrupación Visual de Herramientas:** Estilos de texto (Negrita, Cursiva, Subrayado, Tachado), Encabezados (H1, H2), Listas (Viñetas, Numeradas) e Inserción multimedia (Cámara, Galería, Divisor).
  - **Tokens Semánticos:** Estado activo con `bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]`.

---

## 🤝 3. Flujo de Trabajo para Claude

1. **Lectura:** Lee este archivo `TASK_PLAN.md` al inicio de cada tarea.
2. **Ejecución Incremental:** Ejecuta **únicamente la Fase que el usuario te indique** (empezando por la **Fase 1**).
3. **Verificación:** Al terminar los cambios de código de la fase, ejecuta `npm run build` y `npm run lint` para garantizar cero errores de TypeScript (`tsc -b`) y cero warnings de `oxlint`.
4. **Reporte:** Informa los archivos modificados para que Antigravity realice la auditoría arquitectónica y actualice la documentación en Obsidian.
