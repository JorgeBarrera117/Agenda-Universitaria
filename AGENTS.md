# Reglas del Proyecto: Agenda Universitaria PWA

Este proyecto es una **Progressive Web App (PWA)** offline-first diseñada para estudiantes universitarios, enfocada en la gestión de horarios de clase, profesores y apuntes clasificados por materia.

## Principios de Ingeniería de Software (Anti-Vibecoding)
1. **Comprender antes de programar:** Cada decisión arquitectónica, patrón de diseño o librería introducida debe ser explicada técnica y conceptualmente.
2. **Sincronización con el Segundo Cerebro (Obsidian):**
   - La documentación de decisiones técnicas (ADRs), conceptos y arquitectura se registra en `C:\Users\PC_1\Desktop\Obsidian\01_Proyectos\Agenda-Universitaria\` y notas de conceptos técnicos en `03-Conceptos/` siguiendo las plantillas del usuario.
3. **Clean Architecture & Feature-First:**
   - La UI no interactúa directamente con la capa de persistencia en bajo nivel. Se usa el **Patrón Repositorio** y Custom Hooks con `Dexie.js` / IndexedDB.
   - Código modularizado por `features` (`schedule`, `subjects`, `professors`, `notes`).
4. **Offline-First:**
   - Todos los datos persisten localmente en IndexedDB. La app debe ser 100% utilizable sin conexión a internet desde el primer lanzamiento tras el cacheo.
5. **Tipado Estricto (TypeScript):**
   - Todos los modelos de datos, contratos de repositorios y props de componentes deben estar tipados sin uso de `any`.
