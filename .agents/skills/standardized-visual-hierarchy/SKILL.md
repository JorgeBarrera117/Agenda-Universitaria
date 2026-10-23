---
name: standardized-visual-hierarchy
description: Guía canónica de jerarquía visual estandarizada de 5 niveles, orden sistemático de elementos, tarjetas descongestionadas y diseño de controles (botones, FABs, menús M3Select) para frontend web y móvil con Material Design 3.
---

# 🏛️ Guía Canónica: Jerarquía Visual Estandarizada de 5 Niveles y Diseño de Componentes M3

Esta skill establece las directrices de arquitectura visual, ergonomía y orden estricto de elementos para cualquier módulo, pantalla o vista de la aplicación (**Horario**, **Materias**, **Profesores**, **Apuntes**, **Archivos**, **Ajustes**).

---

## 📐 1. La Jerarquía Visual de 5 Niveles (Flujo Vertical Estricto)

Toda vista principal debe organizarse verticalmente de arriba hacia abajo respetando exactamente este orden:

```
[ Nivel 1 ] Barra Superior Global (Navbar)
     ↓
[ Nivel 2 ] Encabezado Limpio del Apartado (Título H2 + Badge + Subtítulo + Acción PC)
     ↓
[ Nivel 3 ] Bloque Informativo / Eventos Activos (Hero Card o Métricas - Condicional)
     ↓
[ Nivel 4 ] Contenido Principal (Buscador M3 + Filter Chips + M3Select + Tarjetas)
     ↓
[ Nivel 5 ] Navegación Inferior y Acción Móvil (BottomNav + DraggableFAB + Insets)
```

---

### Desglose Detallado por Nivel:

### 🔹 Nivel 1: Barra Superior Global (`Navbar`)
* **Ubicación:** Fijada en la parte superior (`sticky top-0 z-40 backdrop-blur-xl`).
* **Elementos en orden de izquierda a derecha:**
  1. Identidad institucional (isotipo/logo + nombre corto de la app).
  2. Fecha del día formateada en lenguaje natural (`miércoles, 22 de octubre`).
  3. Badge de estado offline/online (`Sin conexión` / `En línea`).
  4. Pestañas de navegación central (visibles solo en escritorio `hidden md:flex`).
  5. Botón de Ajustes (engranaje interactivo con micro-rotación).

---

### 🔹 Nivel 2: Encabezado Limpio del Apartado (`Section Header`)
* **Ubicación:** Primer bloque visual dentro del contenedor de la vista (`max-w-7xl mx-auto px-4 py-4 sm:py-6`).
* **Principio UX:** Predictibilidad espacial (Ley de Jakob). El usuario siempre encuentra el título en la misma coordenada $(X, Y)$ sin importar la pestaña activa.
* **Estructura en dos columnas:**
  * **Columna Izquierda (Identidad de la Vista):**
    - **Fila superior:** Título principal H2 (`text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white`) acompañado de un Badge de Estado / Conteo en miniatura (`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20`).
    - **Fila inferior:** Subtítulo descriptivo de una línea (`text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1`).
  * **Columna Derecha (Acción Rápida de Escritorio):**
    - Botón primario de creación (`+ Nueva Clase`, `+ Inscribir Asignatura`, `+ Nuevo Apunte`).
    - **Regla Móvil:** Oculto en móviles (`hidden md:inline-flex`), ya que en móvil la acción se delega exclusivamente al FAB inferior (Nivel 5) para no saturar el encabezado.

---

### 🔹 Nivel 3: Bloque Informativo / Eventos en Vivo (Condicional)
* **Objetivo:** Ofrecer información prioritaria o en tiempo real sin obligar al usuario a buscarla.
* **Aplicación por módulo:**
  - **Horario:** *Hero Card* de clase activa (*"En clase ahora mismo"* con cronómetro restante, aula y docente) o de la próxima clase del día.
  - **Materias:** Grid horizontal de 3 métricas compactas (*Total Materias*, *Créditos acumulados*, *Bloques semanales*).
  - **Profesores:** Tarjeta de acceso rápido a directorio de cubículos y horarios de asesoría.
  - **Apuntes / Documentos:** Se omite intencionalmente este nivel para pasar directamente al buscador y maximizar el lienzo de trabajo.

---

### 🔹 Nivel 4: Contenido Principal y Herramientas de Interacción
Se compone de dos sub-bloques estrictamente ordenados:

#### 1. Barra de Herramientas y Filtros:
* **Buscador M3:** Cápsula `rounded-full h-11 sm:h-12` con fondo `Surface Container High`, ícono de lupa a la izquierda y botón de borrado atómico a la derecha cuando hay texto.
* **Filter Chips Horizontales:** Píldoras deslizables con scroll horizontal táctil (`flex flex-nowrap overflow-x-auto no-scrollbar gap-2`). Estado activo en color primario suave y estado inactivo con borde sutil.
* **Selector de Ordenamiento / Agrupación:** Se debe usar **siempre** el componente canónico `M3Select` con `variant="pill"`, **prohibiendo** el `<select>` nativo rectangular del sistema operativo.

#### 2. Cuadrícula / Lista de Tarjetas Descongestionadas:
* **Erradicación del Layout Squeezing:** Prohibido apilar botones verticalmente en una columna lateral derecha estrecha.
* **Anatomía Estándar de Tarjeta:**
  1. **Cabecera de Tarjeta:** Ícono/Avatar cromático a la izquierda (36-44px), título completo en negrita que ocupa el 100% del ancho útil, y botones de edición (`Edit2`) y eliminación (`Trash2`) como círculos translúcidos discretos en la esquina superior derecha (`w-8 h-8 rounded-full`).
  2. **Cuerpo de Tarjeta (Representación Condicional):** Chips de metadatos (aula, código, horario, créditos) renderizados **únicamente si el dato existe**. Prohibido renderizar cajas punteadas vacías como *"Sin docente"* o *"Sin aula"*.
  3. **Pie de Tarjeta:** Métricas secundarias a la izquierda (conteo de apuntes, peso de archivo, bloques) y **Botón de Acción Primaria** a la derecha en la zona de toque natural del pulgar (Thumb Zone) (ej. *"Ver Apuntes"*, *"Tomar Apunte"*, *"Abrir Documento"*).

---

### 🔹 Nivel 5: Navegación Inferior y Botón Flotante (Móvil)
* **Bottom Navigation Bar (`BottomNav`):** Fijada en la base del viewport, con elevación suave y píldora activa horizontal oblonga tras el ícono con tipografía M3 debajo.
* **FAB (Floating Action Button):**
  - **Geometría:** Squircle canónico M3 (`w-14 h-14 rounded-2xl shadow-xl`), con opción reubicable (`DraggableFAB`) para evitar tapar información.
  - **Ratio de Contraste WCAG:** Color primario saturado en Modo Claro ($\ge 5:1$ contra el ícono blanco) y superficie enriquecida en Modo Oscuro.
* **Adaptación a Insets del Sistema Operativo:** Todo contenedor principal debe incluir relleno inferior adaptativo (`pb-[calc(5rem+env(safe-area-inset-bottom,0px))]`) para convivir de forma limpia con la barra nativa de 3 botones de Android.

---

## 🔘 2. Estandarización de Controles, Botones y Menús

| Componente | Variante | Estilo Visual y Geometría | Uso Permitido |
| :--- | :--- | :--- | :--- |
| **Botón Primario** | `primary` | Fondo primario sólido (`bg-primary text-white`), esquinas `rounded-2xl`, altura 40-44px. | Acciones principales ("Guardar", "Nueva Clase", "Inscribir"). |
| **Botón Secundario / Tonal** | `tonal` / `ghost` | Fondo translúcido sutil (`bg-primary/10 text-primary border border-primary/20`), `rounded-2xl`. | Acciones complementarias ("Cancelar", "Volver", "Ver más"). |
| **Micro-Acciones de Tarjeta** | `icon-sm` | Botones circulares translúcidos (`w-8 h-8 rounded-full bg-slate-100 dark:bg-white/5 active:scale-95`). | Editar, Borrar, Menú contextual (⋮). |
| **Menú Desplegable (Select)** | `M3Select (field)` | Contenedor elevado `rounded-2xl` con menú flotante (`rounded-[22px] shadow-2xl`). | Campos de formularios (selección de materia, docente, día). |
| **Filtro Desplegable (Pill)** | `M3Select (pill)` | Cápsula compacta `rounded-full px-3 py-1.5` con chevron animado. | Barra de herramientas de filtros y ordenamiento (A-Z, fecha). |

---

## 🚫 3. Anti-Patrones Estrictamente Prohibidos

1. ❌ **No colocar el botón de acción de PC en el encabezado móvil:** En móviles, la acción principal siempre reside en el FAB inferior (Fitts's Law).
2. ❌ **No apilar botones en columnas verticales dentro de tarjetas:** Provoca truncamiento antiestético de nombres de materias en pantallas angostas.
3. ❌ **No usar el elemento `<select>` nativo de HTML:** Rompe la estética con cajas grises rígidas del SO; usar siempre `M3Select`.
4. ❌ **No mostrar cajas punteadas vacías:** Si un metadato no fue ingresado por el usuario, no se renderiza nada.
5. ❌ **No alterar la posición del título entre apartados:** La vista de *Horario*, *Materias*, *Profesores*, *Apuntes* y *Archivos* debe mantener el título H2 exactamente en la misma posición de inicio.
