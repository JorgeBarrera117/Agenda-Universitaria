# ADR-003: Adopción de Material Design 3 y Motor de Paletas Dinámicas Material You

## Estado
Aceptado

## Fecha
2026-10-16

## Contexto
En versiones tempranas (v1.6.x), la aplicación experimentó con estilos inspirados en Telegram (gradientes vivos y bordes muy marcados). Si bien era funcional, los usuarios manifestaron fatiga visual y falta de sobriedad académica en ciertos módulos, sumado a problemas de contraste WCAG en Modo Claro (texto blanco sobre colores pasteles) y selectores desplegables nativos del sistema operativo que rompían la inmersión visual.

## Decisión
Migrar formalmente el sistema de diseño a las especificaciones oficiales de **Google Material Design 3 (M3)** y crear un **Motor de Paletas Dinámicas Material You**:
1. Componentes canónicos M3: Menús de selección `M3Select`, Navigation Bar con píldoras activas, FABs squircles de radio orgánico (16px / 28px) y Search Bars en cápsula `rounded-full`.
2. Jerarquía de elevación de superficies (`Surface`, `Surface Container`, `Surface Container High`, `Surface Container Highest`).
3. Inyección reactiva de 8 paletas cromáticas mediante variables CSS en `:root` recalculadas en tiempo de ejecución en $\le 1$ ms sin re-montar el árbol DOM.

## Consecuencias
- Cumplimiento estricto con los estándares de accesibilidad **WCAG 2.1 AA** (ratio de contraste $\ge 4.5:1$ en texto y $\ge 3:1$ en controles).
- El usuario puede personalizar completamente el color de acento de su aplicación académica según sus preferencias de estudio.
- Aspecto moderno, profesional y alineado con los ecosistemas Android 14/15 y Windows 11.
