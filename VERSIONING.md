# 🏷️ Política de Versionamiento Multiplataforma (Versioning Policy)

Este documento define la estrategia y el protocolo formal de versiones para **Agenda Universitaria**, garantizando coherencia absoluta entre los tres entornos de distribución: **Web PWA**, **Android (Capacitor APK)** y **Windows Desktop (Electron .exe)**.

---

## 📐 1. Esquema de Versionamiento

El proyecto implementa una adaptación de **Semantic Versioning 2.0 (SemVer)** orientada a la ingeniería multiplataforma:

$$\text{Versión} = \text{MAJOR} . \text{MINOR} . \text{PATCH} [ . \text{SUBPATCH} ]$$

* **MAJOR (1.x.x):** Cambios de arquitectura mayores o rediseños de paradigmas globales de almacenamiento / interfaz.
* **MINOR (x.7.x):** Nuevas funcionalidades completas (ej. Módulo de Archivos y Documentos, Motor de Paletas Material You, Soporte Desktop).
* **PATCH (x.x.9):** Ajustes de módulos, integraciones de hardware y optimizaciones de ergonomía.
* **SUBPATCH (x.x.x.12):** Correcciones críticas de estabilización, resolución de condiciones de carrera y compatibilidad con pantallas y sistemas operativos específicos.

---

## 🔄 2. Matriz de Sincronización entre Plataformas

Cada versión publicada se sincroniza en los siguientes 3 archivos del repositorio:

| Plataforma / Componente | Archivo de Configuración | Claves Involucradas | Ejemplo en v1.7.9.12 |
| :--- | :--- | :--- | :--- |
| **Global / UI** | `src/shared/constants/appInfo.ts` | `APP_INFO.version` | `'1.7.9.12'` |
| **Android (APK)** | `android/app/build.gradle` | `versionName`<br>`versionCode` | `"1.7.9.12"`<br>`17912` |
| **Windows Desktop** | `package.json` | `version`<br>`build.nsis.artifactName` | `"1.7.12"` *(SemVer 3-part)*<br>`"${productName}-Setup-v1.7.9.12.${ext}"` |

### Fórmula para el `versionCode` de Android
Google Play y el empaquetador de Android exigen un entero monotónicamente creciente para el `versionCode`. La fórmula utilizada es:

$$\text{versionCode} = (\text{MAJOR} \times 10000) + (\text{MINOR} \times 1000) + (\text{PATCH} \times 10) + \text{SUBPATCH}$$

*Ejemplo para v1.7.9.12:*
$$(1 \times 10000) + (7 \times 1000) + (9 \times 10) + 12 = 10000 + 7000 + 900 + 12 = \mathbf{17912}$$

---

## 🛠️ 3. Protocolo para Publicar una Nueva Versión (Release Checklist)

Cuando se implemente una nueva versión, sigue este orden estricto de pasos:

1. **Actualizar el identificador global:**
   Modifica `APP_INFO.version` en `src/shared/constants/appInfo.ts`.
2. **Actualizar el paquete de Android:**
   Modifica `versionCode` y `versionName` en `android/app/build.gradle`.
3. **Actualizar el paquete de Windows Desktop:**
   Modifica `version` (3 números) y `build.nsis.artifactName` en `package.json`.
4. **Verificar compilación limpia de la Web:**
   Ejecuta `npm run build`.
5. **Generar los binarios de producción:**
   - **Windows:** `npm run electron:build` -> Verifica el instalador en `release/`.
   - **Android:** `npx cap sync android` y luego `.\android\gradlew.bat assembleDebug -p android`.
6. **Registrar en el CHANGELOG:**
   Añade la sección correspondiente en `CHANGELOG.md` siguiendo el estándar de Conventional Commits.
7. **Crear el commit y tag de Git:**
   ```bash
   git add -A
   git commit -m "chore(release): bump version to v1.7.9.13"
   git tag -a v1.7.9.13 -m "Release v1.7.9.13"
   ```

---

## 📊 4. Etapas Históricas del Proyecto

* **Fase 1: Fundación y Persistencia Offline (v1.0.0 – v1.5.5):**
  Arquitectura Feature-First, Dexie.js (IndexedDB), esquemas relacionales de asignaturas, docentes y bloques de horario, editor TipTap inicial y PWA manifest.
* **Fase 2: Ergonomía Móvil y Rendimiento (v1.6.0 – v1.6.9):**
  Prevención de sobrecalentamiento por gestión de memoria gráfica, SAF en Android para respaldos, pantallas dedicadas full-screen y navegación agrupada inspirada en Telegram.
* **Fase 3: Material Design 3, Documentos y Desktop (v1.7.0 – v1.7.9.12):**
  Adopción de Google Material Web (M3), motor de paletas dinámicas Material You, módulo de Archivos y Documentos vinculados, soporte para pantallas 1366x768 y versión nativa de escritorio para Windows con Electron.
