# ADR-001: Persistencia Offline-First con Dexie.js e IndexedDB

## Estado
Aceptado

## Fecha
2026-10-14

## Contexto
Los estudiantes universitarios frecuentemente se encuentran en campus o aulas con conectividad Wi-Fi deficiente, saturada o inexistente, pero necesitan consultar sus horarios lectivos, aulas, apuntes y datos de catedráticos al instante. Adicionalmente, los apuntes y horarios constituyen información personal y académica privada. Depender de un backend remoto introduce latencia, costos continuos de servidores y vulnerabilidad ante caídas de red.

## Decisión
Implementar una arquitectura **Offline-First / Local-First** con **IndexedDB** gestionado a través de **Dexie.js**.

## Alternativas Consideradas

### 1. Backend REST Tradicional (PostgreSQL / MySQL + API)
- **Ventajas:** Sincronización automática entre múltiples dispositivos.
- **Desventajas:** La aplicación deja de funcionar ante falta de conexión; requiere infraestructura de autenticación y servidores con costo recurrente; expone la privacidad del estudiante.
- **Veredicto:** Rechazado como mecanismo primario.

### 2. LocalStorage del Navegador
- **Ventajas:** API síncrona simple.
- **Desventajas:** Límite estricto de 5 MB; no soporta almacenamiento binario de fotos de pizarrón o archivos; bloquea el hilo principal en operaciones de E/S.
- **Veredicto:** Rechazado para el catálogo de datos principal (solo retenido para configuraciones simples y metadatos efímeros).

### 3. Dexie.js sobre IndexedDB
- **Ventajas:** Soporta transacciones ACID reales; reactividad nativa mediante `useLiveQuery`; capacidad de decenas de megabytes para almacenar fotos e imágenes; totalmente asíncrono y sin costo de servidor.
- **Veredicto:** Aceptado.

## Consecuencias
- La aplicación es 100% operativa desde el primer segundo sin requerir conexión a internet.
- Para respaldar la información, se implementó un sistema de exportación e importación en formato JSON atómico compatible con Storage Access Framework (SAF) en Android y descargas directas en Web/Desktop.
