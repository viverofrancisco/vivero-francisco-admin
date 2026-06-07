// mobile-data.jsx — sample domain data (es-EC) for the field-crew prototype

const CLIENTES = [
  { id: 'c1', nombre: 'Carolina', apellido: 'Andrade', sector: 'Cumbayá', dir: 'Urb. La Primavera, Casa 14', tel: '0998 442 109', servicios: ['Mantenimiento de jardín', 'Poda de setos'], color: 'oklch(0.52 0.11 152)' },
  { id: 'c2', nombre: 'Hacienda', apellido: 'El Olivar', sector: 'Tumbaco', dir: 'Vía Intervalles Km 4', tel: '0991 220 884', servicios: ['Mantenimiento de áreas verdes', 'Sistema de riego'], color: 'oklch(0.63 0.12 48)' },
  { id: 'c3', nombre: 'Edificio', apellido: 'Quorum', sector: 'Cumbayá', dir: 'Av. Interoceánica y F. Orellana', tel: '0987 551 230', servicios: ['Jardinería vertical'], color: 'oklch(0.58 0.075 232)' },
  { id: 'c4', nombre: 'Martín', apellido: 'Vásconez', sector: 'Tumbaco', dir: 'Conjunto El Arenal, Casa 8', tel: '0995 118 642', servicios: ['Control de plagas', 'Fertilización'], color: 'oklch(0.50 0.11 152)' },
  { id: 'c5', nombre: 'Lucía', apellido: 'Mendoza', sector: 'Nayón', dir: 'Barrio San Pedro, Lote 22', tel: '0984 776 015', servicios: ['Diseño de jardín'], color: 'oklch(0.63 0.12 48)' },
];

const VISITAS = [
  { id: 'v1', cliente: CLIENTES[0], servicio: 'Mantenimiento de jardín', hora: '08:30', dur: '1h 30m', estado: 'COMPLETADA', when: 'hoy', grupo: 'Cuadrilla Norte' },
  { id: 'v2', cliente: CLIENTES[1], servicio: 'Sistema de riego', hora: '10:30', dur: '2h', estado: 'EN_CURSO', when: 'hoy', grupo: 'Cuadrilla Norte' },
  { id: 'v3', cliente: CLIENTES[2], servicio: 'Jardinería vertical', hora: '13:00', dur: '1h', estado: 'PROGRAMADA', when: 'hoy', grupo: 'Cuadrilla Norte' },
  { id: 'v4', cliente: CLIENTES[3], servicio: 'Control de plagas', hora: '15:30', dur: '45m', estado: 'PROGRAMADA', when: 'hoy', grupo: 'Cuadrilla Norte' },
  { id: 'v5', cliente: CLIENTES[4], servicio: 'Diseño de jardín', hora: '09:00', dur: '2h', estado: 'PROGRAMADA', when: 'manana', grupo: 'Cuadrilla Norte' },
  { id: 'v6', cliente: CLIENTES[0], servicio: 'Poda de setos', hora: '11:30', dur: '1h', estado: 'PROGRAMADA', when: 'manana', grupo: 'Cuadrilla Norte' },
];

const ACTIVIDADES = [
  { id: 'a1', nombre: 'Poda y recorte', icon: 'scissors', done: true },
  { id: 'a2', nombre: 'Riego y revisión de aspersores', icon: 'droplet', done: true },
  { id: 'a3', nombre: 'Fertilización del césped', icon: 'sprout', done: false },
  { id: 'a4', nombre: 'Limpieza y retiro de maleza', icon: 'leaf', done: false },
  { id: 'a5', nombre: 'Control fitosanitario', icon: 'wrench', done: false },
];

Object.assign(window, { CLIENTES, VISITAS, ACTIVIDADES });
