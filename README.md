# 🎓 Agenda Universitaria PWA

> *"POR Y PARA LOS ESTUDIANTES"*

Aplicación Web Progresiva (PWA) y app nativa para Android (vía Capacitor) diseñada para la gestión integral de la vida académica universitaria con arquitectura **Local-First / Offline-First**.

---

## 👨‍💻 Autoría y Créditos

* **Desarrollador:** **Jorge I. Barrera V.**
* **Eslogan:** *"POR Y PARA LOS ESTUDIANTES"*
* **Versión:** `v1.5.5`

---

## 🚀 Características Principales

1. **Horarios Académicos Inteligentes:**
   - Visualización por bloques lectivos (vista diaria y semanal de 5 a 7 días).
   - Centro de Control en Vivo que detecta en tiempo real la clase en curso y el siguiente bloque.
   - Modalidades Presencial (campus/aula) y Virtual (enlaces de videollamada con un clic).

2. **Plan de Asignaturas:**
   - Catálogo curricular con cálculo automático de créditos, bloques lectivos y conteo de apuntes.
   - Vinculación directa con docentes titulares.

3. **Cuerpo Docente y Asesorías:**
   - Directorio oficial de profesores con avatares personalizables.
   - Enlaces directos a correo institucional, teléfono, cubículo y horarios de asesoría.

4. **Cuaderno de Apuntes Universitario:**
   - Editor de texto enriquecido (WYSIWYG con TipTap) optimizado con barra inferior docked en 2 filas ergonómica para móviles (*Thumb Zone*).
   - Inserción y compresión de fotos de pizarrón directamente desde la cámara o galería.
   - Visor Lightbox con Zoom multitáctil e interactivo.

5. **Offline-First & Privacidad:**
   - Todos los datos persisten localmente en el dispositivo con **IndexedDB** (`Dexie.js`).
   - Exportación e importación de copias de seguridad en formato JSON.

6. **Notificaciones Locales:**
   - Recordatorios antes de cada clase mediante `@capacitor/local-notifications`.

7. **Apariencia:**
   - Soporte para Tema Claro, Modo Oscuro y Tema del Sistema.

---

## 🛠️ Stack Tecnológico

* **Frontend:** React 19, TypeScript, Vite.
* **Estilos:** Tailwind CSS v4, Atomic Design (Tokens/Quarks & Atoms).
* **Persistencia Local:** Dexie.js (IndexedDB).
* **Móvil:** Capacitor Android SDK.
* **Editor:** TipTap (StarterKit, Image, Underline, Placeholder).
* **Íconos:** Lucide React.
