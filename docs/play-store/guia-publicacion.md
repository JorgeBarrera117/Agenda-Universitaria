# Publicar Agenda Universitaria en Google Play

Guía para el día en que se decida subir la app a Google Play. El proyecto ya está preparado; aquí
está el orden de los pasos y lo que solo puede hacer el dueño de la cuenta.

## Qué ya está listo en el proyecto

| Pieza | Dónde | Qué hace |
|---|---|---|
| Dos versiones de Android | `android/app/build.gradle` (`productFlavors`) | **github**: el APK de GitHub Releases, como siempre. **play**: para Google Play. |
| Actualizador según la versión | `android/app/src/github/…/AppUpdater.java` y `android/app/src/play/…/AppUpdater.java` | La de GitHub descarga e instala el APK; la de Play no incluye ese código (Google no permite que una app se actualice por fuera de la tienda). |
| Permiso para instalar paquetes | `android/app/src/play/AndroidManifest.xml` | La versión de Play quita `REQUEST_INSTALL_PACKAGES`. Gradle detiene la compilación si vuelve a aparecer. |
| Firma de publicación | `android/app/build.gradle` + `android/keystore.properties` (no se sube a GitHub) | Sin ese archivo todo sigue igual; con él, la versión de Play se firma con tu llave. |
| Avisos de actualización | `src/shared/services/updateService.ts` | En la versión de Play no se busca el APK: Ajustes muestra «Abrir en Google Play». |
| Política de privacidad | `public/privacidad.html` | Se publica en `https://jorgebarrera117.github.io/Agenda-Universitaria/privacidad.html`. |
| Textos de la ficha | `docs/play-store/ficha-tienda.md` | Descripciones y respuestas a los formularios de la Consola. |

Todo lo demás (pantallas, funciones, la web) es el mismo código para las dos versiones: cada cambio
del proyecto llega a ambas al compilar.

## 1. Crear la llave de publicación (una sola vez)

La llave firma cada versión que subes. **Si se pierde, no puedes volver a publicar actualizaciones**
de la app con ese nombre (Google permite pedir un cambio de llave, pero es un trámite largo).

1. Abre una terminal (PowerShell) y ejecuta, cambiando la ruta si quieres guardarla en otro sitio:

   ```powershell
   & "C:\Program Files\Java\jdk-24\bin\keytool.exe" -genkeypair -v -keystore "$env:USERPROFILE\agenda-upload.jks" -alias agenda-upload -keyalg RSA -keysize 2048 -validity 10000
   ```

   Te pedirá una contraseña y unos datos (nombre, ciudad, país). Anota la contraseña.

2. Guarda **una copia del archivo `agenda-upload.jks` y de la contraseña** fuera de la computadora
   (USB y una nube personal). Nunca la subas a GitHub ni la compartas.

3. Crea el archivo `android/keystore.properties` (ya está en `.gitignore`) con:

   ```properties
   storeFile=C:/Users/TU_USUARIO/agenda-upload.jks
   storePassword=LA_CONTRASEÑA
   keyAlias=agenda-upload
   keyPassword=LA_CONTRASEÑA
   ```

   Usa `/` en la ruta. Sin este archivo, la compilación de Play se detiene con un aviso.

## 2. Compilar el paquete para Google Play (AAB)

```powershell
npm run android:play
```

Genera `android/app/build/outputs/bundle/playRelease/app-play-release.aab`, firmado con tu llave.
Es el archivo que se sube a la Consola (Google Play ya no acepta APK para apps nuevas).

## 3. Cuenta de Google Play Console

1. Crea la cuenta en https://play.google.com/console (pago único de US$25 y verificación de identidad
   con un documento oficial).
2. Al crear la app: nombre «Agenda Universitaria», idioma español, tipo **App**, **Gratis**.
3. Activa **Play App Signing** (Google guarda la llave final; la tuya queda como llave de subida).

## 4. Prueba cerrada (obligatoria para cuentas personales nuevas)

- Al menos **12 testers** con la app instalada durante **14 días seguidos**.
- En la Consola: *Pruebas → Prueba cerrada → Crear versión*, sube el AAB y agrega los correos de los
  testers (o un Grupo de Google). Ellos aceptan la invitación con el enlace y la instalan desde Play.
- No pauses la prueba: reinicia el conteo.
- Después de los 14 días, *Panel → Solicitar acceso a producción* y responde el cuestionario.

## 5. Ficha y formularios

Copia los textos de `docs/play-store/ficha-tienda.md`:

- Ficha principal: descripciones, icono 512×512, imagen destacada 1024×500, capturas (mínimo 2).
- Política de privacidad: la URL de `privacidad.html`.
- Seguridad de los datos, clasificación de contenido, público objetivo (18+), anuncios (no tiene).
- Permiso de **alarmas exactas**: la app es un calendario de clases y los recordatorios deben sonar a
  la hora (ver la respuesta preparada en la ficha).

## 6. Avisar a quienes usan la versión de GitHub

La versión de Play se firma con otra llave, así que Android no deja instalarla encima de la de GitHub.
Antes de cambiarse, cada usuario debe:

1. En la agenda: **Ajustes → Datos y copias de seguridad → Exportar** (guardar el archivo).
2. Desinstalar la versión de GitHub e instalar la de Play.
3. **Importar** la copia de seguridad.

## 7. Publicar actualizaciones en Play

1. Hacer los cambios y subir la versión como siempre (`versionCode` y `versionName` en
   `android/app/build.gradle`; el `versionCode` debe subir en cada envío).
2. `npm run android:play`.
3. Consola → *Producción → Crear versión* → subir el AAB → notas de la versión (las del changelog).
4. Revisión de Google (la primera puede tardar días; después, normalmente horas).
5. Opcional: lanzamiento gradual (por ejemplo 20 % → 100 %).
6. Google Play actualiza la app sola en los teléfonos.

La versión de GitHub (APK), Windows y la web siguen publicándose como hasta ahora.

## Mantenimiento: qué revisar cuando cambie el proyecto

La versión de Play se mantiene sola, salvo en estos casos:

- **Un permiso nuevo en Android** (por ejemplo, ubicación o contactos): agrégalo a
  `privacidad.html` y a la sección «Seguridad de los datos» de `ficha-tienda.md`.
- **La app empieza a enviar datos fuera del teléfono** (una cuenta, sincronización en la nube,
  analítica): hay que actualizar la política y el formulario de seguridad de datos **antes** de
  publicar en Play.
- **Google sube el nivel de API obligatorio** (cada agosto): subir `targetSdkVersion` en
  `android/variables.gradle`.
- **Un plugin nuevo de Capacitor que pida instalar paquetes**: la compilación de Play se detendrá
  sola; hay que quitarlo de la versión de Play.
