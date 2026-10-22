# 🤝 Guía de Contribución (Contributing Guidelines)

¡Gracias por tu interés en colaborar con **Agenda Universitaria**! Este proyecto se construye bajo el lema **"POR Y PARA LOS ESTUDIANTES"** con el compromiso de ofrecer software confiable, privado y offline-first.

Para mantener la excelencia técnica del proyecto, solicitamos que todas las contribuciones sigan las directrices detalladas en esta guía.

---

## 🏛️ 1. Filosofía de Desarrollo: Anti-Vibecoding

En este proyecto aplicamos el principio **Anti-Vibecoding**:
> *Comprender antes de programar: Cada decisión de diseño, estructura de datos o librería añadida debe estar fundamentada técnica y conceptualmente.*

- No introducimos dependencias externas para tareas que puedan resolverse de forma nativa y limpia.
- Toda entidad de base de datos o contrato de interfaz debe diseñarse pensando en la resiliencia offline y la sincronización con el sistema operativo.
- Las decisiones arquitectónicas importantes se documentan en un **ADR (Architectural Decision Record)** en `docs/decisions/`.

---

## 🧱 2. Principios Arquitectónicos

1. **Clean Architecture & Feature-First:**
   - La lógica de negocio está organizada por dominios en `src/features/` (`schedule`, `subjects`, `professors`, `notes`, `documents`, `settings`).
   - La interfaz de usuario no interactúa directamente con la persistencia en bajo nivel; se usa el **Patrón Repositorio** y Custom Hooks reactivos con `Dexie.js`.
2. **Tipado Estricto (TypeScript):**
   - No está permitido el uso del tipo `any`.
   - Todos los modelos de datos, DTOs y props de componentes deben estar tipados estrictamente.
3. **Respeto a las Reglas de Hooks de React:**
   - Todos los hooks (`use*`) deben declararse incondicionalmente en la cima de la función componente, **antes** de cualquier retorno condicional.
4. **Resiliencia ante Fallos (Fail-Safe UI):**
   - Toda sub-pantalla de creación o edición debe estar envuelta en un `ErrorBoundary` para evitar la pérdida del estado global ante excepciones imprevistas.
5. **Defensive Programming:**
   - Manejo defensivo en propiedades opcionales o datos provenientes de versiones anteriores de IndexedDB: `(p.subjectIds || []).includes(...)`.

---

## 🌿 3. Flujo de Ramas (Git Workflow)

1. **Ramas Principales:**
   - `main`: Código en producción, estable y verificado.
   - `develop` o ramas de feature: Desarrollo activo de nuevas capacidades.
2. **Convención de Nombres de Ramas:**
   - `feature/nombre-de-la-funcionalidad` (ej. `feature/export-pdf-schedule`)
   - `fix/descripcion-del-bug` (ej. `fix/weekly-scroll-padding`)
   - `docs/tema-documentado` (ej. `docs/setup-electron-guide`)
   - `perf/optimizacion` (ej. `perf/image-compression-canvas`)

---

## 💬 4. Convención de Commits (Conventional Commits)

Seguimos el estándar [Conventional Commits](https://www.conventionalcommits.org/):

$$\text{tipo}(\text{alcance}): \text{descripción concisa en minúsculas y presente}$$

### Tipos Permitidos:
- **`feat:`** Nueva característica para el usuario (ej. `feat(documents): add native file opening in windows`).
- **`fix:`** Corrección de un error o comportamiento defectuoso (ej. `fix(schedule): resolve hook order violation in schedule view`).
- **`docs:`** Modificaciones exclusivas en documentación (ej. `docs(readme): add setup and onboarding guide`).
- **`style:`** Cambios que no afectan la lógica del código (formato, espaciado, CSS puro).
- **`refactor:`** Refactorización interna de código que ni añade features ni corrige bugs.
- **`perf:`** Cambios que mejoran el consumo de CPU, GPU o memoria RAM.
- **`test:`** Adición o corrección de pruebas unitarias o de integración.
- **`chore:`** Tareas de mantenimiento, actualización de dependencias o configuración de build.

---

## ✅ 5. Verificación Previa al Envío (Pre-PR Checklist)

Antes de abrir un Pull Request, ejecuta en tu terminal:

1. **Linter de código:**
   ```bash
   npm run lint
   ```
2. **Compilación de TypeScript y Vite:**
   ```bash
   npm run build
   ```
   *Ambos comandos deben finalizar con código 0 y sin errores.*
3. **Comprobación multiplataforma:** Verifica que tus cambios funcionen correctamente en Web y no rompan la experiencia móvil ni de escritorio.
