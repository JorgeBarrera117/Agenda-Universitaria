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
**Estado:** `COMPLETADA (Commit 54ec2d7 & 7af0cc3)`

#### Objetivo
Transformar el Lector de Apuntes (`NotesView.tsx` modo `reader`) y el Editor TipTap (`NoteEditor.tsx` y `RichTextEditor.tsx`) en una experiencia de redacción y lectura de clase mundial (*Notion / Apple Notes / Craft*), aplicando inteligencia de diseño `ui-ux-pro-max`: ergonomía táctil en barra de herramientas (touch targets de 40px y espaciado mínimo de 8px), folio editorial con acabado de superficie continuo, eliminación del menú flotante artesanal en favor de `M3KebabMenu`, y recolocación canónica del botón Guardar a la derecha.

#### Tareas de Implementación (Fase 6)
- [x] **6.1. Rediseño del Lector de Notas (`NotesView.tsx` - Modo Reader):**
  - **Top App Bar canónica:** Botón atrás `ArrowLeft` táctil a la izquierda, título y asignatura con badge cromático en el centro, y menú contextual a la derecha migrado a `M3KebabMenu` (desacoplado con React Portal y `BACK_PRIORITY.MODAL + 5`).
  - **Folio Editorial M3:** Contenedor unificado `.md-card` que respeta el acabado de superficie (`solid`, `glass` con `backdrop-blur-md`, `bordered`).
  - **Jerarquía Tipográfica:** Asignatura en chip sutil + fecha legible en lenguaje natural + título H1 prominente + tags en píldoras tonales.
  - **Galería de Fotos del Pizarrón descongestionada:** Eliminar la caja vacía punteada redundante cuando no hay fotos adjuntas; renderizar una cuadrícula limpia de miniaturas con zoom interactivo (`ImageZoomModal`) solo cuando existan fotos, y botones de acción rápida (*Cámara* y *Galería*) discretos.
  - **Tokens M3 al 100%:** Reemplazar todos los `slate-900`, `bg-[#00639B]/15`, etc. por `--color-md-*`.
- [x] **6.2. Rediseño del Editor de Notas (`NoteEditor.tsx`):**
  - **Corrección de Ergonomía en Cabecera:** Mover el botón primario `Guardar` al extremo derecho (con icono `Check` y feedback `active:scale-95`). El extremo izquierdo queda exclusivamente para `ArrowLeft` (botón de volver).
  - **Metadatos Inline (Eliminar Modal Incómodo):** Eliminar el modal secundario "Opciones del Apunte". Integrar la selección de materia (chip interactivo `M3Select`) y las etiquetas (#tags) directamente en el encabezado del lienzo de escritura.
  - **Contador de Palabras y Caracteres:** Métrica sutil y discreta en la barra inferior o pie del documento sin interrumpir la escritura.
- [x] **6.3. Rediseño de la Barra de Herramientas de Formato (`RichTextEditor.tsx`):**
  - **Ergonomía Táctil Móvil:** Botones de formato con target táctil adecuado (mínimo 36-40px, espaciado `gap-1.5`), esquinas `rounded-xl` y feedback táctil suave.
  - **Agrupación Visual de Herramientas:** Estilos de texto (Negrita, Cursiva, Subrayado, Tachado), Encabezados (H1, H2), Listas (Viñetas, Numeradas) e Inserción multimedia (Cámara, Galería, Divisor).
  - **Tokens Semánticos:** Estado activo con `bg-[var(--color-md-primary-container)] text-[var(--color-md-on-primary-container)]`.

---

### 🌊 FASE 7: Sistema Global de Animaciones Fluidas y Continuidad Espacial M3 (Motion Engine)
**Estado:** `COMPLETADA (Commit 383a9f8)`

#### Objetivo
Dotar a toda la aplicación de fluidez visual nativa (60-120 FPS sin caídas de frames) en cada transición entre pestañas, apertura y cierre de formularios/hojas modales, menús desplegables y acciones de retorno, aplicando curvas de aceleración canónicas de Material Design 3 (`md.sys.motion`) y eliminando los cierres instantáneos a 0ms.

#### Principios de Movimiento M3 (Invariantes de Animación)
1. **Aceleración por GPU Estricta:** Las animaciones se ejecutan exclusivamente sobre `transform: translate3d / scale` y `opacity`. Prohibido animar `width`, `height`, `top`, `left` o `margin` (0 Reflows).
2. **Curvas Canónicas M3:**
   - Apertura / Entrada: `cubic-bezier(0.05, 0.7, 0.1, 1)` (Emphasized Decelerate) en 240-280ms.
   - Cierre / Salida: `cubic-bezier(0.3, 0, 0.8, 0.15)` (Emphasized Accelerate) en 160-200ms.
   - Micro-interacciones: `cubic-bezier(0.2, 0, 0, 1)` (Standard) en 120-150ms.
3. **Transición Bidireccional (Apertura y Cierre):** Los formularios (`FormSheet`), modales (`Modal`) y menús (`M3KebabMenu`, `M3Select`) no deben desaparecer bruscamente a 0ms al presionar Atrás/Cerrar; deben ejecutar una salida suave coordinada.
4. **Accesibilidad Obligatoria:** Respetar `@media (prefers-reduced-motion: reduce)` fijando duraciones a `1ms` sin animaciones espaciales.

#### Tareas de Implementación (Fase 7)
- [x] **7.1. Curvas de Movimiento y Clases Core en `src/index.css`:**
  - Añadir keyframes y utilidades M3: `m3-sheet-enter`, `m3-sheet-exit`, `m3-dialog-enter`, `m3-dialog-exit`, `m3-menu-enter`, `m3-menu-exit`.
  - Refinar la transición horizontal de pestañas (`m3-tab-enter-right` / `m3-tab-enter-left`) con sutil escala continua `scale(0.985) -> 1` para mayor fluidez.
- [x] **7.2. Cierre y Salida Fluida en `FormSheet.tsx` (Formularios y Editor):**
  - Implementar fase de salida (`isClosing`) de ~180ms al activar `onBack` (tecla Esc, botón Atrás de Android o botón flecha en pantalla), antes de desmontar el formulario.
- [x] **7.3. Transiciones en `NotesView.tsx` (Modo Reader y Editor):**
  - Suavizar la entrada y retorno del Lector de Notas con efecto Shared Axis y salida coordinada al volver al catálogo.
- [x] **7.4. Menús y Diálogos (`M3KebabMenu.tsx`, `M3Select.tsx`, `Modal.tsx`):**
  - Suavizar la apertura con escala desde el punto de origen (origin-top-right / origin-bottom-right) y salida suave.
  - `Modal.tsx` con entrada y salida animada de backdrop y contenedor.
- [x] **7.5. Fluidez en Barras de Navegación (`BottomNav.tsx` y `Navbar.tsx`):**
  - Transición fluida del indicador de píldora activa entre pestañas.

---

### 🎨 FASE 8: Rediseño Ergonómico Integral del Módulo de Ajustes (M3 Settings Studio)
**Estado:** `COMPLETADA (Commit 018afbe)`

#### Objetivo
Modernizar y descongestionar exhaustivamente la pantalla de **Ajustes** (`src/features/settings/components/SettingsView.tsx`) y **todas sus subvistas** (`appearance`, `profile`, `schedule`, `notifications`, `media`, `backup`, `about`), erradicando los 59 colores hardcodeados (`#00639B`, `#FDFBFF`, `#D0E4FF`), reduciendo el scroll bloat vertical a más de la mitad mediante controles canónicos de Material Design 3 (`SegmentedControl`), eliminando etiquetas en mayúsculas sostenidas y dotando a las subvistas de transiciones de salida fluidas (`useExitTransition`).

#### Problemas Detectados por Subvista
1. **`appearance` (Apariencia y Tema):**
   - 3 tarjetas gigantes de 85px para Luminosidad.
   - 12 tarjetas masivas de 85px con radio buttons y 4 barras cromáticas que generan más de 550px de scroll innecesario.
   - Selector de acabados con rayas diagonales toscas.
2. **`schedule` (Semestre y Horario):**
   - 100% de estilos con colores hexadecimales fijos (`#FDFBFF`, `#00639B`, `#D0E4FF`) rompiendo temas como OLED `#000000` y Matcha.
   - Botones artesanales para vista inicial (Semanal vs Día) y días visibles (Lun-Vie, Lun-Sáb, Toda la semana).
   - Etiquetas en ALL CAPS (`PERIOD LECTIVO`, `VISTA PREDETERMINADA`).
3. **`notifications` (Notificaciones y Avisos):**
   - Colores hexadecimales fijos violando ADR-005.
   - Botones toscos para momentos de aviso (15m antes, al iniciar, sonido).
4. **`media` (Fotografías y Pizarras):**
   - 2 tarjetas gigantes para 720p vs 1080p con colores hardcodeados.
5. **`backup` (Datos y Copias de Seguridad - `BackupSection.tsx`):**
   - Contenedores con `#FDFBFF` y `#1D2024` fijos. Falta jerarquía visual entre exportar e importar.
6. **`about` (Acerca de la Agenda):**
   - Colores fijos `#00639B`, `#D0E4FF` en badges y bordes.
7. **`root` (Menú Principal de Ajustes):**
   - Clases `text-slate-900`, `bg-slate-100`, etc. sin enlace semántico a `--color-md-*`.

#### Invariantes UX para la Fase 8
1. **Cero Colores Hardcodeados (ADR-005):** Prohibido el uso de `#00639B`, `#FDFBFF`, `#D0E4FF`, etc. Usar exclusivamente variables semánticas `--color-md-*`.
2. **Controles Canónicos M3:** Usar `SegmentedControl` en todas las opciones de selección mutuamente excluyentes (Luminosidad, Vista Horario, Días Visibles, Resolución Fotográfica, Acabado de Tarjetas).
3. **Ergonomía Táctil y Densidad:** Targets táctiles $\ge 40$px (WCAG 2.1 AA) sin abultamiento vertical innecesario.
4. **Fluidez de Transición:** Sincronizar retorno a la lista de ajustes con `useExitTransition` (salida coordinada sin saltos a 0ms).

#### Tareas de Implementación (Fase 8)
- [x] **8.1. Subvista de Apariencia y Tema (`appearance`):**
  - Modo de Luminosidad con `SegmentedControl` (Claro, Oscuro, Auto) de 42px de altura.
  - Rejilla ergonómica de 12 paletas Material You con fichas compactas de 44px de altura (`grid-cols-2 sm:grid-cols-3`): doble círculo cromático armonioso (aro exterior `primaryContainer` con núcleo central `primary`), nombre de la paleta en `text-xs font-bold truncate` y checkmark discreto al estar activa.
  - Píldora resumen en vivo en el encabezado: `[ ● {Nombre de la Paleta} · {Modo} ]`.
  - Acabado de tarjetas con `SegmentedControl` estilizado de 40px con iconos semánticos (`Layers`, `Sparkles`, `Frame`).
  - Wallpaper Studio compacto con miniaturas limpias de 36px.
- [x] **8.2. Subvista de Semestre y Horario (`schedule`):**
  - Erradicar todos los `#00639B`, `#FDFBFF`, `#D0E4FF`. Migrar al 100% a `--color-md-*`.
  - Reemplazar botones de "Vista Predeterminada" por `SegmentedControl` (`Semanal` con icono `Layers` vs `Por Día` con icono `Calendar`).
  - Reemplazar botones de "Días de Cursada" por `SegmentedControl` (`Lun - Vie`, `Lun - Sáb`, `Toda la semana`).
  - Input de Semestre con `formInputClass` y botón `Guardar` con token `--color-md-primary` y `active:scale-95`.
  - Cambiar etiquetas ALL CAPS a Sentence Case descansado (`Periodo lectivo actual`, `Vista predeterminada`).
- [x] **8.3. Subvista de Notificaciones y Avisos (`notifications`):**
  - Migrar al 100% a tokens semánticos `--color-md-*`.
  - Switch M3 canónico con colores reactivos al tema.
  - Banner de permisos y botón de test con estilo M3 elevado.
  - Píldoras de momentos de aviso (15m antes, al iniciar, sonido) como chips M3 compactos con checkmark integrado.
- [x] **8.4. Subvista de Fotografías y Pizarras (`media`):**
  - Migrar al 100% a tokens semánticos `--color-md-*`.
  - Selector de resolución (720p vs 1080p) mediante `SegmentedControl` ergonómico con texto explicativo secundario.
- [x] **8.5. Subvista de Datos y Copias de Seguridad (`backup` / `BackupSection.tsx`):**
  - Erradicar `#FDFBFF` y `#1D2024`. Usar `--color-md-card-bg`, `--color-md-outline-variant`, `--color-md-primary`.
  - Tarjetas de acciones limpias agrupadas (Exportar a Descargas, Compartir, Copiar JSON / Importar Archivo, Pegar JSON).
- [x] **8.6. Subvista de Acerca de la Agenda (`about`):**
  - Migrar al 100% a tokens semánticos `--color-md-*`.
  - Folio M3 con avatar de la app, versión dinámica, garantía offline-first y créditos del desarrollador.
- [x] **8.7. Limpieza en Menú Raíz y Transiciones de Subvistas:**
  - Reemplazar los colores hardcodeados de las tarjetas del menú raíz (`activeSubView === null`) por tokens `--color-md-*`.
  - Integrar `useExitTransition` al pulsar la flecha atrás de la subvista para que vuelva suavemente a la lista de ajustes.
- [x] **8.8. Verificación y Calidad:**
  - Ejecutar `npm run build` (`tsc -b && vite build`) y `npm run lint` (`oxlint`) garantizando cero errores.

---

### 🛡️ FASE 9: Selector de Color Canónico M3 y Sistema Global de Legibilidad de Fondos (Readability & Wallpaper Scrim)
**Estado:** `COMPLETADA (Commit c869538)`

#### Objetivo
1. **Eliminar el selector de color nativo arcaico de Android:** Reemplazar `<input type="color">` en `IdentityPicker.tsx` por un modal canónico de Material Design 3 (`M3ColorPickerModal.tsx`) con paleta de tonos armónicos, ajuste de matiz y entrada hexadecimal, eliminando el diálogo anticuado del sistema operativo.
2. **Garantizar 100% de legibilidad tipográfica sobre cualquier papel tapiz:** Resolver la pérdida de contraste en textos flotantes huérfanos (títulos de encabezado, subtítulos y etiquetas de sección) en **Horario**, **Materias**, **Profesores**, **Apuntes**, **Archivos** y **Ajustes**, mediante un velo de legibilidad adaptativo en `AppWallpaper.tsx` y cápsulas/chips tonales protectores con *backdrop-blur*.

#### Problemas Detectados (Evidencia en Capturas)
1. **Selector de Color Tocho (Imagen 1):** El botón `+` en la fila de colores invoca `<input type="color">`, lo que en Android WebView abre un cuadro de diálogo del sistema operativo ("Seleccionar color", 8 cajas neón, Cancelar/Establecer) totalmente desalineado del estilo de la app.
2. **Ilegibilidad en Encabezados y Subtítulos (Imágenes 2, 3, 4, 5):**
   - En *Profesores* (Img 2): "Contactos Docentes", subtítulo y "DIRECTORIO ALFABÉTICO (5 CATEDRÁTICOS)" flotan desnudos sobre el fondo ilustrado.
   - En *Horario* (Img 3): "Horario Académico", badge del semestre y subtítulo se funden con los colores vivos de la ilustración.
   - En *Archivos* (Img 4): "Archivos y Documentos", chips de tipos ("Tipo: Todos | PDFs...") y la tarjeta vacía con borde punteado (`bg-[#F1F4FA]/30`) son transparentes e ilegibles.
   - En *Ajustes* (Img 5): Encabezado "Ajustes" y los títulos de grupo ("Preferencias de estudio", "Notificaciones y medios", "Almacenamiento y sistema") se pierden por completo sobre el tapiz.

#### Tareas de Implementación (Fase 9)
- [x] **9.1. Componente Canónico `M3ColorPickerModal.tsx`:**
  - Crear `src/shared/components/form/M3ColorPickerModal.tsx` utilizando el `Modal` M3 existente.
  - Contenido:
    - Avatar/Vista previa grande con el color seleccionado y código HEX.
    - Cuadrícula de 24 tonos armónicos seleccionados (Material You hues: pasteles, vibrantes y profundos).
    - Slider continuo de matiz cromático (arcoíris) + input de texto hexadecimal con prefijo `#`.
    - Botones de acción: `Cancelar` y `Aplicar color`.
  - Integrar en `IdentityPicker.tsx` sustituyendo el `<input type="color">` por la apertura de este modal.
- [x] **9.2. Velo de Legibilidad Adaptativo en `AppWallpaper.tsx`:**
  - En `src/shared/components/AppWallpaper.tsx`, para `wallpaperStyle === 'custom'`, añadir una capa de contraste/atenuación sutil:
    - En modo oscuro: velo de superficie oscura `bg-black/40` o `bg-[var(--color-md-surface)]/50` para atenuar fondos brillantes y asegurar contraste $\ge 4.5:1$ (WCAG AA).
    - En modo claro: velo de superficie clara `bg-white/45` o `bg-[var(--color-md-surface)]/60`.
- [x] **9.3. Protección de Encabezados de Pantalla (Header Scrim Capsule):**
  - En los encabezados de `ScheduleView.tsx`, `SubjectsView.tsx`, `ProfessorsView.tsx`, `NotesView.tsx`, `DocumentsView.tsx` y `SettingsView.tsx`:
    - Añadir una clase de protección o contenedor con respaldo sutil: `bg-[var(--color-md-surface)]/65 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 border border-[var(--color-md-outline-variant)]/30 shadow-2xs` o una cápsula semitranslúcida que garantice legibilidad absoluta de los títulos H1/H2 y sus subtítulos (`HEADER_SCRIM_CLASS`).
- [x] **9.4. Cápsulas y Chips Tonales para Etiquetas de Sección:**
  - `ProfessorsView.tsx`: Envolver "Directorio Alfabético • X Catedráticos" en un chip tonal: `inline-flex px-3 py-1 rounded-full bg-[var(--color-md-surface-container)]/85 backdrop-blur-sm border border-[var(--color-md-outline-variant)]/50 text-[11px] font-bold text-[var(--color-md-on-surface-variant)] shadow-2xs` (`TONAL_CHIP_CLASS`).
  - `DocumentsView.tsx`: Envolver la barra de tipos ("Tipo: Todos | PDFs...") en un contenedor con `bg-[var(--color-md-surface-container)]/85 backdrop-blur-md rounded-xl p-1 border border-[var(--color-md-outline-variant)]/50`.
  - `DocumentsView.tsx`: Estado vacío ("Aún no has vinculado ningún documento...") con `bg-[var(--md-card-surface)]/90 backdrop-blur-md border border-[var(--color-md-outline-variant)]` para máxima nitidez.
  - `SettingsPrimitives.tsx` (`SettingsGroup`): Envolver los títulos de sección en un chip o cápsula tonal: `inline-flex px-2.5 py-0.5 rounded-md bg-[var(--color-md-surface-container-high)]/85 backdrop-blur-sm border border-[var(--color-md-outline-variant)]/40 text-xs font-bold text-[var(--color-md-on-surface-variant)]`.
- [x] **9.5. Verificación y Compilación:**
  - Ejecutar `npm run build` y `npm run lint` asegurando 0 errores.

---

### 🔔 FASE 10: Motor de Tonos y Alertas Sonoras Universitarias y Mundiales (Notification Sound Studio)
**Estado:** `LISTA PARA IMPLEMENTAR`

#### Objetivo
Dotar a la aplicación de un catálogo completo de tonos y campanas de escuelas y universidades del mundo (Japón, Reino Unido, Francia, Oxford, campus clásico, cuenco tibetano, campana retro, marimba y gota zen), con preescucha interactiva en vivo en la pantalla de Ajustes y compatibilidad nativa con los canales de notificación de Android (`NotificationChannel` vía `@capacitor/local-notifications`) y la PWA Web.

#### Recursos de Audio Sintetizados y Listos en el Proyecto
Los archivos de sonido fueron sintetizados matemáticamente a 44.1 kHz PCM 16-bit Mono y están disponibles en:
- `public/sounds/` (para PWA y preescucha en navegador)
- `android/app/src/main/res/raw/` (para alarmas nativas de Android con pantalla bloqueada)

Catálogo Internacional de Tonos:
1. 🎌 **`chime_school_jp.wav`**: Timbre Escolar Japonés (*Westminster Quarters* en celesta/campana tubular armónica: Fa#4, Re4, Mi4, La3).
2. 🇬🇧 **`chime_big_ben.wav`**: Gran Reloj de Westminster / Big Ben de Londres (armónicos de campana pesada de torre inglesa: Mi4, Sol#4, Fa#4, Si3).
3. 🇫🇷 **`chime_lycee_fr.wav`**: Timbre de Liceo Francés y Escuela Europea (intervalo melódico Sol5 → Mi5 en barras vibrafónicas).
4. 🔔 **`bell_retro_school.wav`**: Campana Escolar Retro / Timbre Mecánico (martillo oscilante a 22 Hz sobre dos copas metálicas "Brrr-ring").
5. 🎓 **`carillon_oxford.wav`**: Carillón de Torre Universitaria (Oxford / Heidelberg: secuencia triunfal Do5, Mi5, Do6).
6. 🏛️ **`bell_campus.wav`**: Campana de Torre Universitaria Clásica (resonancia profunda de bronce académico).
7. 🧘 **`bowl_tibetan_zen.wav`**: Cuenco Tibetano / Campana de Meditación Zen (432 Hz armónico puro con batimiento binaural calmante).
8. 🪵 **`marimba_gentle.wav`**: Marimba Suave Lofi (acorde acústico de madera Do-Mi-Sol cálido y no intrusivo).
9. 💧 **`zen_drop.wav`**: Gota Zen de Biblioteca (tono minimalista de 80ms para espacios silenciosos).
10. 📱 **`default`**: Tono predeterminado del sistema operativo.

#### Tareas de Implementación (Fase 10)
- [ ] **10.1. Tipado y Configuración en `src/features/settings/types.ts`:**
  - Definir:
    ```ts
    export type NotificationSoundTone =
      | 'chime_school_jp'
      | 'chime_big_ben'
      | 'chime_lycee_fr'
      | 'bell_retro_school'
      | 'carillon_oxford'
      | 'bell_campus'
      | 'bowl_tibetan_zen'
      | 'marimba_gentle'
      | 'zen_drop'
      | 'default';
    ```
  - Añadir a `AppSettings`: `notificationTone: NotificationSoundTone;` (por defecto `'chime_school_jp'`).
- [ ] **10.2. Selector M3 con Preescucha Interactiva en `NotificationSettings.tsx`:**
  - En `src/features/settings/components/NotificationSettings.tsx`:
    - Añadir prop `onSelectTone: (tone: NotificationSoundTone) => void`.
    - Mostrar bloque "Tono de notificación" cuando `settings.notificationSound && settings.notificationsEnabled` estén activos.
    - Renderizar los 10 tonos en fichas/píldoras compactas con nombre, región/estilo e icono.
    - Botón de preescucha interactiva (Play / Stop) con icono `Play` / `Square` de `lucide-react` reproduciendo `/sounds/${tone}.wav` mediante `new Audio()`.
    - Manejar ciclo de vida: pausar audio anterior al presionar Play en otro tono o al desmontar.
  - Conectar en `SettingsView.tsx`: `onSelectTone={(tone) => void updateSettings({ notificationTone: tone })}`.
- [ ] **10.3. Integración en `NotificationService.ts` y Canales Nativos de Android:**
  - En `src/shared/services/notificationService.ts`:
    - Crear canales dinámicos según el tono:
      `id: 'academic_schedule_' + (settings.notificationTone || 'chime_school_jp')`
      apuntando a `sound: (settings.notificationTone === 'default' ? undefined : (settings.notificationTone || 'chime_school_jp') + '.wav')`.
    - Incluir `settings.notificationTone` en `currentHash` (fingerprint guard).
    - Asignar el canal y el sonido correspondiente en `notificationsToSchedule` y `sendTestNotification`.
- [ ] **10.4. Verificación y Compilación:**
  - Ejecutar `npm run build` y `npm run lint` asegurando 0 errores.

---

## 🤝 3. Flujo de Trabajo para Claude

1. **Lectura:** Lee este archivo `TASK_PLAN.md` al inicio de cada tarea.
2. **Ejecución Incremental:** Ejecuta **únicamente la Fase que el usuario te indique** (empezando por la **Fase 1**).
3. **Verificación:** Al terminar los cambios de código de la fase, ejecuta `npm run build` y `npm run lint` para garantizar cero errores de TypeScript (`tsc -b`) y cero warnings de `oxlint`.
4. **Reporte:** Informa los archivos modificados para que Antigravity realice la auditoría arquitectónica y actualice la documentación en Obsidian.
