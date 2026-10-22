# 📜 Registro de Cambios (Changelog)

Todos los cambios notables en este proyecto se documentan en este archivo.
El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

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
