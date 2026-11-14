import { compareVersions } from '../utils/version';
import { APP_INFO } from './appInfo';

/**
 * Historial de cambios ("Novedades") que viaja dentro de la app: se consulta sin internet desde
 * Ajustes → Acerca de la agenda y alimenta el aviso "Lo nuevo" tras actualizar.
 *
 * Al publicar una versión, su entrada se agrega AQUÍ primero (la más nueva arriba); de ella salen
 * también los "highlights" de public/version.json y las notas de la Release en GitHub.
 */
export type ChangeKind = 'nuevo' | 'mejora' | 'correccion';

export interface ChangeItem {
  kind: ChangeKind;
  text: string;
}

export interface ChangelogEntry {
  version: string;
  /** Fecha de publicación (YYYY-MM-DD). */
  date: string;
  /** Tema de la versión en pocas palabras. */
  title: string;
  changes: ChangeItem[];
}

export const CHANGE_KIND_LABELS: Record<ChangeKind, string> = {
  nuevo: 'Nuevo',
  mejora: 'Mejora',
  correccion: 'Corrección',
};

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    version: '1.7.10.64',
    date: '2026-11-14',
    title: 'Barra de apuntes más práctica',
    changes: [
      { kind: 'mejora', text: 'Cámara, galería y micrófono quedan siempre a la vista en la barra del editor; el formato se ordena por uso (negrita, cursiva y listas primero).' },
      { kind: 'correccion', text: 'Los avisos como «Nota de voz guardada en el apunte» ya se ocultan solos y no tapan la barra.' },
    ],
  },
  {
    version: '1.7.10.63',
    date: '2026-11-13',
    title: 'Notas de voz en tus apuntes',
    changes: [
      { kind: 'nuevo', text: 'Graba notas de voz dentro de un apunte: desde el menú ⋮ del apunte o con el micrófono de la barra del editor. Puedes pausar, escucharla y ponerle nombre antes de guardarla.' },
      { kind: 'nuevo', text: 'Cada grabación tiene su reproductor para escucharla, adelantar, cambiarle el nombre o eliminarla.' },
      { kind: 'mejora', text: 'Las notas de voz se incluyen en las copias de seguridad y al compartir un apunte.' },
      { kind: 'correccion', text: 'Al borrar una materia también se borran las fotos y grabaciones de sus apuntes, que antes quedaban ocupando espacio.' },
    ],
  },
  {
    version: '1.7.10.62',
    date: '2026-11-13',
    title: 'Ventanas más cómodas en celular y PC',
    changes: [
      { kind: 'mejora', text: 'En el celular, las ventanas emergentes salen desde abajo, a todo el ancho; en la computadora siguen centradas.' },
      { kind: 'mejora', text: 'Los botones «Cancelar», «Guardar» o «Siguiente» quedan siempre a la vista, aunque el contenido sea largo.' },
      { kind: 'correccion', text: 'Las listas para elegir (materia, orden…) ya no salen cortadas dentro de las ventanas. En el celular se abren desde abajo con opciones grandes.' },
    ],
  },
  {
    version: '1.7.10.61',
    date: '2026-11-13',
    title: 'Instalador de Windows con opciones',
    changes: [
      { kind: 'nuevo', text: 'El instalador de Windows te deja elegir para quién y en qué carpeta instalar, y al terminar puedes abrir la agenda o solo finalizar.' },
      { kind: 'correccion', text: 'Las actualizaciones de Windows esperan a que el sistema libere los archivos en vez de pedir «Reintentar».' },
      { kind: 'mejora', text: 'La versión de Windows pesa menos y se instala más rápido.' },
    ],
  },
  {
    version: '1.7.10.60',
    date: '2026-11-13',
    title: 'Instalación sin errores en Windows',
    changes: [
      { kind: 'correccion', text: 'El instalador de Windows ya no muestra «No se puede cerrar Agenda Universitaria»: cierra la agenda, espera a que termine y la vuelve a abrir al instalar.' },
      { kind: 'mejora', text: 'En «Aplicaciones instaladas» de Windows la agenda aparece con su nombre y su versión real.' },
    ],
  },
  {
    version: '1.7.10.59',
    date: '2026-11-13',
    title: 'Instalador y actualizaciones para Windows',
    changes: [
      { kind: 'nuevo', text: 'Instalador para Windows: crea accesos en el escritorio y en el menú Inicio, y se abre más rápido que la versión portable.' },
      { kind: 'nuevo', text: 'En Windows, las actualizaciones se descargan e instalan desde la app, como en Android: la agenda se cierra y vuelve a abrirse ya actualizada.' },
    ],
  },
  {
    version: '1.7.10.58',
    date: '2026-11-13',
    title: 'Guarda sin salir del apunte',
    changes: [
      { kind: 'mejora', text: '«Guardar» ya no cierra el apunte: guarda y puedes seguir escribiendo. Para salir, usa la flecha «Volver».' },
      { kind: 'mejora', text: 'La cabecera del apunte muestra «Guardado a las HH:mm ✓» después de cada guardado.' },
      { kind: 'nuevo', text: 'Si sales con cambios sin guardar, ahora puedes elegir «Guardar y salir».' },
      { kind: 'nuevo', text: 'Versión portable para Windows: avisa de tus clases aunque cierres la ventana y pide permiso para enviar notificaciones.' },
    ],
  },
  {
    version: '1.7.10.57',
    date: '2026-11-12',
    title: 'Selector de color propio',
    changes: [
      { kind: 'mejora', text: 'El gotero de «Crea tu paleta» abre el selector de color de la app en vez del de Android.' },
      { kind: 'nuevo', text: 'El selector tiene un cuadro de intensidad y brillo para llegar a cualquier color, además del matiz, tonos sugeridos y el código HEX.' },
      { kind: 'mejora', text: 'El color de las materias usa el mismo selector mejorado.' },
    ],
  },
  {
    version: '1.7.10.56',
    date: '2026-11-12',
    title: 'Tu paleta, a tu manera',
    changes: [
      { kind: 'nuevo', text: '«Crea tu paleta» ahora tiene tres colores: Principal, Acento y Fondo. El fondo puede ser neutro, suave o marcado, y tomar el tono que quieras.' },
      { kind: 'nuevo', text: 'Cinco estilos para tu paleta: Equilibrado, Vibrante, Expresivo, Fiel y Monocromo.' },
      { kind: 'mejora', text: 'El color de acento se ve en el botón flotante, la pestaña activa y las etiquetas. El texto siempre queda legible, combines los colores que combines.' },
    ],
  },
  {
    version: '1.7.10.55',
    date: '2026-11-12',
    title: 'Apariencia más ordenada',
    changes: [
      { kind: 'mejora', text: 'Apariencia y tema está dividida en tres bloques: Color, Fondo y Tarjetas y rendimiento.' },
      { kind: 'mejora', text: 'Las paletas se muestran como círculos de color; el «+» al final abre «Crea tu paleta».' },
      { kind: 'mejora', text: 'Los controles finos del papel tapiz (intensidad, escala y desenfoque) quedan dentro de «Ajustar fondo».' },
    ],
  },
  {
    version: '1.7.10.54',
    date: '2026-11-12',
    title: 'Más colores y tu propia paleta',
    changes: [
      { kind: 'nuevo', text: '10 paletas nuevas en Ajustes → Apariencia y tema: Coral Tropical, Mostaza Retro, Lima Neón, Menta Fresca, Cielo Glaciar, Índigo Nocturno, Orquídea, Mocha Café, Arena del Desierto y Piedra Cálida.' },
      { kind: 'nuevo', text: '«Crea tu paleta»: elige cualquier color, mira cómo queda en claro y oscuro, y la app calcula el resto. Aparece como «Tu paleta» y también colorea el widget.' },
      { kind: 'mejora', text: 'La barra superior, el selector Semana/Día y la lista de Profesores ahora siguen los colores de la paleta elegida.' },
    ],
  },
  {
    version: '1.7.10.53',
    date: '2026-11-12',
    title: 'Novedades dentro de la app',
    changes: [
      { kind: 'nuevo', text: 'Consulta lo que trajo cada versión en Ajustes → Acerca de la agenda → Novedades de la versión, también sin internet.' },
      { kind: 'nuevo', text: 'Después de actualizar, un aviso «Lo nuevo» te cuenta qué cambió. Aparece una sola vez por versión.' },
    ],
  },
  {
    version: '1.7.10.52',
    date: '2026-11-12',
    title: 'Fin de semestre e historial de materias',
    changes: [
      { kind: 'nuevo', text: 'Finaliza el semestre desde Ajustes → Semestre y horario: guarda un respaldo, pon el nombre del nuevo semestre y elige si limpiar el horario y archivar las materias.' },
      { kind: 'nuevo', text: 'Materias tiene dos pestañas, «En curso» e «Historial». Las archivadas muestran su semestre y conservan apuntes y archivos.' },
      { kind: 'mejora', text: '¿Archivaste algo por error? Menú ⋮ → «Mover a en curso».' },
      { kind: 'mejora', text: 'Al programar una clase nueva solo aparecen las materias en curso.' },
    ],
  },
  {
    version: '1.7.10.51',
    date: '2026-11-12',
    title: 'Encabezados más limpios',
    changes: [
      { kind: 'correccion', text: 'Los encabezados fijos ya no muestran un fondo cuadrado al hacer scroll: solo la cápsula redondeada, flotando.' },
    ],
  },
  {
    version: '1.7.10.50',
    date: '2026-11-12',
    title: 'Íconos de tus materias',
    changes: [
      { kind: 'correccion', text: 'Cada materia muestra su ícono personalizado al leer un apunte, en Profesores, en la ficha del catedrático y al elegir sus materias.' },
    ],
  },
  {
    version: '1.7.10.49',
    date: '2026-11-12',
    title: 'Fichas con animación',
    changes: [
      { kind: 'mejora', text: 'Las fichas de materia y de catedrático se cierran con una animación suave, también con el botón atrás del teléfono.' },
    ],
  },
  {
    version: '1.7.10.48',
    date: '2026-11-12',
    title: 'Fichas de materias y catedráticos',
    changes: [
      { kind: 'nuevo', text: 'Toca una materia (o una clase en el Horario) para ver su ficha: horario semanal, catedrático y accesos a apuntes y archivos.' },
      { kind: 'nuevo', text: 'Toca un catedrático para llamar, escribir o compartir su contacto y ver su cubículo, asesorías y materias.' },
      { kind: 'mejora', text: 'Las fichas se enlazan entre sí y el botón atrás te devuelve paso a paso a donde estabas.' },
    ],
  },
  {
    version: '1.7.10.47',
    date: '2026-11-12',
    title: 'Encabezados fijos',
    changes: [
      { kind: 'mejora', text: 'Los encabezados de Ajustes, formularios, apuntes y fichas se quedan arriba al hacer scroll, con sus acciones siempre a mano.' },
      { kind: 'mejora', text: 'En el editor de apuntes, en teléfonos angostos «Guardar» se muestra como ✓ para que el título se lea mejor.' },
    ],
  },
  {
    version: '1.7.10.46',
    date: '2026-11-12',
    title: 'Buscador renovado',
    changes: [
      { kind: 'correccion', text: 'Ya no aparece una franja oscura detrás del buscador al volver desde otra pestaña.' },
      { kind: 'mejora', text: 'El buscador es igual en Profesores, Apuntes y Archivos: más alto, fácil de tocar y con textos que no se cortan.' },
    ],
  },
  {
    version: '1.7.10.45',
    date: '2026-11-12',
    title: 'Buscador siempre a mano',
    changes: [
      { kind: 'nuevo', text: 'En Profesores, Apuntes y Archivos el buscador se queda fijo arriba al hacer scroll. En Archivos, el orden también.' },
    ],
  },
  {
    version: '1.7.10.44',
    date: '2026-11-12',
    title: 'Tarjetas más claras',
    changes: [
      { kind: 'mejora', text: 'En Materias, Horario y Profesores el nombre de la materia y del catedrático van primero; código, aula y créditos pasan a chips discretos.' },
      { kind: 'mejora', text: 'En Profesores, el cubículo y las asesorías se leen completos.' },
    ],
  },
  {
    version: '1.7.10.43',
    date: '2026-11-12',
    title: 'Comparte materias y tu horario',
    changes: [
      { kind: 'nuevo', text: 'Comparte una materia con su horario y catedrático (.agclass) desde su menú ⋮.' },
      { kind: 'nuevo', text: 'Comparte tu horario completo (.agschedule) desde el menú ⋮ del Horario.' },
      { kind: 'nuevo', text: 'Al abrirlos ves qué se agrega, qué ya tenías y qué choca con tu horario, y eliges fusionar o reemplazar.' },
    ],
  },
  {
    version: '1.7.10.42',
    date: '2026-11-11',
    title: 'Comparte catedráticos',
    changes: [
      { kind: 'nuevo', text: 'Comparte un catedrático como archivo .agcontact: quien lo recibe lo abre directo en su agenda.' },
      { kind: 'nuevo', text: 'Botón «Importar (.agcontact)» en Profesores.' },
      { kind: 'correccion', text: 'Al asignar una materia a otro catedrático ya no queda repetida en el anterior.' },
    ],
  },
  {
    version: '1.7.10.41',
    date: '2026-11-11',
    title: 'Actualiza desde la app',
    changes: [
      { kind: 'nuevo', text: 'Descarga e instala las actualizaciones sin salir de la app, con barra de progreso y verificación de autenticidad.' },
    ],
  },
  {
    version: '1.7.10.40',
    date: '2026-11-11',
    title: 'Comparte archivos y contactos',
    changes: [
      { kind: 'nuevo', text: 'Comparte cualquier archivo de tus materias (PDF, Word, imágenes…) con su contenido real.' },
      { kind: 'nuevo', text: 'Comparte el contacto de un catedrático listo para WhatsApp.' },
      { kind: 'mejora', text: 'Las actualizaciones viven ahora en Ajustes → Acerca de la agenda.' },
    ],
  },
  {
    version: '1.7.10.39',
    date: '2026-11-11',
    title: 'Comparte apuntes',
    changes: [
      { kind: 'nuevo', text: 'Comparte e importa apuntes (.agnote) por WhatsApp, Telegram o Drive.' },
      { kind: 'nuevo', text: 'Copia fotos de tus apuntes a otras apps y pega imágenes dentro del apunte.' },
      { kind: 'nuevo', text: '20 tonos de notificación, modo Ultra Fluidez y perfil estudiantil con foto.' },
      { kind: 'correccion', text: 'El respaldo enviado por WhatsApp ya no llega vacío.' },
    ],
  },
  {
    version: '1.7.9.12',
    date: '2026-10-22',
    title: 'Versión para Windows',
    changes: [
      { kind: 'nuevo', text: 'Instalador para Windows (PC) y apertura de documentos en sus programas predeterminados.' },
      { kind: 'mejora', text: 'Horario semanal adaptado a pantallas de laptop y escritorio.' },
    ],
  },
];

/** Entradas hasta la versión dada (las posteriores aún no están instaladas), de la más nueva a la más vieja. */
export function changelogUpTo(version: string = APP_INFO.version): ChangelogEntry[] {
  return CHANGELOG.filter((entry) => compareVersions(entry.version, version) <= 0);
}

/** Entradas posteriores a `since` y hasta la versión instalada (lo nuevo desde la última vez). */
export function changelogSince(since: string, version: string = APP_INFO.version): ChangelogEntry[] {
  return changelogUpTo(version).filter((entry) => compareVersions(entry.version, since) > 0);
}
