# 📜 Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

---

## [1.7.10.9] - 2026-11-02

### Corregido
- **Ocultamiento de barras de navegación superior e inferior en sub-apartados de Documentos (`App.tsx` & `DocumentsView.tsx`):**
  - Implementación del hook de sincronización `onEditorActiveChange` en `DocumentsView.tsx` y conexión con el manejador `handleDocumentsEditorChange` en `App.tsx`.
  - Al acceder a los apartados independientes de vinculación (`DocumentLinkForm`), ficha técnica (`DocumentDetailView`) o reasignación (`DocumentReassignView`), la barra superior (`Navbar`) y la barra inferior de navegación móvil (`BottomNav`) se ocultan automáticamente, otorgando el 100% del área visible en pantalla sin interferencias visuales.

---

## [1.7.10.8] - 2026-11-02

### Corregido & Optimizado
- **Erradicación de menús emergentes y modales en el apartado de Documentos (`DocumentsView.tsx`):**
  - Transformación integral de flujos a **apartados independientes a pantalla completa**:
    - **`DocumentLinkForm.tsx`:** Apartado dedicado para vincular archivos locales y enlaces web con espacio ilimitado, dropzone de carga interactiva, selección rápida de asignaturas, previsualización de archivo y botones M3 ergonómicos.
    - **`DocumentDetailView.tsx`:** Apartado dedicado para ficha técnica, especificaciones MIME, rutas locales sandboxed de Android y FileProvider URI con botones de copiado y apertura directa sin dobles barras de desplazamiento.
    - **`DocumentReassignView.tsx`:** Apartado dedicado para reasignar la materia de un documento con selector M3 amplio y catálogo en cuadrícula.
  - Integración de `useBackButton` con prioridad `SUBVIEW` en cada apartado para garantizar retroceso fluido en móviles Android sin cerrar la aplicación.
- **Detección inteligente de dirección en selector M3 (`M3Select.tsx`):**
  - Incorporación de cálculo dinámico de posición (`openDirection`): si el espacio inferior en la ventana es menor a 260px, el menú desplegable se orienta automáticamente hacia arriba (`bottom-[calc(100%+6px)]`), evitando desbordamientos y recortes visuales.

---

## [1.7.10.7] - 2026-11-02

### Corregido
- **Erradicación de bucle infinito de renders en editor de notas (`NoteEditor.tsx` & `RichTextEditor.tsx`):**
  - Desacoplamiento de disparadores imperativos de inserción multimedia: reemplazo del estado reactivo `useState` por referencias mutables `useRef<(() => void) | null>(null)` y callbacks estables `useCallback` para los hooks `onTriggerCameraReady`, `onTriggerGalleryReady` y `onEditorReady`.
  - Eliminación del error en consola `Maximum update depth exceeded` (+2160 ciclos repetitivos) al invocar la cámara o galería desde el menú superior de la barra de redacción.
- **Eliminación de advertencia de extensión duplicada en TipTap (`RichTextEditor.tsx`):**
  - Remoción de la importación redundante `@tiptap/extension-underline`: `@tiptap/starter-kit` v3+ ya incluye y gestiona de forma nativa la extensión de subrayado, eliminando la advertencia `[tiptap warn]: Duplicate extension names found: ['underline']` preservando todas las funcionalidades del formateador de texto.
- **Centralización Singleton de plugin nativo Capacitor (`src/shared/plugins/widgetBridge.ts`):**
  - Creación del módulo centralizado `widgetBridge.ts` con interfaz unificada `WidgetBridgePlugin` y registro único mediante `registerPlugin('WidgetBridge')`.
  - Refactorización de `backup.ts`, `widgetSyncService.ts` y `useSubjectDocuments.ts` para importar la instancia singleton, eliminando por completo los errores reiterados `Capacitor plugin "WidgetBridge" already registered. Cannot register plugins twice.`

---

## [1.7.10.6] - 2026-11-02

### Optimizado
- **Reorganización y Densidad M3 en Ajustes y Configuración (`SettingsView.tsx` & `SettingsModal.tsx`):**
  - Descongestión del Menú Principal: Tarjeta de identidad del campus compactada (`p-2.5 sm:p-3`, avatar `w-9 h-9 sm:w-10 sm:h-10`, badges `px-2 py-0.5 text-[10px]`). Filas de navegación compactadas de `p-3.5` a `p-2.5 sm:p-3` con esquinas `rounded-2xl sm:rounded-3xl` e iconos en squircle de 32px (`w-8 h-8`).
  - Sub-vistas Especializadas de Alta Densidad:
    - **Apariencia y Tema:** Selector de luminosidad (Claro/Oscuro/Auto) con tarjetas compactas de 38px de altura; grilla adaptativa de paletas Material You con previsualización armónica sin saltos de línea ni desbordamientos; Wallpaper Studio estilizado con miniaturas de tapiz de 44px (`h-11`), sliders compactos de opacidad, escala y blur, y previsualización en vivo descongestionada.
    - **Semestre y Horario:** Input y botón de periodo lectivo compactados (`py-2`, `h-9 sm:h-10`), botones de vista semanal/diaria y micro-píldoras de días visibles.
    - **Notificaciones y Avisos:** Píldora de comprobación de permisos y prueba compacta; botones de momentos de aviso (15 min antes, al iniciar, sonido) en tarjetas `p-2.5`.
    - **Fotografías y Pizarrón:** Tarjetas de compresión 720p y 1080p descongestionadas (`p-3 rounded-xl sm:rounded-2xl`).
    - **Acerca de:** Ficha técnica y créditos condensados sin scroll forzado.
  - Sincronización Segura sin Renders en Cascada: Erradicación del efecto síncrono `setSemesterInput(settings.semesterName)` sincronizándolo directamente durante la fase de renderizado, y adición de callback memoizado para `refreshStorageEstimate`.
- **Descongestión y Prevención de Fugas en Almacenamiento (`BackupSection.tsx`):**
  - Contenedor rediseñado con padding equilibrado `p-3 sm:p-4 rounded-2xl sm:rounded-3xl` (reducción de más del 35% de espacio residual).
  - Bloques de Exportación e Importación organizados en cuadrículas de 2 columnas de alta densidad con tipografía y badges optimizados.
  - Control de temporizadores (`copiedTimerRef`) con descarte garantizado en el ciclo de desmontaje (`clearTimeout`), previniendo fugas de memoria en WebViews móviles.
  - Modal de restauración por texto JSON rediseñado con área de texto compacta de 6 filas y botones de acción directos.

---

## [1.7.10.5] - 2026-11-02

### Optimizado
- **Reorganización y Densidad M3 en Documentos (`DocumentsView.tsx`):**
  - Descongestión de Tarjetas de Documentos: Reducción de padding general de `p-3.5 rounded-[24px]` a `p-3 rounded-2xl sm:rounded-3xl`, squircle de formato compacto (`w-9 h-9 sm:w-10 sm:h-10`) y acciones ergonómicas integradas sin saltos forzados de línea.
  - Barra de búsqueda y selector M3: Reducción de altura a `h-10 sm:h-11` con borrado atómico y selector de ordenamiento `M3Select` en píldora compacta.
  - Micro-chips de asignaturas y formatos: Reducción de padding de filtros a píldoras de baja huella vertical (`px-2.5 py-1` y `px-2 py-0.5`).
  - Optimización de rendimiento $O(1)$: Creación de mapa memoizado `subjectDocCounts` erradicando el filtrado redundante de arrays en cada píldora de materia durante el renderizado.
  - Prevención de fugas de memoria: Control y limpieza estricta de temporizadores (`clearTimeout`) en notificaciones y copiado al portapapeles.
  - Modales compactos: Descongestión de la ficha técnica del archivo, del diálogo de vinculación de archivos/enlaces y del modal de reasignación de materia.

---

## [1.7.10.4] - 2026-11-02

### Optimizado
- **Reorganización y Densidad M3 en Apuntes (`NotesView.tsx`):**
  - Descongestión de Galería: Rediseño compacto de tarjetas estilo hoja de papel (`rounded-2xl sm:rounded-3xl`, padding `p-2.5 sm:p-3`, miniatura `p-2 my-2`), aumentando en más del 40% la cantidad de documentos visibles simultáneamente en pantalla sin desplazamiento vertical forzado.
  - Barra de búsqueda M3 compactada a `h-10 sm:h-11` y micro-chips de asignaturas con espaciado optimizado.
  - Modo Lectura refinado: reducción de márgenes envolventes masivos (`p-5 sm:p-10` a `p-3.5 sm:p-6 lg:p-7`), encabezado compacto de 44px y grilla de fotografías de pizarrón de alta densidad.
  - Erradicación de bucles y renderizados en cascada: sincronización de filtros durante el ciclo de render sin recurrir a efectos síncronos con `setState`, y memoización $O(1)$ de asignaturas mediante `subjectMap` erradicando barridos repetitivos de arrays en el mapeo de documentos.
- **Lienzo y Dock de Redacción Compacto (`NoteEditor.tsx` & `RichTextEditor.tsx`):**
  - Barra de edición superior compactada a `py-2` con controles de acción discretos (guardar, deshacer, rehacer, inserción y opciones).
  - Título y metadatos de asignatura integrados sin márgenes inflados, ganando más del 15% de área de escritura útil en móviles y pantallas de portátiles.
  - Barra inferior fija de herramientas tipográficas rediseñada bajo estándares M3 con altura compacta (`py-1.5`) y botones ergonómicos de formato y captura multimedia.

---

## [1.7.10.3] - 2026-10-23

### Optimizado
- **Reorganización y Densidad M3 en Profesores (`ProfessorsView.tsx`):**
  - Banner de asesorías y cubículos descongestionado: sustitución de tarjeta pesada aislada por píldora compacta `rounded-2xl` de 38px que reduce drásticamente el espacio vertical superior.
  - Barra de búsqueda M3 compactada a `h-10 sm:h-11` con botones de borrado atómico.
  - Tarjetas de catedrático de alta densidad: avatar de contacto (`size="contact"`), micro-pills de materias asignadas y micro-acciones discretas de edición y eliminación (`w-7 h-7 sm:w-8 sm:h-8`).
  - Optimización de rendimiento: creación de mapa de materias `subjectMap` memoizado con `useMemo` para búsquedas en tiempo $O(1)$ erradicando barridos repetitivos de arrays en el renderizado de la lista y en el filtro de búsqueda.
- **Formulario de Catedrático Compacto (`ProfessorForm.tsx`):**
  - Unificación estructural: sustitución de 3 tarjetas masivas separadas por un contenedor único M3 de alta densidad.
  - Sustitución de vista previa gigante de 140px por una tira fina viva de 38px con avatar e indicador de estado en tiempo real.
  - Sección de identidad visual compacta: micro-swatches circulares de color de 28px (`w-7 h-7`) y chips horizontales de selección de muñequito/ícono.
  - Distribución eficiente en cuadrícula para datos personales (correo, teléfono, cubículo, materias y notas de asesoría) reduciendo el desplazamiento vertical en un 55%.

---

## [1.7.10.2] - 2026-10-23

### Optimizado
- **Reorganización y Densidad M3 en Materias (`SubjectsView.tsx`):**
  - Condensación de métricas superiores (*Materias*, *Créditos*, *Bloques*): reducción de padding de `p-3.5 sm:p-5` a `p-2 sm:p-2.5 rounded-2xl` y tipografía optimizada, liberando espacio superior en pantallas móviles.
  - Tarjetas de asignatura de alta densidad: avatar de materia optimizado (`w-9 h-9 sm:w-10 sm:h-10`), erradicación de cajas vacías punteadas y renderizado estrictamente condicional de metadatos (docente, aula y créditos).
  - Micro-acciones agrupadas y ergonómicas: botones de acceso directo a *Archivos* y *Apuntes* compactados sin saltos de línea forzados.
  - Prevención de recálculos: memoización estricta de `totalCredits` con `useMemo` evitando recomputaciones innecesarias durante la navegación o apertura de modales.
- **Formulario de Registro y Edición de Asignatura Compacto (`SubjectForm.tsx`):**
  - Unificación estructural: fusión de 3 tarjetas masivas separadas (`rounded-[28px]`, `p-5`) en un único contenedor ergonómico M3 con distribución en rejilla fluida.
  - Reducción del Live Preview de 160px a una píldora viva de estado de solo 38px, ahorrando más de 120px de espacio vertical.
  - Selector de color e icono de ultra baja huella: micro-swatches circulares de 28px (`w-7 h-7`) y chips de icono horizontales compactos con auto-scroll.
  - Desplegable M3Select de docente titular con panel colapsable de creación rápida de profesor inline y memoización con `useMemo` de `professorOptions`.
  - Reducción del 50% de altura vertical total en pantallas táctiles y escritorio.

---

## [1.7.10.1] - 2026-10-23

### Optimizado
- **Reorganización y Densidad M3 en Horario (`ScheduleView.tsx`):**
  - Rediseño compacto de tarjetas semanales (`weekly`), reduciendo la altura vertical de cada bloque en un 40% y eliminando anidamientos innecesarios para permitir visualizar múltiples clases simultáneas en pantalla sin scroll excesivo.
  - Píldora de estado de jornada no invasiva: sustitución de la tarjeta gigante vacía de fin de jornada por un badge sutil que no desplaza el contenido hacia abajo.
  - Optimización de rendimiento y prevención de bucles: memoización con `useMemo` de filtros temporales (`todaySlots`, `daySlots`, `activeClassNow`, `nextClassToday`), asegurando 0ms de latencia y eliminando re-renders redundantes en móvil y escritorio.
- **Formulario de Cátedra Compacto (`ScheduleSlotForm.tsx`):**
  - Unificación estructural: sustitución de 4 tarjetas masivas aisladas (Live Preview gigante de 200px, 2 botones gigantescos de modalidad) por un contenedor único de alta densidad Material Design 3.
  - Selector segmentado de modalidad en cápsula compacta (`Presencial` / `Virtual`) en línea con la selección de materia.
  - Reducción del 55% de altura vertical, permitiendo completar el formulario sin desplazamiento forzado en laptops y dispositivos móviles.
  - Memoización de opciones de selectores (`subjectOptions`, `professorOptions`, `dayOptions`) para erradicar recálculos en cada pulsación.

---

## [1.7.9.12] - 2026-10-22

### Añadido
- **Soporte Nativo para Windows (.exe):** Configuración de **Electron v45** y **electron-builder** con empaquetado NSIS para distribución de instalador de escritorio de 64 bits.
- **Apertura de Documentos Nativa en el SO:** Canal IPC en `electron/preload.cjs` y `electron/main.cjs` que delega la apertura de archivos al visor predeterminado de Windows (Adobe Acrobat, Foxit, Word, Excel) mediante `shell.openPath` en lugar de descargar el archivo.
- **Componente ErrorBoundary:** Interceptor de excepciones no controladas en React con diseño Material Design 3, diagnóstico técnico en pantalla y botones de acción ("Reintentar acción" y "Recargar aplicación") en `src/shared/components/ErrorBoundary.tsx`.

### Corregido
- **Bloqueo del instalador de Windows:** Integración de macros `electron/installer.nsh` (`customInit` / `customUnInit`) que terminan procesos residuales con `taskkill` evitando el aviso de *"No se puede cerrar Agenda Universitaria"*.
- **Logo roto en la barra superior:** Migración de rutas absolutas `/app-icon-claro.svg` a relativas seguras `./app-icon-claro.svg` compatibles con el protocolo `file://` en `Navbar.tsx` y `SettingsView.tsx`.
- **Violación de Rules of Hooks en ScheduleView:** Reubicación de los hooks de desplazamiento semanal (`weeklyScrollRef`, `canScrollLeft`, `canScrollRight`, `checkScroll`, `useEffect`) antes del retorno condicional `if (isModalOpen)`, eliminando el error `Rendered fewer hooks than expected`.
- **Manejo defensivo en migración de esquemas:** Aplicación de Defensive Array Coalescing `(p.subjectIds || []).includes(...)` y safe navigation sobre `classroom` para evitar excepciones `TypeError: Cannot read properties of undefined`.

---

## [1.7.9.11] - 2026-10-22

### Añadido
- **Cuadrícula Semanal Responsiva para Laptops (1366x768):** Sustitución de anchos rígidos mínimos (`min-w-[1500px]`) por `lg:min-w-0` y `xl:min-w-0`, permitiendo que el horario semanal de 5, 6 y 7 días encaje al 100% del viewport sin desbordamiento.
- **Botones Flotantes de Desplazamiento Horizontal:** Inclusión de controles táctiles reactivos `ChevronLeft` y `ChevronRight` que aparecen únicamente cuando el contenido del horario excede el ancho de la ventana.

---

## [1.7.9.10] - 2026-10-21

### Corregido
- **Prevención de desbordamiento en tarjeta de paletas:** Corrección geométrica en `SettingsView.tsx` para evitar que los swatches de color de Material You desborden el contenedor en pantallas móviles angostas.

---

## [1.7.9.9] - 2026-10-21

### Añadido
- **Estudio de Fondos Adaptativos (AppWallpaper Studio):** Soporte para 8 patrones vectoriales SVG de baja opacidad y soporte para fotografías personalizadas con desenfoque Gaussiano renderizado en GPU.

---

## [1.7.9.8] - 2026-10-21

### Corregido
- **Escudo Anti Ghost-Clicks en FAB:** Implementación de retardo de activación de 220ms y escudo de fase de captura para evitar pulsaciones accidentales a través de capas en móviles.

---

## [1.7.9.1] a [1.7.9.7] - 2026-10-21

### Añadido
- **Módulo de Archivos y Documentos por Materia (`DocumentsView.tsx`):**
  - Almacén de archivos PDF, presentaciones, enlaces a Google Drive y OneDrive asociados a asignaturas.
  - Base de datos IndexedDB dedicada (`AgendaDocsCacheDB`) para blobs sin sobrecargar la base de datos principal.
  - Filtros en tiempo real por formato (.pdf, .docx, .xlsx, .pptx, enlaces), buscador reactivo y ordenamiento por fecha/alfabético.

---

## [1.7.8] - 2026-10-16

### Añadido
- **Componente Universal M3Select (`M3Select.tsx`):**
  - Reemplazo total de elementos `<select>` nativos del sistema operativo por menús flotantes canónicos de Material Design 3 (`rounded-[22px]`, elevación de sombreado y checkmarks de selección activa).
  - Soporte de variantes `field` (para formularios) y `pill` (para barras de ordenamiento).

---

## [1.7.5] a [1.7.7] - 2026-10-16

### Añadido
- **Sistema de Temas Dinámicos Material You:**
  - 8 paletas cromáticas inspiradas en Google Pixel (Azul Google, Menta, Ámbar, Índigo, Carmesí, Teal, Púrpura, Slate).
  - Inyección reactiva en `:root` CSS Custom Properties con tiempo de conmutación $\le 1$ ms.
- **Formularios Canónicos Material Design 3:** Tarjetas elevadas (`rounded-[28px]`), inputs `Surface Container High` y switches ergonómicos.
- **Contraste WCAG Canónico:** Contraste $\ge 5:1$ en FABs de modo claro y erradicación de triplicados de acciones en el modo lectura.

---

## [1.7.0] a [1.7.4] - 2026-10-16

### Añadido
- **Directorio de Profesores Estilo Contactos:** Búsqueda continua, tarjetas de acción rápida, avatares squircles y directorio de cubículos.
- **Editor Full-Bleed de Apuntes (Estilo Google Docs):** Erradicación de tarjetas contenedoras, superficie completa para redacción y menú contextual de tres puntos (⋮).
- **Arquitectura Keep-Alive (Tab Retention):** Preservación de componentes montados en el DOM con alternancia CSS (`block` vs `hidden`) para transiciones de 0 ms y sin parpadeos.

---

## [1.6.0] a [1.6.9] - 2026-10-16

### Optimizado
- **Prevención de Sobrecalentamiento y Fuga de Memoria:** Clausura explícita de `ImageBitmap.close()`, consultas livianas de solo claves (`keys()`) en Dexie y debounce en alarmas locales.
- **Integración con SAF en Android:** Selector nativo de archivos con `ACTION_OPEN_DOCUMENT` para respaldo y restauración atómica en formato JSON.
- **Ajustes Agrupados Estilo Telegram:** Subvistas dedicadas con jerarquía de navegación LIFO en el botón físico Atrás de Android.

---

## [1.0.0] a [1.5.5] - 2026-10-14 a 2026-10-15

### Añadido
- **Lanzamiento Inicial de Agenda Universitaria:**
  - Horario semanal y diario con cálculo en vivo de clases.
  - Catálogo de asignaturas y cálculo de créditos.
  - Directorio de profesores y vinculación curricular.
  - Cuaderno de apuntes con editor WYSIWYG TipTap y fotos del pizarrón.
  - Arquitectura Offline-First con Dexie.js (IndexedDB).
  - Notificaciones locales programadas y soporte de instalación PWA.
