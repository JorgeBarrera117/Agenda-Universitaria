# ADR-002: Estrategia Multiplataforma con Capacitor y Electron

## Estado
Aceptado

## Fecha
2026-10-22

## Contexto
El público estudiantil utiliza principalmente dos dispositivos clave para sus estudios:
1. Su teléfono móvil (**Android**) mientras se desplaza por los pasillos y campus universitario.
2. Su computadora portátil o de escritorio (**Windows**) mientras realiza tareas, proyectos o estudia en su hogar o biblioteca.

Desarrollar aplicaciones nativas separadas (una en Kotlin/Jetpack Compose para Android y otra en C#/.NET o C++ para Windows) fragmentaría la base de código, cuadruplicaría el esfuerzo de mantenimiento y ralentizaría la incorporación de mejoras.

## Decisión
Mantener un único núcleo de código frontend en **React 19 + TypeScript + Vite** y compilarlo a tres plataformas oficiales:
1. **Web PWA:** Desplegada en hosting estático / GitHub Pages con Service Workers.
2. **Android:** Empaquetada con **Capacitor**, aprovechando plugins Java personalizados para alarmas y SAF.
3. **Windows Desktop:** Empaquetada con **Electron** y **electron-builder** (NSIS), con puente seguro `contextBridge` e IPC para la apertura nativa de documentos con `shell.openPath`.

## Consecuencias
- 98% del código de componentes, hooks y repositorios se comparte de forma idéntica entre las 3 plataformas.
- La experiencia de usuario, las paletas de colores y la interfaz son consistentes en cualquier dispositivo.
- Se requirió diseñar abstracciones de plataforma en hooks como `useSubjectDocuments` (para delegar al visor del SO adecuado según el entorno).
