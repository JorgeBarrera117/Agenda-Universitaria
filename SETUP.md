# 🛠️ Guía Integral de Configuración del Entorno de Desarrollo (Setup & Onboarding)

Esta guía documenta paso a paso los requisitos y procedimientos para clonar, ejecutar, depurar y compilar **Agenda Universitaria** desde cero en cualquier máquina de desarrollo (**Windows**, **macOS** o **Linux**).

---

## 📋 1. Prerrequisitos del Sistema

Antes de iniciar, asegúrate de tener instalados los siguientes componentes:

| Componente | Versión Recomendada | Propósito | Enlace de Descarga |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 20.x` (ó LTS `22.x` / `24.x`) | Runtime JavaScript para Vite, dependencias y tooling | [nodejs.org](https://nodejs.org/) |
| **Git** | `>= 2.40` | Control de versiones | [git-scm.com](https://git-scm.com/) |
| **Java JDK** | `JDK 21` ó `JDK 24` | Compilación de Android APK mediante Gradle | [adoptium.net](https://adoptium.net/) / Oracle |
| **Android Studio** | Versión reciente (Ladybug / Koala) | SDK de Android, Emuladores y Build Tools | [developer.android.com/studio](https://developer.android.com/studio) |

> [!IMPORTANT]
> **Variable de Entorno `JAVA_HOME` (Crítica para compilar Android):**
> Gradle requiere que `JAVA_HOME` apunte al directorio raíz del JDK.
> - **En Windows (PowerShell):**
>   ```powershell
>   $env:JAVA_HOME = "C:\Program Files\Java\jdk-24" # O tu ruta instalada
>   [System.Environment]::SetEnvironmentVariable('JAVA_HOME', 'C:\Program Files\Java\jdk-24', 'User')
>   ```
> - **En macOS / Linux (bash/zsh):**
>   ```bash
>   export JAVA_HOME=$(/usr/libexec/java_home -v 21) # macOS
>   # o export JAVA_HOME=/usr/lib/jvm/java-21-openjdk # Linux
>   ```

---

## 🚀 2. Clonado e Instalación de Dependencias

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/TU_USUARIO/Agenda-Universitaria.git
   cd "Agenda-Universitaria"
   ```

2. **Instalar paquetes de Node.js:**
   ```bash
   npm install
   ```
   *(Si deseas una instalación limpia y reproducible exactamente idéntica al `package-lock.json`, usa `npm ci`).*

---

## 💻 3. Ejecución en Modo Desarrollo

### A. Entorno Web PWA (Navegador)
Inicia el servidor de desarrollo ultrarrápido de Vite:
```bash
npm run dev
```
- La app estará accesible en `http://localhost:5173`.
- Soporta Hot Module Replacement (HMR) instantáneo.
- Para probar cómo se ve en móviles, presiona `F12` y activa la vista de emulación de dispositivos (ej. Galaxy S20, iPhone 14, resolución 1366x768).

### B. Entorno Desktop (Windows Electron)
Inicia simultáneamente Vite y el proceso principal de Electron con recarga en caliente:
```bash
npm run electron:dev
```
- Abrirá una ventana nativa de Electron conectada al servidor local `http://localhost:5173`.
- Las DevTools de Chromium se abrirán automáticamente en una ventana desacoplada para depuración.

### C. Entorno Móvil (Android con Capacitor)
1. Construye los activos web:
   ```bash
   npm run build
   ```
2. Sincroniza los cambios con el proyecto Android:
   ```bash
   npx cap sync android
   ```
3. Abre el proyecto en Android Studio:
   ```bash
   npx cap open android
   ```
   *Desde Android Studio puedes presionar el botón verde `Run` para desplegar en tu teléfono físico (con Depuración USB activada) o en el emulador oficial.*

---

## 📦 4. Compilación de Paquetes de Producción

### A. Aplicación Web PWA (para hosting estático / GitHub Pages)
```bash
npm run build
```
- Genera el directorio optimizado `dist/` con minificación de assets, hashing y precacheo de Service Workers (`sw.js`).
- Puedes previsualizar el bundle de producción localmente ejecutando `npm run preview`.

### B. Instalador ejecutable de Windows (.exe)
```bash
npm run electron:build
```
- Compila los activos web y empaqueta la aplicación con **electron-builder**.
- Genera el instalador NSIS en `release/Agenda Universitaria-Setup-v1.7.9.12.exe`.
- El instalador incluye macros en `electron/installer.nsh` que terminan automáticamente cualquier proceso residual para evitar bloqueos del instalador.

### C. Paquete Android APK (.apk)
Desde la raíz del proyecto, ejecuta el compilador Gradle:
- **En Windows (PowerShell):**
  ```powershell
  npx cap sync android
  $env:JAVA_HOME = "C:\Program Files\Java\jdk-24"
  .\android\gradlew.bat assembleDebug -p android
  ```
- **En macOS / Linux:**
  ```bash
  npx cap sync android
  ./android/gradlew assembleDebug -p android
  ```
- El archivo `.apk` compilado se genera en:
  `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📂 5. Estructura Arquitectónica del Código Fuente

El proyecto sigue una arquitectura **Clean Architecture & Feature-First**:

```
Agenda-Universitaria/
├── .github/                 # Workflows de CI/CD (GitHub Pages y validación de PRs)
├── android/                 # Proyecto nativo Android (Capacitor Bridge & Java Plugins)
│   ├── app/src/main/java/   # Código nativo (WidgetBridgePlugin, MainActivity)
│   └── app/build.gradle     # Versiones Android (versionCode, versionName)
├── electron/                # Proceso principal de Electron para Windows
│   ├── main.cjs             # Lifecycle de ventana, IPC handlers y gestión de archivos
│   ├── preload.cjs          # Puente seguro contextBridge hacia el renderizador
│   └── installer.nsh        # Macros personalizadas de NSIS (prevención de bloqueos)
├── public/                  # Íconos vectoriales SVG, favicons y manifest PWA
├── src/
│   ├── features/            # Módulos organizados por dominio de negocio (Feature-First)
│   │   ├── schedule/        # Horario semanal/diario, slots y live state
│   │   ├── subjects/        # Materias, colores curriculares y documentos vinculados
│   │   ├── professors/      # Directorio de docentes, cubículos y asesorías
│   │   ├── notes/           # Cuaderno de apuntes, editor TipTap y visor Lightbox
│   │   ├── documents/       # Centro de documentos, PDFs y enlaces externos
│   │   └── settings/        # Preferencias de estudio, motor de temas y respaldos
│   ├── shared/              # Componentes atómicos, hooks globales y base de datos
│   │   ├── components/      # ErrorBoundary, M3Select, Navbar, BottomNav, Modales
│   │   ├── constants/       # appInfo.ts (versión global)
│   │   ├── db/              # AppDatabase.ts (Esquema Dexie.js / IndexedDB)
│   │   ├── hooks/           # useBackButton, useSwipeNavigation, useScrollCollapse
│   │   └── services/        # Notificaciones locales, sincronización de widgets
│   ├── App.tsx              # Componente raíz con Tab Retention (Keep-Alive)
│   ├── main.tsx             # Punto de entrada React 19 con ErrorBoundary
│   └── electron.d.ts        # Tipado TypeScript estricto de APIs de Electron
├── package.json             # Scripts, dependencias y configuración de electron-builder
├── vite.config.ts           # Configuración de Vite y plugin VitePWA
├── SETUP.md                 # Esta guía de desarrollo
├── VERSIONING.md            # Política y matriz de versiones multiplataforma
├── CHANGELOG.md             # Historial completo de versiones
└── README.md                # Presentación principal del proyecto
```

---

## 🩺 6. Solución de Problemas Frecuentes (Troubleshooting)

### Error: `JAVA_HOME is not set and no 'java' command could be found`
- **Causa:** Gradle no localiza la instalación del JDK.
- **Solución:** Verifica que el JDK esté instalado y define la variable en tu terminal antes de compilar:
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Java\jdk-24" # Ajusta según tu versión
  ```

### Error: `Rendered fewer hooks than expected`
- **Causa:** Violación de las *Rules of Hooks* de React (colocar un `return` condicional antes de hooks como `useState` o `useEffect`).
- **Solución:** Declara **todos** los hooks incondicionalmente en la cima de la función componente antes de cualquier bifurcación de retorno.

### Error en Electron: `Invalid version: "1.7.9.12"`
- **Causa:** `electron-builder` exige formato semver estricto de 3 componentes (`x.y.z`).
- **Solución:** Mantén `"version": "1.7.12"` en `package.json` y usa `"artifactName": "${productName}-Setup-v1.7.9.12.${ext}"` dentro de `build.nsis`.

### Error: `No se puede cerrar Agenda Universitaria` en la instalación
- **Causa:** Un proceso anterior sigue retenido por Windows.
- **Solución:** El archivo `electron/installer.nsh` ejecuta `taskkill /f /im "Agenda Universitaria.exe"` automáticamente al iniciar el instalador.
