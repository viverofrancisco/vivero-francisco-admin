/**
 * **Las ciudades del Ecuador: sus 221 cantones**, del Clasificador Geográfico
 * Estadístico del INEC (la antigua DPA, versión 2012 —la vigente—, sin las
 * tres *zonas no delimitadas*). "Ciudad" en una dirección es el cantón: es la
 * división que la gente nombra —Samborondón, Daule, Durán— y la que separa
 * una urbanización de la vía a la costa (Guayaquil).
 *
 * Generado desde la capa *Cantones del Ecuador* del INEC en ArcGIS
 * (`DPA_DESCAN`, `DPA_DESPRO`), con las tildes repuestas a mano —el INEC las
 * publica en mayúsculas y sin ellas— y *Gnral.* y *Crnel.* escritos enteros.
 * `codigo` es el del INEC (provincia + cantón), por si un día se cruza con
 * sus datos.
 */
export interface Canton {
  nombre: string;
  provincia: string;
  codigo: string;
}

export const CANTONES_DEL_ECUADOR: readonly Canton[] = [
  { nombre: "24 de Mayo", provincia: "Manabí", codigo: "1316" },
  { nombre: "Aguarico", provincia: "Orellana", codigo: "2202" },
  { nombre: "Alausí", provincia: "Chimborazo", codigo: "0602" },
  { nombre: "Alfredo Baquerizo Moreno", provincia: "Guayas", codigo: "0902" },
  { nombre: "Ambato", provincia: "Tungurahua", codigo: "1801" },
  { nombre: "Antonio Ante", provincia: "Imbabura", codigo: "1002" },
  { nombre: "Arajuno", provincia: "Pastaza", codigo: "1604" },
  { nombre: "Archidona", provincia: "Napo", codigo: "1503" },
  { nombre: "Arenillas", provincia: "El Oro", codigo: "0702" },
  { nombre: "Atacames", provincia: "Esmeraldas", codigo: "0806" },
  { nombre: "Atahualpa", provincia: "El Oro", codigo: "0703" },
  { nombre: "Azogues", provincia: "Cañar", codigo: "0301" },
  { nombre: "Baba", provincia: "Los Ríos", codigo: "1202" },
  { nombre: "Babahoyo", provincia: "Los Ríos", codigo: "1201" },
  { nombre: "Balao", provincia: "Guayas", codigo: "0903" },
  { nombre: "Balsas", provincia: "El Oro", codigo: "0704" },
  { nombre: "Balzar", provincia: "Guayas", codigo: "0904" },
  { nombre: "Baños de Agua Santa", provincia: "Tungurahua", codigo: "1802" },
  { nombre: "Biblián", provincia: "Cañar", codigo: "0302" },
  { nombre: "Bolívar", provincia: "Carchi", codigo: "0402" },
  { nombre: "Bolívar", provincia: "Manabí", codigo: "1302" },
  { nombre: "Buena Fe", provincia: "Los Ríos", codigo: "1210" },
  { nombre: "Caluma", provincia: "Bolívar", codigo: "0206" },
  { nombre: "Calvas", provincia: "Loja", codigo: "1102" },
  { nombre: "Camilo Ponce Enríquez", provincia: "Azuay", codigo: "0115" },
  { nombre: "Carlos Julio Arosemena Tola", provincia: "Napo", codigo: "1509" },
  { nombre: "Cascales", provincia: "Sucumbíos", codigo: "2106" },
  { nombre: "Catamayo", provincia: "Loja", codigo: "1103" },
  { nombre: "Cayambe", provincia: "Pichincha", codigo: "1702" },
  { nombre: "Cañar", provincia: "Cañar", codigo: "0303" },
  { nombre: "Celica", provincia: "Loja", codigo: "1104" },
  { nombre: "Centinela del Cóndor", provincia: "Zamora Chinchipe", codigo: "1907" },
  { nombre: "Cevallos", provincia: "Tungurahua", codigo: "1803" },
  { nombre: "Chaguarpamba", provincia: "Loja", codigo: "1105" },
  { nombre: "Chambo", provincia: "Chimborazo", codigo: "0604" },
  { nombre: "Chilla", provincia: "El Oro", codigo: "0705" },
  { nombre: "Chillanes", provincia: "Bolívar", codigo: "0202" },
  { nombre: "Chimbo", provincia: "Bolívar", codigo: "0203" },
  { nombre: "Chinchipe", provincia: "Zamora Chinchipe", codigo: "1902" },
  { nombre: "Chone", provincia: "Manabí", codigo: "1303" },
  { nombre: "Chordeleg", provincia: "Azuay", codigo: "0111" },
  { nombre: "Chunchi", provincia: "Chimborazo", codigo: "0605" },
  { nombre: "Colimes", provincia: "Guayas", codigo: "0905" },
  { nombre: "Colta", provincia: "Chimborazo", codigo: "0603" },
  { nombre: "Coronel Marcelino Maridueña", provincia: "Guayas", codigo: "0923" },
  { nombre: "Cotacachi", provincia: "Imbabura", codigo: "1003" },
  { nombre: "Cuenca", provincia: "Azuay", codigo: "0101" },
  { nombre: "Cumandá", provincia: "Chimborazo", codigo: "0610" },
  { nombre: "Cuyabeno", provincia: "Sucumbíos", codigo: "2107" },
  { nombre: "Daule", provincia: "Guayas", codigo: "0906" },
  { nombre: "Deleg", provincia: "Cañar", codigo: "0306" },
  { nombre: "Durán", provincia: "Guayas", codigo: "0907" },
  { nombre: "Echeandía", provincia: "Bolívar", codigo: "0204" },
  { nombre: "El Carmen", provincia: "Manabí", codigo: "1304" },
  { nombre: "El Chaco", provincia: "Napo", codigo: "1504" },
  { nombre: "El Empalme", provincia: "Guayas", codigo: "0908" },
  { nombre: "El Guabo", provincia: "El Oro", codigo: "0706" },
  { nombre: "El Pan", provincia: "Azuay", codigo: "0112" },
  { nombre: "El Pangui", provincia: "Zamora Chinchipe", codigo: "1906" },
  { nombre: "El Tambo", provincia: "Cañar", codigo: "0305" },
  { nombre: "El Triunfo", provincia: "Guayas", codigo: "0909" },
  { nombre: "Eloy Alfaro", provincia: "Esmeraldas", codigo: "0802" },
  { nombre: "Esmeraldas", provincia: "Esmeraldas", codigo: "0801" },
  { nombre: "Espejo", provincia: "Carchi", codigo: "0403" },
  { nombre: "Espíndola", provincia: "Loja", codigo: "1106" },
  { nombre: "Flavio Alfaro", provincia: "Manabí", codigo: "1305" },
  { nombre: "General Antonio Elizalde", provincia: "Guayas", codigo: "0927" },
  { nombre: "Girón", provincia: "Azuay", codigo: "0102" },
  { nombre: "Gonzalo Pizarro", provincia: "Sucumbíos", codigo: "2102" },
  { nombre: "Gonzanamá", provincia: "Loja", codigo: "1107" },
  { nombre: "Guachapala", provincia: "Azuay", codigo: "0114" },
  { nombre: "Gualaceo", provincia: "Azuay", codigo: "0103" },
  { nombre: "Gualaquiza", provincia: "Morona Santiago", codigo: "1402" },
  { nombre: "Guamote", provincia: "Chimborazo", codigo: "0606" },
  { nombre: "Guano", provincia: "Chimborazo", codigo: "0607" },
  { nombre: "Guaranda", provincia: "Bolívar", codigo: "0201" },
  { nombre: "Guayaquil", provincia: "Guayas", codigo: "0901" },
  { nombre: "Huamboya", provincia: "Morona Santiago", codigo: "1407" },
  { nombre: "Huaquillas", provincia: "El Oro", codigo: "0707" },
  { nombre: "Ibarra", provincia: "Imbabura", codigo: "1001" },
  { nombre: "Isabela", provincia: "Galápagos", codigo: "2002" },
  { nombre: "Isidro Ayora", provincia: "Guayas", codigo: "0928" },
  { nombre: "Jama", provincia: "Manabí", codigo: "1320" },
  { nombre: "Jaramijó", provincia: "Manabí", codigo: "1321" },
  { nombre: "Jipijapa", provincia: "Manabí", codigo: "1306" },
  { nombre: "Junín", provincia: "Manabí", codigo: "1307" },
  { nombre: "La Concordia", provincia: "Esmeraldas", codigo: "0808" },
  { nombre: "La Joya de los Sachas", provincia: "Orellana", codigo: "2203" },
  { nombre: "La Libertad", provincia: "Santa Elena", codigo: "2402" },
  { nombre: "La Maná", provincia: "Cotopaxi", codigo: "0502" },
  { nombre: "La Troncal", provincia: "Cañar", codigo: "0304" },
  { nombre: "Lago Agrio", provincia: "Sucumbíos", codigo: "2101" },
  { nombre: "Las Lajas", provincia: "El Oro", codigo: "0714" },
  { nombre: "Las Naves", provincia: "Bolívar", codigo: "0207" },
  { nombre: "Latacunga", provincia: "Cotopaxi", codigo: "0501" },
  { nombre: "Limón Indanza", provincia: "Morona Santiago", codigo: "1403" },
  { nombre: "Logroño", provincia: "Morona Santiago", codigo: "1410" },
  { nombre: "Loja", provincia: "Loja", codigo: "1101" },
  { nombre: "Lomas de Sargentillo", provincia: "Guayas", codigo: "0924" },
  { nombre: "Loreto", provincia: "Orellana", codigo: "2204" },
  { nombre: "Macará", provincia: "Loja", codigo: "1108" },
  { nombre: "Machala", provincia: "El Oro", codigo: "0701" },
  { nombre: "Manta", provincia: "Manabí", codigo: "1308" },
  { nombre: "Marcabelí", provincia: "El Oro", codigo: "0708" },
  { nombre: "Mejía", provincia: "Pichincha", codigo: "1703" },
  { nombre: "Mera", provincia: "Pastaza", codigo: "1602" },
  { nombre: "Milagro", provincia: "Guayas", codigo: "0910" },
  { nombre: "Mira", provincia: "Carchi", codigo: "0404" },
  { nombre: "Mocache", provincia: "Los Ríos", codigo: "1212" },
  { nombre: "Mocha", provincia: "Tungurahua", codigo: "1804" },
  { nombre: "Montalvo", provincia: "Los Ríos", codigo: "1203" },
  { nombre: "Montecristi", provincia: "Manabí", codigo: "1309" },
  { nombre: "Montúfar", provincia: "Carchi", codigo: "0405" },
  { nombre: "Morona", provincia: "Morona Santiago", codigo: "1401" },
  { nombre: "Muisne", provincia: "Esmeraldas", codigo: "0803" },
  { nombre: "Nabón", provincia: "Azuay", codigo: "0104" },
  { nombre: "Nangaritza", provincia: "Zamora Chinchipe", codigo: "1903" },
  { nombre: "Naranjal", provincia: "Guayas", codigo: "0911" },
  { nombre: "Naranjito", provincia: "Guayas", codigo: "0912" },
  { nombre: "Nobol", provincia: "Guayas", codigo: "0925" },
  { nombre: "Olmedo", provincia: "Loja", codigo: "1116" },
  { nombre: "Olmedo", provincia: "Manabí", codigo: "1318" },
  { nombre: "Orellana", provincia: "Orellana", codigo: "2201" },
  { nombre: "Otavalo", provincia: "Imbabura", codigo: "1004" },
  { nombre: "Oña", provincia: "Azuay", codigo: "0110" },
  { nombre: "Pablo Sexto", provincia: "Morona Santiago", codigo: "1411" },
  { nombre: "Paján", provincia: "Manabí", codigo: "1310" },
  { nombre: "Palanda", provincia: "Zamora Chinchipe", codigo: "1908" },
  { nombre: "Palenque", provincia: "Los Ríos", codigo: "1209" },
  { nombre: "Palestina", provincia: "Guayas", codigo: "0913" },
  { nombre: "Pallatanga", provincia: "Chimborazo", codigo: "0608" },
  { nombre: "Palora", provincia: "Morona Santiago", codigo: "1404" },
  { nombre: "Paltas", provincia: "Loja", codigo: "1109" },
  { nombre: "Pangua", provincia: "Cotopaxi", codigo: "0503" },
  { nombre: "Paquisha", provincia: "Zamora Chinchipe", codigo: "1909" },
  { nombre: "Pasaje", provincia: "El Oro", codigo: "0709" },
  { nombre: "Pastaza", provincia: "Pastaza", codigo: "1601" },
  { nombre: "Patate", provincia: "Tungurahua", codigo: "1805" },
  { nombre: "Paute", provincia: "Azuay", codigo: "0105" },
  { nombre: "Pedernales", provincia: "Manabí", codigo: "1317" },
  { nombre: "Pedro Carbo", provincia: "Guayas", codigo: "0914" },
  { nombre: "Pedro Moncayo", provincia: "Pichincha", codigo: "1704" },
  { nombre: "Pedro Vicente Maldonado", provincia: "Pichincha", codigo: "1708" },
  { nombre: "Penipe", provincia: "Chimborazo", codigo: "0609" },
  { nombre: "Pichincha", provincia: "Manabí", codigo: "1311" },
  { nombre: "Pimampiro", provincia: "Imbabura", codigo: "1005" },
  { nombre: "Pindal", provincia: "Loja", codigo: "1114" },
  { nombre: "Piñas", provincia: "El Oro", codigo: "0710" },
  { nombre: "Playas", provincia: "Guayas", codigo: "0921" },
  { nombre: "Portovelo", provincia: "El Oro", codigo: "0711" },
  { nombre: "Portoviejo", provincia: "Manabí", codigo: "1301" },
  { nombre: "Pucará", provincia: "Azuay", codigo: "0106" },
  { nombre: "Puebloviejo", provincia: "Los Ríos", codigo: "1204" },
  { nombre: "Puerto López", provincia: "Manabí", codigo: "1319" },
  { nombre: "Puerto Quito", provincia: "Pichincha", codigo: "1709" },
  { nombre: "Pujilí", provincia: "Cotopaxi", codigo: "0504" },
  { nombre: "Putumayo", provincia: "Sucumbíos", codigo: "2103" },
  { nombre: "Puyango", provincia: "Loja", codigo: "1110" },
  { nombre: "Quero", provincia: "Tungurahua", codigo: "1806" },
  { nombre: "Quevedo", provincia: "Los Ríos", codigo: "1205" },
  { nombre: "Quijos", provincia: "Napo", codigo: "1507" },
  { nombre: "Quilanga", provincia: "Loja", codigo: "1115" },
  { nombre: "Quinindé", provincia: "Esmeraldas", codigo: "0804" },
  { nombre: "Quinsaloma", provincia: "Los Ríos", codigo: "1213" },
  { nombre: "Quito", provincia: "Pichincha", codigo: "1701" },
  { nombre: "Riobamba", provincia: "Chimborazo", codigo: "0601" },
  { nombre: "Rioverde", provincia: "Esmeraldas", codigo: "0807" },
  { nombre: "Rocafuerte", provincia: "Manabí", codigo: "1312" },
  { nombre: "Rumiñahui", provincia: "Pichincha", codigo: "1705" },
  { nombre: "Salcedo", provincia: "Cotopaxi", codigo: "0505" },
  { nombre: "Salinas", provincia: "Santa Elena", codigo: "2403" },
  { nombre: "Salitre", provincia: "Guayas", codigo: "0919" },
  { nombre: "Samborondón", provincia: "Guayas", codigo: "0916" },
  { nombre: "San Cristóbal", provincia: "Galápagos", codigo: "2001" },
  { nombre: "San Fernando", provincia: "Azuay", codigo: "0107" },
  { nombre: "San Jacinto de Yaguachi", provincia: "Guayas", codigo: "0920" },
  { nombre: "San Juan Bosco", provincia: "Morona Santiago", codigo: "1408" },
  { nombre: "San Lorenzo", provincia: "Esmeraldas", codigo: "0805" },
  { nombre: "San Miguel", provincia: "Bolívar", codigo: "0205" },
  { nombre: "San Miguel de Urcuquí", provincia: "Imbabura", codigo: "1006" },
  { nombre: "San Miguel de los Bancos", provincia: "Pichincha", codigo: "1707" },
  { nombre: "San Pedro de Huaca", provincia: "Carchi", codigo: "0406" },
  { nombre: "San Pedro de Pelileo", provincia: "Tungurahua", codigo: "1807" },
  { nombre: "San Vicente", provincia: "Manabí", codigo: "1322" },
  { nombre: "Santa Ana", provincia: "Manabí", codigo: "1313" },
  { nombre: "Santa Clara", provincia: "Pastaza", codigo: "1603" },
  { nombre: "Santa Cruz", provincia: "Galápagos", codigo: "2003" },
  { nombre: "Santa Elena", provincia: "Santa Elena", codigo: "2401" },
  { nombre: "Santa Isabel", provincia: "Azuay", codigo: "0108" },
  { nombre: "Santa Lucía", provincia: "Guayas", codigo: "0918" },
  { nombre: "Santa Rosa", provincia: "El Oro", codigo: "0712" },
  { nombre: "Santiago", provincia: "Morona Santiago", codigo: "1405" },
  { nombre: "Santiago de Píllaro", provincia: "Tungurahua", codigo: "1808" },
  { nombre: "Santo Domingo", provincia: "Santo Domingo de los Tsáchilas", codigo: "2301" },
  { nombre: "Saquisilí", provincia: "Cotopaxi", codigo: "0506" },
  { nombre: "Saraguro", provincia: "Loja", codigo: "1111" },
  { nombre: "Sevilla de Oro", provincia: "Azuay", codigo: "0113" },
  { nombre: "Shushufindi", provincia: "Sucumbíos", codigo: "2104" },
  { nombre: "Sigchos", provincia: "Cotopaxi", codigo: "0507" },
  { nombre: "Simón Bolívar", provincia: "Guayas", codigo: "0922" },
  { nombre: "Sozoranga", provincia: "Loja", codigo: "1112" },
  { nombre: "Sucre", provincia: "Manabí", codigo: "1314" },
  { nombre: "Sucumbíos", provincia: "Sucumbíos", codigo: "2105" },
  { nombre: "Sucúa", provincia: "Morona Santiago", codigo: "1406" },
  { nombre: "Suscal", provincia: "Cañar", codigo: "0307" },
  { nombre: "Sígsig", provincia: "Azuay", codigo: "0109" },
  { nombre: "Taisha", provincia: "Morona Santiago", codigo: "1409" },
  { nombre: "Tena", provincia: "Napo", codigo: "1501" },
  { nombre: "Tisaleo", provincia: "Tungurahua", codigo: "1809" },
  { nombre: "Tiwintza", provincia: "Morona Santiago", codigo: "1412" },
  { nombre: "Tosagua", provincia: "Manabí", codigo: "1315" },
  { nombre: "Tulcán", provincia: "Carchi", codigo: "0401" },
  { nombre: "Urdaneta", provincia: "Los Ríos", codigo: "1206" },
  { nombre: "Valencia", provincia: "Los Ríos", codigo: "1211" },
  { nombre: "Ventanas", provincia: "Los Ríos", codigo: "1207" },
  { nombre: "Vinces", provincia: "Los Ríos", codigo: "1208" },
  { nombre: "Yacuambi", provincia: "Zamora Chinchipe", codigo: "1904" },
  { nombre: "Yantzaza", provincia: "Zamora Chinchipe", codigo: "1905" },
  { nombre: "Zamora", provincia: "Zamora Chinchipe", codigo: "1901" },
  { nombre: "Zapotillo", provincia: "Loja", codigo: "1113" },
  { nombre: "Zaruma", provincia: "El Oro", codigo: "0713" },
];

/**
 * Las que el vivero atiende casi siempre, primero en los selectores: buscar
 * Samborondón entre doscientos veinte nombres cada vez es el caso de todos
 * los días.
 */
export const CIUDADES_FRECUENTES = ["Guayaquil", "Samborondón", "Daule", "Durán", "Playas", "Salinas"];

const sinTildes = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * El nombre oficial de una ciudad escrita de cualquier forma —"samborondon",
 * "SAMBORONDÓN", la *locality* que devuelve Google—, o `null` si no es un
 * cantón. Es lo que deja que el buscador de direcciones llene el selector.
 */
export function cantonOficial(texto: string | null | undefined): string | null {
  if (!texto) return null;
  const t = sinTildes(texto);
  return CANTONES_DEL_ECUADOR.find((c) => sinTildes(c.nombre) === t)?.nombre ?? null;
}

/**
 * Las opciones de un selector de ciudad: las frecuentes primero, después el
 * resto por nombre, cada una con su provincia (hay cantones que se llaman
 * igual en dos provincias: Bolívar, Olmedo). Una ciudad guardada que no está
 * en la lista —escrita a mano antes de que existiera— se agrega al principio,
 * para que el selector la muestre en vez de dejarla en blanco.
 */
export interface OpcionDeCiudad {
  nombre: string;
  provincia: string | null;
  /** El del INEC; `null` en una ciudad escrita a mano antes de la lista. */
  codigo: string | null;
}

export function opcionesDeCiudad(actual?: string | null): OpcionDeCiudad[] {
  const frecuentes = CIUDADES_FRECUENTES.map((n) => CANTONES_DEL_ECUADOR.find((c) => c.nombre === n)!);
  // Por nombre como se lee —Sígsig junto a Sigchos—, no por código de letra.
  const resto = CANTONES_DEL_ECUADOR.filter((c) => !CIUDADES_FRECUENTES.includes(c.nombre)).sort(
    (a, b) => a.nombre.localeCompare(b.nombre, "es")
  );
  const lista: OpcionDeCiudad[] = [...frecuentes, ...resto];
  if (actual?.trim() && !lista.some((c) => c.nombre === actual)) {
    lista.unshift({ nombre: actual.trim(), provincia: null, codigo: null });
  }
  return lista;
}
