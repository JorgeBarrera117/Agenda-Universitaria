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
    version: '1.7.11.4.1',
    date: '2026-11-23',
    title: 'Sala de Intercambio Local (prueba)',
    changes: [
      { kind: 'nuevo', text: 'Sala Local: comparte con compañeros cercanos por wifi o con el punto de acceso de un teléfono, sin internet. Se entra con un código QR o con la dirección y el PIN.' },
      { kind: 'nuevo', text: 'En la sala se comparten horarios, materias, contactos docentes, apuntes y archivos de la Biblioteca, con un mensaje opcional.' },
      { kind: 'nuevo', text: 'Guardar en mi agenda: lo que recibes se guarda sin duplicados (puedes combinar, actualizar o guardar como nuevo).' },
      { kind: 'nuevo', text: 'El anfitrión decide: sala de espera, bloquear la entrada, solo lectura, permitir texto, retirar a alguien y cerrar la sala para todos.' },
      { kind: 'mejora', text: 'Pasar datos con otro dispositivo ahora abre la Sala Local, donde también está la copia completa.' },
    ],
  },
  {
    version: '1.7.11.4',
    date: '2026-11-22',
    title: 'La app se ve mejor en la PC',
    changes: [
      { kind: 'mejora', text: 'En la PC las pantallas ya no se estiran: Ajustes, Estudio, Materias, Biblioteca y el editor de apuntes usan un ancho cómodo.' },
      { kind: 'mejora', text: 'Horario en la PC: Próximos en tu agenda va junto al resumen del día.' },
      { kind: 'nuevo', text: 'En la PC también flotan, al bajar, los selectores Materias | Profesores y Apuntes | Archivos y el botón Compartir del Horario.' },
      { kind: 'correccion', text: 'Los botones flotantes ya no desaparecen al desplazarse.' },
      { kind: 'correccion', text: 'En la PC el botón de agregar queda alineado con los demás botones flotantes.' },
    ],
  },
  {
    version: '1.7.11.3',
    date: '2026-11-22',
    title: 'Tomar apunte directo y la notificación en vivo de vuelta',
    changes: [
      { kind: 'mejora', text: 'Tomar apunte abre directo el editor con la materia ya elegida (Horario y Materias).' },
      { kind: 'mejora', text: 'La notificación del Estudio vuelve a mostrarse en vivo en la barra de estado, con el ícono de la app y el cronómetro del Estudio.' },
      { kind: 'correccion', text: 'Los títulos de las listas (como Lunes · 1 clase) se leen sobre cualquier foto de fondo.' },
      { kind: 'correccion', text: 'La casilla de las tareas en la Agenda queda alineada con su menú.' },
    ],
  },
  {
    version: '1.7.11.2',
    date: '2026-11-22',
    title: 'Pantallas más claras en toda la app',
    changes: [
      { kind: 'nuevo', text: 'La notificación del Estudio muestra el tiempo en grande, la fase, una barra de avance y el botón Saltar; cada cambio de fase avisa en la misma tarjeta.' },
      { kind: 'nuevo', text: 'Horario: vista Semana con columnas que se deslizan en el celular, y la vista se elige sola (Día en el celular, Semana en la PC).' },
      { kind: 'nuevo', text: 'Las clases virtuales con enlace tienen el botón Unirse a Zoom, Meet o Teams.' },
      { kind: 'nuevo', text: 'Estudio: botón de sonidos en el temporizador y desglose de tu semana día por día.' },
      { kind: 'nuevo', text: 'Materias: botón para compartir el plan completo.' },
      { kind: 'mejora', text: 'Agenda: el día elegido se ve en un solo bloque, un solo botón para agregar y el aviso de pendientes lleva directo a lo vencido.' },
      { kind: 'mejora', text: 'Tarjetas más limpias: los datos se ven como texto y solo los botones parecen botones.' },
      { kind: 'mejora', text: 'Los botones flotantes se apartan al bajar por las listas para no tapar las tarjetas.' },
      { kind: 'mejora', text: 'Mejor lectura en modo Cristal y sobre foto de fondo en Ajustes y en las pestañas principales.' },
      { kind: 'mejora', text: 'Desde Próximos en tu agenda puedes marcar una tarea como hecha.' },
    ],
  },
  {
    version: '1.7.11.1',
    date: '2026-11-22',
    title: 'Sonidos para cada fase del Estudio',
    changes: [
      { kind: 'nuevo', text: 'Cinco sonidos nuevos para el Estudio (Pulso digital, Campana zen, Marimba cálida, Chime de cristal y Alarma clásica suave), cada uno con la fase para la que es ideal.' },
      { kind: 'nuevo', text: 'Un sonido propio para cada fase: al empezar, fin de enfoque, fin de descanso corto y fin de descanso largo (cierre de ciclo).' },
      { kind: 'mejora', text: 'El Estudio toma el color de tu tema cuando no eliges materia, también en la notificación.' },
      { kind: 'mejora', text: 'La notificación del Estudio muestra un reloj de arena (y una taza en la pausa), como un temporizador.' },
      { kind: 'mejora', text: 'Elegir un sonido es más claro: botón de escuchar más grande, el tono elegido bien marcado y el origen como texto.' },
    ],
  },
  {
    version: '1.7.11.0',
    date: '2026-11-22',
    title: 'Nueva pestaña Estudio',
    changes: [
      { kind: 'nuevo', text: 'Pestaña Estudio (Pomodoro): sesiones de concentración con pausas, perfiles Clásico 25/5/15, Inicio rápido y Deep Work o tus propios tiempos, y cuánto estudiaste cada semana por materia.' },
      { kind: 'nuevo', text: 'En Android, el Estudio se ve en vivo en las notificaciones con la cuenta regresiva y los botones Pausar y Detener, aunque cierres la app.' },
      { kind: 'nuevo', text: 'Pausas con aviso y sonido: «¡Hora de una pausa!», cuánto falta para volver y tu ciclo de sesiones. Puedes elegir si las pausas y las sesiones empiezan solas.' },
      { kind: 'nuevo', text: 'Sonidos por sección: Horario, Agenda y Estudio (al empezar, en la pausa y al volver) suenan distinto. Ajústalos en Ajustes → Notificaciones → Sonidos.' },
      { kind: 'nuevo', text: 'Agenda: tareas y exámenes que se repiten cada semana, subtareas que marcas desde la ficha y avisos de repaso antes de cada examen.' },
      { kind: 'mejora', text: 'Finalizar semestre también limpia de la agenda lo que ya pasó y las tareas hechas.' },
      { kind: 'mejora', text: 'Los apuntes y «Vincular documento» siguen el mismo diseño que las demás fichas y formularios.' },
    ],
  },
  {
    version: '1.7.10.99',
    date: '2026-11-22',
    title: 'Botones flotantes con color propio',
    changes: [
      { kind: 'mejora', text: 'Cada área tiene su color en los botones flotantes (Materias, Profesores, Apuntes y Archivos), sin importar el tema elegido: se ven sobre cualquier fondo.' },
      { kind: 'mejora', text: 'En el teléfono, Compartir del Horario ahora flota debajo del botón de agregar; al tocarlo abre una hoja con Compartir horario, Importar horario y Pasar datos con otro dispositivo.' },
    ],
  },
  {
    version: '1.7.10.98',
    date: '2026-11-22',
    title: 'Fichas y formularios renovados',
    changes: [
      { kind: 'mejora', text: 'Las fichas de materia, catedrático, archivo y evento de la agenda se ven igual: arriba su tarjeta con color y las acciones más usadas (Apuntes, Contacto, Abrir, Marcar como hecha), y debajo sus datos.' },
      { kind: 'nuevo', text: 'Los formularios muestran una vista previa en vivo; toca el ícono de la vista previa para elegir color e ícono.' },
      { kind: 'nuevo', text: 'Teléfono del docente con selector de país: el código se pone solo y WhatsApp y Telegram siempre funcionan.' },
      { kind: 'nuevo', text: 'Nuevos íconos de docente: personas de distintos tipos (asesor, tutor, coordinador, conferencista…).' },
      { kind: 'mejora', text: 'Eliminar un archivo ahora pide confirmación, y «Cambiar de materia» te devuelve a donde estabas.' },
      { kind: 'mejora', text: 'En PC, el día elegido de la agenda aparece junto al calendario.' },
      { kind: 'mejora', text: 'Botones flotantes y «Mostrar hechas y pasadas» más visibles sobre cualquier fondo, y el botón de agregar con un ícono propio en cada apartado.' },
    ],
  },
  {
    version: '1.7.10.97',
    date: '2026-11-21',
    title: 'Tu agenda, más completa',
    changes: [
      { kind: 'nuevo', text: 'Ficha de cada evento de la agenda: estado, fecha, hora, lugar, materia, aviso y notas, con Editar, Marcar como hecha, Compartir y Eliminar.' },
      { kind: 'mejora', text: 'Lo que ya pasó y las tareas hechas ya no desaparecen: están en «Hechas y pasadas» y cada tarjeta dice si está Hecha, Vencida o Ya pasó.' },
      { kind: 'mejora', text: 'En PC, al elegir un día su panel aparece a la derecha del calendario y la lista.' },
      { kind: 'mejora', text: 'En Horario, «Próximos en tu agenda» ahora va debajo del horario.' },
      { kind: 'nuevo', text: 'Horario de asesoría de los profesores: elige los días y las horas con el reloj y se escribe solo.' },
    ],
  },
  {
    version: '1.7.10.96',
    date: '2026-11-21',
    title: 'Calendario y reloj con tu estilo',
    changes: [
      { kind: 'mejora', text: 'Elegir fecha y hora ahora usa un calendario y un reloj de Material 3 con los colores de tu tema, iguales en el teléfono y en la PC.' },
      { kind: 'mejora', text: 'En el reloj eliges la hora y luego los minutos tocando o deslizando, o escríbelos con el teclado. Respeta el formato de 12 o 24 horas de Ajustes.' },
    ],
  },
  {
    version: '1.7.10.95',
    date: '2026-11-21',
    title: 'Avisos que sí llegan',
    changes: [
      { kind: 'correccion', text: 'En Android 14 o más nuevo los avisos (de clases y de la agenda) no se programaban. Ahora llegan sin tener que activar nada en Ajustes del teléfono.' },
      { kind: 'correccion', text: 'El botón de agregar vuelve a su lugar de siempre en Horario y Agenda; solo sube en Materias y Biblioteca para dejar sitio a sus botones.' },
      { kind: 'mejora', text: 'Los títulos de la Agenda (Vencidas, Hoy, Mañana…) se leen mejor con cualquier tema y papel tapiz.' },
    ],
  },
  {
    version: '1.7.10.94',
    date: '2026-11-21',
    title: 'Tus clases desde la Agenda',
    changes: [
      { kind: 'mejora', text: 'Al elegir un día en la Agenda, cada clase muestra el ícono de su materia y al tocarla se abre su ficha.' },
      { kind: 'mejora', text: 'El botón para salir del día ahora dice «Cerrar».' },
    ],
  },
  {
    version: '1.7.10.93',
    date: '2026-11-21',
    title: 'Cambia de sección con un toque',
    changes: [
      { kind: 'mejora', text: 'En el teléfono, Materias | Profesores y Apuntes | Archivos ahora son botones flotantes debajo del botón de agregar: el elegido muestra su nombre y el otro solo su ícono.' },
      { kind: 'mejora', text: 'Si mueves el botón de agregar, esos botones lo siguen. En PC el selector sigue arriba.' },
    ],
  },
  {
    version: '1.7.10.92',
    date: '2026-11-21',
    title: 'Nueva pestaña Agenda',
    changes: [
      { kind: 'nuevo', text: 'Agenda: anota tareas, exámenes, recordatorios y días libres, con calendario del mes y avisos a la hora, 1 hora, 1 día o 2 días antes.' },
      { kind: 'nuevo', text: 'Los días libres (feriados, vacaciones) silencian los avisos de tus clases.' },
      { kind: 'nuevo', text: 'En Horario, «Próximos en tu agenda» te muestra lo urgente y te lleva a ese día.' },
      { kind: 'mejora', text: 'Barra de 4 pestañas: Horario, Agenda, Materias (con Profesores) y Biblioteca (Apuntes y Archivos). Se cambia con el selector de arriba.' },
      { kind: 'mejora', text: 'Las copias de seguridad y el paso de datos por QR incluyen la agenda.' },
    ],
  },
  {
    version: '1.7.10.91',
    date: '2026-11-21',
    title: 'Horario semanal con tu estilo',
    changes: [
      { kind: 'correccion', text: 'En la vista Semana del horario (la de PC), las tarjetas ahora tienen el color de cada materia, la sombra de Elevada y el mismo diseño que el resto de la app.' },
    ],
  },
  {
    version: '1.7.10.90',
    date: '2026-11-21',
    title: 'Contactos y tarjetas con tu color',
    changes: [
      { kind: 'nuevo', text: 'Contacto del profesor: elige llamar, abrir WhatsApp o Telegram, guardarlo en tus contactos o enviarlo a otra app.' },
      { kind: 'mejora', text: 'Las tarjetas de Horario, Materias y Profesores toman el color que elegiste, en una variante clara en modo claro y una profunda en modo oscuro.' },
      { kind: 'mejora', text: 'Con el acabado Elevada, todas las tarjetas (también las de Ajustes) se ven de verdad elevadas.' },
      { kind: 'mejora', text: 'Apuntes y Archivos siguen ahora tu paleta y tu acabado de tarjetas, igual que el resto de la app.' },
    ],
  },
  {
    version: '1.7.10.89',
    date: '2026-11-21',
    title: 'Cristal sin tirones',
    changes: [
      { kind: 'mejora', text: 'El acabado Cristal ahora va igual de fluido que el sólido en teléfonos y tabletas, con el mismo aspecto esmerilado.' },
      { kind: 'mejora', text: 'La barra de búsqueda flota sola al bajar, sin la franja de fondo de lado a lado.' },
    ],
  },
  {
    version: '1.7.10.88',
    date: '2026-11-21',
    title: 'Más fluida en todos lados',
    changes: [
      { kind: 'mejora', text: 'Desplazarte y cambiar de sección es más rápido, sobre todo en teléfonos: la app ya no redibuja todo al moverte por la pantalla.' },
      { kind: 'mejora', text: 'En Android se quitaron los desenfoques pesados que frenaban el scroll, sin cambiar el aspecto general.' },
      { kind: 'mejora', text: 'En teléfonos con poca memoria (3 GB o menos) el Modo Ultra Fluidez se activa solo. Puedes apagarlo en Ajustes cuando quieras.' },
    ],
  },
  {
    version: '1.7.10.87',
    date: '2026-11-21',
    title: 'Tu perfil, más a mano',
    changes: [
      { kind: 'mejora', text: 'Toca tu foto en la barra superior para ir directo a Mi perfil.' },
      { kind: 'mejora', text: 'En Mi perfil, el botón Guardar está arriba y, si sales con cambios sin guardar, la app te pregunta antes.' },
    ],
  },
  {
    version: '1.7.10.86',
    date: '2026-11-16',
    title: 'Tu estilo, a tu manera',
    changes: [
      { kind: 'mejora', text: 'Crea tu paleta: tus colores se usan exactos, ahora puedes elegir también el color del texto, y hay vista previa arriba y un botón para restablecer.' },
      { kind: 'mejora', text: 'Los acabados de tarjeta (Elevada, Cristal y Con borde) ahora se distinguen claramente y tienen vista previa.' },
      { kind: 'mejora', text: 'La intensidad del papel tapiz llega al 100 % y tiene atajos: Sutil, Medio, Intenso y Máximo.' },
    ],
  },
  {
    version: '1.7.10.85',
    date: '2026-11-16',
    title: 'De teléfono a teléfono',
    changes: [
      { kind: 'nuevo', text: 'Pasa tus datos de un teléfono a otro con un código QR: en el inicio, Compartir → Pasar datos con otro dispositivo. Funciona por wifi o con el punto de acceso de uno de los teléfonos, sin internet.' },
      { kind: 'mejora', text: 'Se pasa todo, incluida la sección Archivos, cifrado y con un código que sirve una sola vez.' },
    ],
  },
  {
    version: '1.7.10.84',
    date: '2026-11-16',
    title: 'Tus archivos también viajan',
    changes: [
      { kind: 'mejora', text: 'Al pasar datos entre el teléfono y la PC ahora también se pasa la sección Archivos (PDF, documentos y enlaces de cada materia).' },
      { kind: 'mejora', text: 'En el inicio, el menú de tres puntos ahora es el botón «Compartir», y los ⋮ de las tarjetas se ven como botones.' },
    ],
  },
  {
    version: '1.7.10.83',
    date: '2026-11-16',
    title: '20 fondos y fiestas de fin de año',
    changes: [
      { kind: 'nuevo', text: '15 papeles tapiz nuevos (Cuaderno, Matemáticas, Química, Panal, Olas, Espacio, Circuito y más), ordenados por categorías en Ajustes → Apariencia y tema.' },
      { kind: 'nuevo', text: 'Navidad (1–30 de diciembre): fondo navideño, nieve, gorrito en tu foto y cuenta atrás para Navidad.' },
      { kind: 'nuevo', text: 'Año Nuevo (31 de diciembre – 31 de enero): fuegos artificiales, chispas de fogata y un fondo con el año viejo, las 12 uvas y el reloj.' },
      { kind: 'mejora', text: 'Pasar datos entre el teléfono y la PC ahora también está en el menú ⋮ del inicio.' },
    ],
  },
  {
    version: '1.7.10.82',
    date: '2026-11-16',
    title: 'Más fácil de leer y de tocar',
    changes: [
      { kind: 'nuevo', text: 'Ajustes → General → Tamaño del texto: elige Pequeño, Normal, Grande o Muy grande y las letras de toda la app cambian al instante.' },
      { kind: 'mejora', text: 'Los botones de las ventanas (Cancelar, Guardar, Eliminar…) y las opciones del menú ⋮ son más grandes y fáciles de tocar; «Cancelar» ahora tiene contorno.' },
      { kind: 'mejora', text: 'La clase en curso se resalta con el color de tu tema (sin el borde verde brillante) y muestra cuánto falta para que termine.' },
    ],
  },
  {
    version: '1.7.10.81',
    date: '2026-11-15',
    title: 'Pasa tus datos entre el teléfono y la PC',
    changes: [
      { kind: 'nuevo', text: 'Pasa tus materias, horario y apuntes entre el teléfono y la computadora por tu wifi: la app de Windows muestra un código QR y el teléfono lo escanea. Sin cables ni internet.' },
      { kind: 'nuevo', text: 'Los datos viajan cifrados y el código sirve una sola vez. Antes de reemplazar nada, el dispositivo que recibe te muestra lo que llega y te pide confirmar.' },
    ],
  },
  {
    version: '1.7.10.80',
    date: '2026-11-15',
    title: 'Ajustes más completos y bloqueo con PIN',
    changes: [
      { kind: 'nuevo', text: 'Bloqueo de la app con PIN (y huella en Android), con un código de recuperación por si lo olvidas.' },
      { kind: 'nuevo', text: 'Ajustes → General: elige ver las horas en formato de 12 o de 24 horas. «Iniciar con Windows» ahora está aquí.' },
      { kind: 'nuevo', text: 'Resumen del día: un aviso a la hora que elijas con las clases que tienes hoy.' },
      { kind: 'mejora', text: 'Elige con cuánta anticipación te avisa cada clase: 5, 10, 15, 30 minutos o 1 hora.' },
      { kind: 'nuevo', text: 'Copia de seguridad automática cada semana (teléfono y Windows) y un recordatorio si llevas tiempo sin hacer una.' },
    ],
  },
  {
    version: '1.7.10.79',
    date: '2026-11-15',
    title: 'Tu próxima clase, con su ícono',
    changes: [
      { kind: 'mejora', text: 'En el horario, «Próxima clase» y «En curso» muestran el ícono y el color de la materia.' },
      { kind: 'mejora', text: 'En los avisos de clase del teléfono, arriba va el ícono de la agenda y al lado del texto el ícono de la materia en su color.' },
    ],
  },
  {
    version: '1.7.10.78',
    date: '2026-11-15',
    title: 'Íconos de tus materias',
    changes: [
      { kind: 'mejora', text: 'Los avisos de clase muestran el ícono y el color de la materia, en el teléfono y en la computadora.' },
      { kind: 'mejora', text: 'Los widgets muestran el ícono de cada materia junto a sus clases y apuntes.' },
      { kind: 'correccion', text: 'El widget de horario por día solo muestra los días que usas (Ajustes → Días visibles y los días con clases).' },
    ],
  },
  {
    version: '1.7.10.77',
    date: '2026-11-15',
    title: 'Un mensaje para ti',
    changes: [
      { kind: 'nuevo', text: 'En Ajustes → Acerca de la agenda hay un mensaje de ánimo para ti: no te rindas, siempre hay una razón para seguir adelante.' },
    ],
  },
  {
    version: '1.7.10.76',
    date: '2026-11-15',
    title: 'Borra clases desde la ficha',
    changes: [
      { kind: 'nuevo', text: 'Elimina una clase del horario desde el menú ⋮ de la ficha de la materia o con «Eliminar esta clase» al editarla.' },
      { kind: 'mejora', text: 'Antes de borrar, la app te dice exactamente qué clase se quita (materia, día y horas).' },
    ],
  },
  {
    version: '1.7.10.75',
    date: '2026-11-15',
    title: 'Edita desde la ficha de la materia',
    changes: [
      { kind: 'nuevo', text: 'En la ficha de una materia, toca una clase del horario para editarla o usa «+» para agregar clases con la materia, el docente y el aula ya elegidos.' },
      { kind: 'mejora', text: 'Cada tarjeta de la ficha lleva a su propia edición: un lápiz para los datos de la asignatura y «Asignar catedrático» si aún no tiene.' },
      { kind: 'correccion', text: 'En el teléfono, los selectores vuelven a mostrar el nombre de la materia o del docente elegido.' },
    ],
  },
  {
    version: '1.7.10.74',
    date: '2026-11-15',
    title: 'Horario más rápido de armar',
    changes: [
      { kind: 'nuevo', text: 'Al crear una clase puedes marcar todos los días en que la tienes, con el mismo horario o uno distinto para cada día.' },
      { kind: 'mejora', text: 'Las tarjetas de la vista semanal muestran el ícono de cada materia y su nombre completo.' },
    ],
  },
  {
    version: '1.7.10.73',
    date: '2026-11-15',
    title: 'Horario semanal renovado',
    changes: [
      { kind: 'correccion', text: 'El horario respeta los «Días visibles» de Ajustes: con «Lun - Sáb» ya no aparece el domingo, y si hoy queda fuera se abre el siguiente día.' },
      { kind: 'mejora', text: 'Las tarjetas de la vista semanal tienen un diseño más claro: color de la materia, hora, aula y docente con iconos, y «En curso» en la clase actual.' },
    ],
  },
  {
    version: '1.7.10.72',
    date: '2026-11-15',
    title: 'Actualizaciones en PC',
    changes: [
      { kind: 'correccion', text: 'En la computadora, «Descargar y actualizar» ya instala la nueva versión: antes la agenda se cerraba y no se actualizaba.' },
      { kind: 'mejora', text: 'Al actualizar en la computadora se ve el asistente con el progreso de la instalación, y al pulsar «Terminar» la agenda se abre actualizada.' },
    ],
  },
  {
    version: '1.7.10.71',
    date: '2026-11-15',
    title: 'Audios y fotos en el texto',
    changes: [
      { kind: 'nuevo', text: 'Las notas de voz ahora van dentro del texto del apunte, donde estaba el cursor, y se escuchan ahí mismo.' },
      { kind: 'nuevo', text: 'Mueve fotos y notas de voz a cualquier parte del apunte: tócalas, elige «Mover» y toca el sitio nuevo.' },
      { kind: 'nuevo', text: 'Cambia el tamaño de las fotos arrastrando su esquina y ponlas a un lado con el texto alrededor.' },
      { kind: 'nuevo', text: 'Edita tus fotos como en WhatsApp: recorta, gira, dibuja y escribe encima.' },
      { kind: 'mejora', text: 'En PC y en la web, el cursor muestra la mano sobre todo lo que se puede tocar.' },
    ],
  },
  {
    version: '1.7.10.70',
    date: '2026-11-15',
    title: 'Apuntes personales',
    changes: [
      { kind: 'nuevo', text: 'Ahora puedes crear apuntes personales que no pertenecen a ninguna materia: elige «Personal» en el selector del apunte.' },
      { kind: 'nuevo', text: 'En Apuntes, la pastilla «Personal» junto a «Todos» reúne tus ideas, pendientes y notas sin materia.' },
      { kind: 'mejora', text: 'Al crear un apunte con una materia o «Personal» abiertos, ya viene elegida esa clasificación.' },
    ],
  },
  {
    version: '1.7.10.69',
    date: '2026-11-14',
    title: 'Fotos HEIC, sin problema',
    changes: [
      { kind: 'nuevo', text: 'Ya puedes usar fotos HEIC/HEIF (el formato de iPhone y de muchos Samsung) en tu foto de perfil, en los apuntes y en el papel tapiz. Se convierten en tu teléfono, sin internet.' },
    ],
  },
  {
    version: '1.7.10.68',
    date: '2026-11-14',
    title: 'Tu perfil, a tu estilo',
    changes: [
      { kind: 'mejora', text: 'En Ajustes, la tarjeta «Mi perfil» invita a personalizarlo: tócala para cambiar tu foto, nombre, carrera y meta.' },
      { kind: 'nuevo', text: 'Al elegir tu foto de perfil puedes moverla y acercarla para encuadrar solo la parte que quieres, como en WhatsApp.' },
    ],
  },
  {
    version: '1.7.10.67',
    date: '2026-11-14',
    title: 'Ves lo que escribes',
    changes: [
      { kind: 'correccion', text: 'Al escribir o editar un apunte largo, el cursor ya no queda escondido detrás de la barra de formato ni del teclado: el texto sube solo para que veas lo que escribes.' },
    ],
  },
  {
    version: '1.7.10.66',
    date: '2026-11-14',
    title: 'Listas de tareas en tus apuntes',
    changes: [
      { kind: 'nuevo', text: 'Crea listas de tareas con casillas en tus apuntes (botón «Lista de tareas» de la barra). Al marcar una casilla se tacha todo el texto de esa tarea.' },
      { kind: 'mejora', text: 'Puedes marcar y desmarcar tareas también desde el modo lectura, sin entrar al editor.' },
    ],
  },
  {
    version: '1.7.10.65',
    date: '2026-11-14',
    title: 'Resaltador de colores',
    changes: [
      { kind: 'nuevo', text: 'Resalta texto en tus apuntes con 7 colores: amarillo, verde, celeste, rosa, naranja, morado y rojo. Está junto a negrita, cursiva y subrayado.' },
      { kind: 'mejora', text: 'Los resaltados se leen bien en modo claro y oscuro, y la app recuerda el último color que usaste.' },
    ],
  },
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
