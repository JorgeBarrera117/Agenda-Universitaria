# Ficha de Google Play: textos y respuestas

Todo lo que pide Play Console para Agenda Universitaria, listo para copiar. Si la app cambia
(permisos, datos que salen del teléfono), revisa la sección «Seguridad de los datos».

## Datos básicos

- **Nombre de la app** (máx. 30): `Agenda Universitaria`
- **Categoría:** Educación
- **Etiquetas sugeridas:** Productividad, Estudios, Calendario
- **Correo de contacto:** el de tu cuenta de desarrollador
- **Sitio web:** https://jorgebarrera117.github.io/Agenda-Universitaria/
- **Política de privacidad:** https://jorgebarrera117.github.io/Agenda-Universitaria/privacidad.html
- **Precio:** Gratis · **Anuncios:** No contiene anuncios · **Compras dentro de la app:** No

## Descripción breve (máx. 80 caracteres)

```
Horario, materias, docentes y apuntes de tu universidad, sin internet y privado.
```

## Descripción completa (máx. 4000 caracteres)

```
Agenda Universitaria es la app para organizar tu vida en la universidad: tu horario de clases, tus materias, tus docentes y tus apuntes, todo en un solo lugar y sin necesidad de internet.

HORARIO SEMANAL
• Arma tu horario en segundos: crea una clase para varios días a la vez, con el mismo horario o uno distinto para cada día.
• Mira la semana completa o el día de hoy, con la clase en curso y la próxima.
• Recordatorios antes de cada clase.

MATERIAS Y DOCENTES
• Ficha de cada materia con su código, créditos, aula, horario, apuntes y archivos.
• Contactos de tus docentes con su oficina, correo y horario de atención.
• Elige un ícono y un color para cada materia.

APUNTES COMPLETOS
• Editor con títulos, listas, tareas, resaltador y citas.
• Fotos del pizarrón dentro del texto: recórtalas, gíralas, dibuja o escribe encima, cámbiales el tamaño y ponlas al lado del texto.
• Notas de voz dentro del apunte, justo donde las necesitas.
• Apuntes personales que no son de ninguna materia.
• Comparte un apunte con un compañero en un solo archivo.

PRIVADA Y SIN CONEXIÓN
• Todo se guarda solo en tu teléfono: sin cuentas, sin publicidad y sin rastreo.
• Funciona completa sin internet.
• Exporta tu copia de seguridad cuando quieras.

A TU ESTILO
• Temas de color, modo oscuro y fondos personalizados.
• Widgets para ver tu horario desde la pantalla de inicio.

Hecha por y para estudiantes. «Todo lo puedo en Cristo que me fortalece» (Filipenses 4:13).
```

## Material gráfico

- **Ícono:** 512 × 512 px, PNG de 32 bits (a partir de `public/pwa-512x512.png`).
- **Imagen destacada:** 1024 × 500 px, JPG o PNG sin transparencia.
- **Capturas de teléfono:** mínimo 2 (recomendado 4 a 8), entre 320 y 3840 px, proporción 16:9 o 9:16.
  Sugeridas: horario semanal, ficha de una materia, apunte con foto y nota de voz, ajustes de tema.

## Seguridad de los datos (Data safety)

- **¿La app recopila o comparte alguno de los tipos de datos de usuario obligatorios?** No.
  - Motivo: todo se guarda en el dispositivo y no se envía a ningún servidor. Google considera
    «recopilación» solo los datos que salen del dispositivo.
- **¿Los datos se cifran en tránsito?** No aplica (no se transmiten datos del usuario).
- **¿Los usuarios pueden pedir que se borren sus datos?** Sí: pueden borrarlos en la app o
  desinstalándola.
- **Nota para el micrófono y las fotos:** se usan solo en el dispositivo (notas de voz, fotos de
  apuntes) y no se suben a ningún lado.

> Si algún día la app envía datos fuera del teléfono (cuenta, nube, analítica), este formulario y la
> política de privacidad deben cambiar antes de publicar.

## Clasificación de contenido (cuestionario IARC)

- Categoría: **Referencia, noticias o educación** (Utilidad / Productividad).
- Violencia, sexo, lenguaje, drogas, apuestas: **No**.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **No** (compartir un archivo por
  WhatsApp lo hace el usuario fuera de la app; no hay chat ni contenido público).
- ¿Comparte la ubicación del usuario? **No**.
- Resultado esperado: apto para todo público.

## Público objetivo

- Edad: **18 años o más** (estudiantes universitarios). No dirigida a niños: así no aplican las
  reglas de la política «Familias».

## Acceso a la app

- **Toda la funcionalidad está disponible sin restricciones** (no hay inicio de sesión).

## Permiso de alarmas exactas (SCHEDULE_EXACT_ALARM)

Respuesta sugerida si la Consola lo pregunta:

```
Agenda Universitaria es un calendario de clases. Los recordatorios avisan unos minutos antes de cada clase programada por el estudiante y deben sonar a la hora exacta: un aviso retrasado haría que llegue tarde a clase. El usuario puede desactivar los recordatorios en Ajustes.
```

## Permiso de micrófono (RECORD_AUDIO)

```
Se usa solo cuando el estudiante graba una nota de voz dentro de un apunte. El audio se guarda en el dispositivo y no se envía a ningún servidor.
```
