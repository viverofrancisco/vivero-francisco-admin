// more-data.jsx — conversations, chat messages, informes (es-EC)

const CONVERS = [
  { id: 'k1', cliente: CLIENTES[0], servicio: 'Mantenimiento de jardín', fecha: 'Hoy', estado: 'COMPLETADA', last: 'Quedó precioso, muchas gracias al equipo 🌿', time: '11:48', unread: 0, mine: false },
  { id: 'k2', cliente: CLIENTES[1], servicio: 'Sistema de riego', fecha: 'Hoy', estado: 'EN_CURSO', last: 'Estamos revisando los aspersores del sector 3.', time: '10:52', unread: 2, mine: true },
  { id: 'k3', cliente: CLIENTES[3], servicio: 'Control de plagas', fecha: 'Mañana', estado: 'PROGRAMADA', last: '¿Podrían venir más temprano si es posible?', time: 'Ayer', unread: 1, mine: false },
  { id: 'k4', cliente: CLIENTES[2], servicio: 'Jardinería vertical', fecha: '8 jun', estado: 'COMPLETADA', last: 'Adjunto las fotos del muro terminado.', time: 'Lun', unread: 0, mine: true, hasMedia: true },
  { id: 'k5', cliente: CLIENTES[4], servicio: 'Diseño de jardín', fecha: '5 jun', estado: 'COMPLETADA', last: 'Perfecto, coordinamos la próxima fase.', time: '5 jun', unread: 0, mine: false },
];

// Thread for conversation k2 (Hacienda El Olivar · riego), from staff perspective
const THREAD = [
  { id: 'm1', mine: false, author: 'Hacienda El Olivar', body: 'Buenos días, notamos que la presión del riego bajó en el jardín posterior.', time: '08:14' },
  { id: 'm2', mine: true, author: 'Diego Salas', body: 'Buenos días. Vamos hoy a las 10:30 a revisarlo, gracias por avisar.', time: '08:20', read: true },
  { id: 'm3', mine: false, author: 'Hacienda El Olivar', body: 'Perfecto, los esperamos.', time: '08:21' },
  { id: 'm4', mine: true, author: 'Diego Salas', body: 'Llegamos a la propiedad. Empezamos con la revisión de aspersores.', time: '10:34', read: true },
  { id: 'm5', mine: true, author: 'Diego Salas', media: ['antes', 'después'], time: '11:02', read: true },
  { id: 'm6', mine: true, author: 'Diego Salas', body: 'Encontramos un aspersor obstruido en el sector 3. Ya quedó reparado y la presión volvió a la normalidad.', time: '11:05', read: true },
  { id: 'm7', mine: false, author: 'Hacienda El Olivar', body: '¡Excelente servicio! Quedó funcionando perfecto. Muchas gracias al equipo 🌿', time: '11:48' },
];

const INFORMES = [
  { id: 'r1', titulo: 'Mantenimiento mensual · Mayo', cliente: CLIENTES[0], fecha: '1 jun 2026', periodo: '1 may → 31 may', visitas: 4 },
  { id: 'r2', titulo: 'Reporte de riego y plagas', cliente: CLIENTES[1], fecha: '28 may 2026', periodo: '1 may → 27 may', visitas: 6 },
  { id: 'r3', titulo: 'Servicio de jardinería vertical', cliente: CLIENTES[2], fecha: '20 may 2026', periodo: '5 may → 18 may', visitas: 3 },
  { id: 'r4', titulo: 'Mantenimiento quincenal', cliente: CLIENTES[3], fecha: '15 may 2026', periodo: '1 may → 14 may', visitas: 2 },
  { id: 'r5', titulo: 'Diseño e implementación de jardín', cliente: CLIENTES[4], fecha: '10 may 2026', periodo: '20 abr → 8 may', visitas: 5 },
];

Object.assign(window, { CONVERS, THREAD, INFORMES });
