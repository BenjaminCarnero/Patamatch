#!/usr/bin/env node
// Carga datos de demo para que PataMatch se vea como una plataforma con uso real:
// refugios, usuarios, voluntarios, mascotas con carnet, mascotas perdidas,
// comunidad, historias de éxito, chats, donaciones y hogares de tránsito.
//
//   node scripts/seed-demo.js              carga los datos (pide confirmación)
//   node scripts/seed-demo.js --si         carga sin preguntar
//   node scripts/seed-demo.js --prueba     ensaya todo (carga + limpieza) y deshace: no guarda nada
//   node scripts/seed-demo.js --recargar   borra los datos de demo anteriores y los vuelve a cargar
//   node scripts/seed-demo.js --limpiar    borra los datos de demo (no toca nada más)
//
// Cómo se distinguen los datos de demo de los reales: todos los usuarios que crea
// tienen un email @seed.patamatch.test, y todo lo demás (mascotas, chats, donaciones...)
// cuelga de esos usuarios o de sus mascotas y publicaciones. Por eso --limpiar puede
// borrarlos sin riesgo. Todas las cuentas de demo usan la contraseña demo123.
//
// Todo corre en una sola transacción: si algo falla, no queda nada a medias.
// Los datos son ficticios (nombres, refugios, teléfonos); las fotos vienen de servicios
// públicos de imágenes (dog.ceo, TheCatAPI, randomuser.me) y se guardan como URL.

'use strict';

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const { initDatabase } = require('../backend/db/database');

const DOMINIO = 'seed.patamatch.test';
const CLAVE_DEMO = 'demo123';
const args = new Set(process.argv.slice(2));

const AYUDA = `Uso: node scripts/seed-demo.js [opción]
  (sin opción)  carga los datos de demo, pidiendo confirmación
  --si          no pide confirmación
  --prueba      ensaya la carga y la limpieza dentro de una transacción y la deshace
  --recargar    borra los datos de demo anteriores y los vuelve a cargar
  --limpiar     borra los datos de demo
  --ayuda       muestra esta ayuda`;

// ============================================================
// Azar reproducible y utilidades
// ============================================================

// Mismo resultado en cada corrida: los datos de demo no cambian de una vez a otra.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261005);
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const chance = (p) => rnd() < p;
const num = (a, b, dec = 1) => Number((a + rnd() * (b - a)).toFixed(dec));
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};
const weighted = (pares) => {
  const total = pares.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [valor, peso] of pares) { r -= peso; if (r < 0) return valor; }
  return pares[pares.length - 1][0];
};

const AHORA = new Date();
// Sin 'horas' explícitas se sortea la hora del día: si no, todo lo "de hace 12 días"
// queda con la misma fecha exacta y el orden del catálogo se vuelve un empate.
const haceDias = (n, horas) => new Date(AHORA.getTime() - n * 86400000 - (horas ?? rnd() * 23) * 3600000);
const enDias = (n) => new Date(AHORA.getTime() + n * 86400000);
const sumar = (fecha, dias, horas = 0) => new Date(fecha.getTime() + dias * 86400000 + horas * 3600000);
// Una fecha de un hecho ya ocurrido no puede quedar en el futuro.
const pasado = (d) => (d > AHORA ? new Date(AHORA) : d);
const tiempo = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
const fecha = (d) => d.toISOString().slice(0, 10);

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MES3 = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fechaLarga = (d) => `${d.getDate()} de ${MESES[d.getMonth()]}`;
const fechaCorta = (d) => `${d.getDate()} ${MES3[d.getMonth()]}, ${d.getFullYear()}`;
const fechaHistorial = (d) => `${d.getDate()} ${MES3[d.getMonth()].toUpperCase()}, ${d.getFullYear()}`;

const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

// Concordancia de género en los textos: {o} → a/o, {lo} → la/lo, {ella} → ella/él,
// {Ella} → Ella/Él.
const texto = (s, { nombre = '', hembra = false } = {}) => s
  .replace(/\{Nombre\}/g, nombre)
  .replace(/\{o\}/g, hembra ? 'a' : 'o')
  .replace(/\{lo\}/g, hembra ? 'la' : 'lo')
  .replace(/\{ella\}/g, hembra ? 'ella' : 'él')
  .replace(/\{Ella\}/g, hembra ? 'Ella' : 'Él');

// ============================================================
// Catálogos
// ============================================================

// Ciudades de Argentina con su centro, código de área y barrios. 'peso' es cuánta
// de la actividad cae ahí: Córdoba concentra más porque es donde se prueba.
const ZONAS = [
  { ciudad: 'Córdoba', lat: -31.4201, lng: -64.1888, area: '351', peso: 7, barrios: ['Nueva Córdoba', 'Alberdi', 'General Paz', 'Cerro de las Rosas', 'Alta Córdoba', 'Güemes', 'Villa Belgrano', 'Barrio Jardín', 'Argüello', 'San Vicente'] },
  { ciudad: 'Villa Carlos Paz', lat: -31.4241, lng: -64.4978, area: '3541', peso: 1, barrios: ['Centro', 'Villa del Lago', 'Costa Azul', 'Playas de Oro'] },
  { ciudad: 'Río Cuarto', lat: -33.1232, lng: -64.3493, area: '358', peso: 1, barrios: ['Centro', 'Banda Norte', 'Alberdi', 'Las Delicias'] },
  { ciudad: 'Rosario', lat: -32.9442, lng: -60.6505, area: '341', peso: 3, barrios: ['Centro', 'Pichincha', 'Fisherton', 'Echesortu', 'Arroyito'] },
  { ciudad: 'Buenos Aires', lat: -34.6037, lng: -58.3816, area: '11', peso: 4, barrios: ['Palermo', 'Caballito', 'Villa Urquiza', 'Flores', 'Belgrano', 'Almagro', 'Villa Devoto', 'Núñez'] },
  { ciudad: 'La Plata', lat: -34.9205, lng: -57.9536, area: '221', peso: 1, barrios: ['Centro', 'City Bell', 'Tolosa', 'Gonnet'] },
  { ciudad: 'Mar del Plata', lat: -38.0055, lng: -57.5426, area: '223', peso: 1, barrios: ['Centro', 'Playa Grande', 'Punta Mogotes', 'Constitución'] },
  { ciudad: 'Mendoza', lat: -32.8908, lng: -68.8272, area: '261', peso: 1, barrios: ['Centro', 'Godoy Cruz', 'Guaymallén', 'Chacras de Coria'] },
  { ciudad: 'San Miguel de Tucumán', lat: -26.8083, lng: -65.2176, area: '381', peso: 1, barrios: ['Centro', 'Yerba Buena', 'Barrio Norte', 'Villa Luján'] },
  { ciudad: 'Salta', lat: -24.7821, lng: -65.4232, area: '387', peso: 1, barrios: ['Centro', 'Tres Cerritos', 'Grand Bourg', 'San Lorenzo'] },
  { ciudad: 'Santa Fe', lat: -31.6333, lng: -60.7, area: '342', peso: 1, barrios: ['Centro', 'Guadalupe', 'Candioti', 'Barrio Sur'] },
  { ciudad: 'Neuquén', lat: -38.9516, lng: -68.0591, area: '299', peso: 1, barrios: ['Centro', 'Alta Barda', 'Confluencia', 'Villa Farrell'] }
];
const zonaAlAzar = () => weighted(ZONAS.map(z => [z, z.peso]));
const jitter = (valor, grados) => Number((valor + (rnd() - 0.5) * 2 * grados).toFixed(6));

// Nombre, índice de zona y, si no es de todo tipo de animales, a qué se dedica.
const REFUGIOS = [
  ['Refugio Colitas al Viento', 0, 'Alta Córdoba'],
  ['Hogar Cuatro Huellas', 0, 'Villa Belgrano'],
  ['Asociación Gatos de Barrio', 0, 'General Paz', 'gatos'],
  ['Patitas Sin Hogar', 1, 'Villa del Lago'],
  ['Refugio El Nuevo Amanecer', 2, 'Banda Norte'],
  ['Fundación Ladridos y Ronroneos', 3, 'Fisherton'],
  ['Rescate Animal Pichincha', 3, 'Pichincha'],
  ['Refugio Segunda Oportunidad', 4, 'Flores'],
  ['Casa Gatuna Almagro', 4, 'Almagro', 'gatos'],
  ['Protectora Huellitas Platenses', 5, 'City Bell'],
  ['Refugio Mar de Patas', 6, 'Punta Mogotes'],
  ['Hogar Canino Aconcagua', 7, 'Godoy Cruz'],
  ['Refugio Cerro San Javier', 8, 'Yerba Buena'],
  ['Patas del Norte', 9, 'Grand Bourg'],
  ['Refugio Costa Litoral', 10, 'Guadalupe'],
  ['Rescate Patagonia', 11, 'Alta Barda']
];

const NOMBRES_F = ['Sofía', 'Valentina', 'Camila', 'Lucía', 'Martina', 'Julieta', 'Agustina', 'Florencia', 'Micaela', 'Carolina', 'Natalia', 'Romina', 'Paula', 'Daniela', 'Gabriela', 'Brenda', 'Antonella', 'Candela', 'Milagros', 'Rocío', 'Abril', 'Belén', 'Carla', 'Eugenia', 'Lorena', 'Mariana', 'Jimena', 'Noelia'];
const NOMBRES_M = ['Mateo', 'Santiago', 'Joaquín', 'Nicolás', 'Lucas', 'Facundo', 'Matías', 'Tomás', 'Franco', 'Agustín', 'Maximiliano', 'Diego', 'Federico', 'Gonzalo', 'Ignacio', 'Lautaro', 'Bruno', 'Ezequiel', 'Sebastián', 'Pablo', 'Martín', 'Leandro', 'Emiliano', 'Ramiro', 'Gastón', 'Cristian', 'Marcos'];
const APELLIDOS = ['González', 'Rodríguez', 'Fernández', 'López', 'Martínez', 'García', 'Pérez', 'Gómez', 'Sánchez', 'Romero', 'Díaz', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Benítez', 'Acosta', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Gutiérrez', 'Peralta', 'Rojas', 'Molina', 'Castro', 'Ortiz', 'Silva', 'Núñez', 'Luna', 'Cabrera', 'Ríos', 'Morales', 'Domínguez', 'Vega', 'Sosa', 'Ledesma', 'Quiroga', 'Funes', 'Bustos', 'Arce'];

const NOM_PERRA = ['Mora', 'Lola', 'Luna', 'Canela', 'Chicha', 'Pelusa', 'Maia', 'Nina', 'Kira', 'Frida', 'Olivia', 'Mía', 'Tita', 'Lulú', 'Sasha', 'Dulce', 'Bonita', 'Estrella', 'Zoe', 'Cleo', 'Manchita', 'Paloma', 'Reina', 'Violeta', 'Juana', 'Pepita', 'Greta', 'Jazmín', 'Aika', 'Rita'];
const NOM_PERRO = ['Tango', 'Bruno', 'Toto', 'Rocco', 'Fito', 'Simón', 'Thor', 'Max', 'Zeus', 'Cacho', 'Pancho', 'Ñoqui', 'Beto', 'Nacho', 'Lucho', 'Bobby', 'Chiquito', 'Oso', 'Rufo', 'Pipo', 'Bruce', 'Gaucho', 'Milo', 'Teo', 'Lucky', 'Benito', 'Chispa', 'Tobi', 'Duque', 'Salchi'];
const NOM_GATA = ['Mishi', 'Pelusa', 'Nala', 'Cleo', 'Mimi', 'Princesa', 'Lila', 'Mía', 'Tigra', 'Manchita', 'Sombra', 'Kiara', 'Violeta', 'Jazmín', 'Frida', 'Perla', 'Luna', 'Bruja', 'Canela', 'Nube'];
const NOM_GATO = ['Garfield', 'Simba', 'Tom', 'Félix', 'Salem', 'Oreo', 'Michi', 'Tigre', 'Pepe', 'Ñato', 'Mufasa', 'Copito', 'Bigotes', 'Leo', 'Pancho', 'Morocho', 'Coco', 'Misifú', 'Rulo', 'Gizmo'];

// Perros: la ruta es la de dog.ceo (varias opciones si una no existe). El color
// solo se carga en razas de pelaje casi invariable: con una foto al azar, decir
// "negro" de un labrador que sale dorado se notaría enseguida.
const RAZAS_PERRO = [
  { n: 'Mestizo', rutas: ['mix', 'labrador', 'beagle', 'pitbull', 'kelpie', 'shiba', 'cattledog/australian', 'terrier/american'], tam: null, kg: null, peso: 40 },
  { n: 'Labrador', rutas: ['labrador'], tam: 'Grande', kg: [25, 34], peso: 6 },
  { n: 'Golden Retriever', rutas: ['retriever/golden'], tam: 'Grande', kg: [27, 34], color: 'Dorado', peso: 4 },
  { n: 'Beagle', rutas: ['beagle'], tam: 'Mediano', kg: [9, 14], color: 'Tricolor', peso: 4 },
  { n: 'Caniche', rutas: ['poodle/miniature', 'poodle/toy'], tam: 'Pequeño', kg: [4, 9], peso: 4 },
  { n: 'Pastor Alemán', rutas: ['german/shepherd'], tam: 'Grande', kg: [28, 38], color: 'Negro y fuego', peso: 5 },
  { n: 'Bulldog Francés', rutas: ['bulldog/french'], tam: 'Pequeño', kg: [9, 13], peso: 2 },
  { n: 'Border Collie', rutas: ['collie/border'], tam: 'Mediano', kg: [15, 20], color: 'Blanco y negro', peso: 3 },
  { n: 'Husky Siberiano', rutas: ['husky'], tam: 'Grande', kg: [20, 27], peso: 2 },
  { n: 'Chihuahua', rutas: ['chihuahua'], tam: 'Pequeño', kg: [2, 3.5], peso: 3 },
  { n: 'Pug', rutas: ['pug'], tam: 'Pequeño', kg: [6, 9], peso: 2 },
  { n: 'Boxer', rutas: ['boxer'], tam: 'Grande', kg: [25, 32], peso: 3 },
  { n: 'Dálmata', rutas: ['dalmatian'], tam: 'Grande', kg: [23, 32], color: 'Blanco con manchas negras', peso: 1 },
  { n: 'Schnauzer', rutas: ['schnauzer/miniature'], tam: 'Pequeño', kg: [5, 9], color: 'Sal y pimienta', peso: 2 },
  { n: 'Cocker Spaniel', rutas: ['spaniel/cocker'], tam: 'Mediano', kg: [12, 15], peso: 3 },
  { n: 'Salchicha', rutas: ['dachshund'], tam: 'Pequeño', kg: [6, 10], peso: 3 },
  { n: 'Shih Tzu', rutas: ['shihtzu'], tam: 'Pequeño', kg: [5, 8], peso: 2 },
  { n: 'Pitbull', rutas: ['pitbull'], tam: 'Mediano', kg: [18, 27], peso: 3 },
  { n: 'Rottweiler', rutas: ['rottweiler'], tam: 'Grande', kg: [35, 48], color: 'Negro y fuego', peso: 1 },
  { n: 'Doberman', rutas: ['doberman'], tam: 'Grande', kg: [30, 40], peso: 1 },
  { n: 'Maltés', rutas: ['maltese'], tam: 'Pequeño', kg: [3, 5], color: 'Blanco', peso: 1 },
  { n: 'Gran Danés', rutas: ['dane/great'], tam: 'Grande', kg: [50, 70], peso: 1 }
];

// Gatos: id de raza de TheCatAPI, o null para la fuente general (la mayoría de los
// gatos de refugio son comunes, sin raza definida).
const RAZAS_GATO = [
  { n: 'Común europeo', cat: null, tam: 'Pequeño', kg: [2.5, 5], peso: 60 },
  { n: 'Mestizo', cat: null, tam: 'Pequeño', kg: [2.5, 5.5], peso: 8 },
  { n: 'Siamés', cat: 'siam', tam: 'Pequeño', kg: [3, 5], peso: 8 },
  { n: 'Persa', cat: 'pers', tam: 'Mediano', kg: [3.5, 6], peso: 5 },
  { n: 'Abisinio', cat: 'abys', tam: 'Pequeño', kg: [3, 5], peso: 4 },
  { n: 'British Shorthair', cat: 'bsho', tam: 'Mediano', kg: [4, 7], peso: 5 },
  { n: 'Ragdoll', cat: 'ragd', tam: 'Mediano', kg: [4.5, 7], peso: 3 },
  { n: 'Bengalí', cat: 'beng', tam: 'Mediano', kg: [4, 7], peso: 3 },
  { n: 'Maine Coon', cat: 'mcoo', tam: 'Grande', kg: [5, 8], peso: 3 }
];

const VETS = ['Dra. Paula Ferreyra', 'Dr. Martín Sosa', 'Dra. Lucía Benítez', 'Dr. Gustavo Ledesma', 'Dra. Carolina Peralta', 'Dr. Federico Aguirre', 'Dra. Mariana Quiroga', 'Dr. Sebastián Funes'];
const CLINICAS = ['Veterinaria del Parque', 'Clínica Veterinaria Norte', 'Centro Veterinario Sur', 'Veterinaria Cuatro Patas', 'Clínica Felina del Centro', 'Hospital Veterinario Costanera', 'Veterinaria San Roque', 'Veterinaria La Esquina'];

const OPENERS = [
  '{Nombre} fue rescatad{o} de la calle y hoy se recupera en el refugio.',
  'Llegó al refugio siendo muy chic{o} y creció entre voluntarios.',
  'Apareció en una plaza del barrio y los vecinos {lo} cuidaron hasta que llegó acá.',
  'Su familia se mudó al exterior y no pudo llevar{lo}.',
  '{Nombre} nació en el refugio y nunca conoció otra casa.',
  '{Nombre} apareció en una ruta, flaquit{o} y con mucho miedo, pero ya confía en la gente.',
  'Estuvo en tránsito con una familia que se enamoró, pero no puede quedarse con {ella}.',
  '{Nombre} apareció en la puerta del refugio una madrugada de lluvia.'
];
const RASGOS_PERRO = [
  'Es muy cariños{o} y busca mimos todo el tiempo.',
  'Se lleva bien con otros perros y con los chicos.',
  'Camina bien con correa y conoce las órdenes básicas.',
  'Está castrad{o}, desparasitad{o} y con sus vacunas al día.',
  'Es tranquil{o} y se adapta bien a un departamento.',
  'Necesita patio o paseos largos todos los días.',
  'Es medio tímid{o} al principio, pero después no te suelta.',
  'Le encanta jugar con la pelota y correr en el parque.',
  'Es muy inteligente y aprende rápido.',
  'Se queda tranquil{o} cuando está solo un rato.',
  'No se lleva bien con los gatos.'
];
const RASGOS_GATO = [
  'Es muy cariños{o} y ronronea apenas le hablás.',
  'Convive tranquil{o} con otros gatos.',
  'Usa el arenero sin problema.',
  'Le gusta dormir al sol y trepar a todos lados.',
  'Está castrad{o}, desparasitad{o} y con sus vacunas al día.',
  'Es independiente, pero muy compañer{o}.',
  'Es medio tímid{o} al principio, pero después no se despega.',
  'Se divierte con cualquier cosa que se mueva.',
  'No se lleva bien con los perros.',
  'Es ideal para departamento.'
];
const REQUISITOS = [
  'Se entrega con contrato de adopción y seguimiento.',
  'Buscamos una familia comprometida para toda su vida.',
  'Se pide una visita previa al hogar.',
  'Se entrega castrad{o} y con carnet de vacunas.'
];
const CITAS_ADOPCION = [
  '"{Nombre} se convirtió en la alegría de nuestra casa."',
  '"Pensamos que íbamos a salvar{lo}, pero {Ella} nos salvó a nosotros."',
  '"Desde el primer día se adueñó del sillón y de nuestro corazón."',
  '"No sabíamos cuánto lo necesitábamos hasta que llegó {Nombre}."',
  '"Hoy duerme a los pies de la cama y nos espera en la puerta cada vez que volvemos."',
  '"Adoptar a {Nombre} fue la mejor decisión del año."'
];

const NOTAS_SALUD = {
  con_cuidado: [
    'Castrad{o} el {d1}. Evitar saltos y mantener el collar isabelino hasta el control del {d2}.',
    'Salió de una operación de {op} el {d1}. Se adopta con cuidados: control el {d2}.',
    'Termina un tratamiento antibiótico el {d2}. Puede irse a su hogar con indicaciones.'
  ],
  en_reposo: [
    'Operad{o} de {op} el {d1}. Reposo estricto hasta el {d2}; no se entrega hasta el alta.',
    'Recuperándose de una cirugía del {d1}. Reposo hasta el {d2}.'
  ],
  cirugia_programada: [
    '{cx} programada para el {d2}. Puede conocerse antes; se entrega después de la cirugía.',
    'Tiene turno de {cx} el {d2}. Se entrega luego de la recuperación.'
  ]
};
const OPERACIONES = ['una fractura en la pata trasera', 'una hernia umbilical', 'la extirpación de un tumor benigno', 'una cirugía de cadera', 'una limpieza dental con extracciones'];
const CIRUGIAS = ['Castración', 'Limpieza dental', 'Extracción de una pieza dental', 'Cirugía de cadera'];

const ENFERMEDADES_PERRO = [
  { name: 'Sarna', status: 'curada', notes: 'Tratamiento completo, sin recaídas' },
  { name: 'Parvovirus', status: 'curada', notes: 'Superado al llegar al refugio' },
  { name: 'Dermatitis alérgica', status: 'cronica', notes: 'Se controla con dieta e higiene' },
  { name: 'Gingivitis leve', status: 'en_tratamiento', notes: 'Limpieza dental pendiente' },
  { name: 'Artrosis', status: 'cronica', notes: 'Suplemento articular diario' },
  { name: 'Ehrlichiosis', status: 'en_tratamiento', notes: 'Antibiótico por 28 días' }
];
const ENFERMEDADES_GATO = [
  { name: 'Rinotraqueítis', status: 'curada', notes: 'Sin síntomas hace meses' },
  { name: 'Hongos (dermatofitosis)', status: 'curada', notes: 'Tratamiento tópico completo' },
  { name: 'Gingivitis leve', status: 'en_tratamiento', notes: 'Higiene dental cada 6 meses' },
  { name: 'Parásitos intestinales', status: 'curada', notes: 'Desparasitación completa' },
  { name: 'Insuficiencia renal leve', status: 'cronica', notes: 'Alimento renal, control cada 4 meses' }
];
const ALERGIAS = ['Pollo (dermatitis)', 'Picadura de pulga', 'Ciertos shampoos', 'Granos en el alimento'];

const CONVERSACIONES = [
  (c) => [
    ['a', `Hola! Vi a ${c.pet} en PataMatch y me encantó. ¿Sigue disponible?`],
    ['o', `¡Hola ${c.adopter}! Sí, ${c.pet} sigue buscando familia. ¿Tenés experiencia con ${c.especie}s?`],
    ['a', `Sí, tuve uno durante 12 años y ahora vivo con mi pareja en ${pick(['un departamento', 'una casa con patio', 'una casa con jardín'])}.`],
    ['o', `Perfecto. ¿Podés pasar el sábado por el refugio para conocer${c.lo}?`],
    ['a', 'Dale, ahí estoy. ¡Muchas gracias!']
  ],
  (c) => [
    ['a', `Buenas tardes, quería saber si ${c.pet} está vacunad${c.o} y castrad${c.o}.`],
    ['o', `Hola! Tiene todas las vacunas al día y el carnet está cargado en su ficha. ${c.castrado}`],
    ['a', 'Genial, lo vi. ¿Cuáles son los pasos para adoptar?'],
    ['o', 'Completás un formulario, hacemos una visita corta a tu casa y firmamos el contrato de adopción. Todo es gratis.'],
    ['a', 'Perfecto, mañana te escribo para coordinar.']
  ],
  (c) => [
    ['a', `Hola, tengo dos chicos de 6 y 9 años. ¿${c.pet} se lleva bien con niños?`],
    ['o', `Hola ${c.adopter}! Con los chicos es muy dulce, estuvo en tránsito con una familia con hijos. ¿Querés que coordinemos una visita?`],
    ['a', 'Sí, por favor. Los fines de semana puedo.'],
    ['o', 'Te espero el domingo a las 11. ¡Traé a los chicos!']
  ],
  (c) => [
    ['a', `Hola, me gustaría adoptar a ${c.pet}. Trabajo desde casa, así que tendría compañía todo el día.`],
    ['o', 'Qué bueno, eso suma mucho. ¿Hay otros animales en la casa?'],
    ['a', 'Una gata de 4 años, muy tranquila.'],
    ['o', `Entonces hacemos una presentación gradual, como corresponde. ¿Cuándo podrías venir a conocer${c.lo}?`],
    ['a', 'El viernes a la tarde, si te viene bien.'],
    ['o', 'Dale, te agendo para las 17. ¡Nos vemos!']
  ],
  (c) => [
    ['a', `Hola! ¿${c.pet} necesita algún cuidado especial?`],
    ['o', 'Hola! Nada complicado: buena alimentación, paseos y mucho cariño. Si tiene algo médico lo vas a ver en su carnet.'],
    ['a', 'Gracias! Lo hablo en casa y te confirmo.']
  ]
];
const CONVERSACION_RECHAZO = (c) => [
  ['a', `Hola, me interesa adoptar a ${c.pet}.`],
  ['o', `Hola ${c.adopter}! Gracias por escribir. Por ahora ${c.pet} está reservad${c.o} para otra familia que ya ${c.lo} visitó, pero te avisamos si algo cambia.`],
  ['a', 'Entiendo, muchas gracias igual.']
];

const POSTS = [
  // tips
  ['tips', '¿Cómo presento a un gato nuevo a mi perro?', 'Adoptamos una gatita hace una semana y mi perro no la deja en paz. Por ahora los tenemos en ambientes separados. ¿Alguien pasó por lo mismo? ¿Cuánto tardaron en llevarse bien?', ['#Convivencia', '#GatosYPerros']],
  ['tips', 'Mi cachorro llora toda la noche, ¿qué hago?', 'Llegó hace tres días y no para de llorar cuando lo dejo solo en la cocina. Probé con una mantita y un reloj despertador, pero nada. Acepto todo tipo de consejos.', ['#Cachorros', '#PrimerasNoches']],
  ['tips', 'Ideas para entretener a un perro adulto en un departamento', 'Vivo en un tercer piso con un perro de 4 años con mucha energía. Además de los paseos, ¿qué juegos o juguetes les funcionan para cansarlos adentro?', ['#Departamento', '#Enriquecimiento']],
  ['tips', 'Checklist para la primera semana con un adoptado', 'Armé una lista con lo que me hubiera gustado saber: cama en un lugar tranquilo, agua siempre disponible, rutina fija de comidas y paseos, y nada de visitas multitudinarias los primeros días. ¿Qué agregarían?', ['#Adopción', '#Consejos']],
  ['tips', '¿Arnés o collar para un perro que tira mucho?', 'Mi mestiza de 20 kilos tira de la correa como si no hubiera mañana. Me hablaron de los arneses anti-tirón. ¿Alguien los probó? ¿Valen la pena?', ['#Paseos', '#Entrenamiento']],
  ['tips', 'Cómo lograr que mi gato use el rascador y no el sillón', 'Compramos un rascador enorme y lo ignora por completo. El sillón, en cambio, ya parece un tejido. ¿Algún truco con catnip, ubicación o texturas?', ['#Gatos', '#Rascadores']],
  ['tips', 'Paseos con calor: cómo cuidar las patitas', 'Con el asfalto a esta temperatura se pueden lastimar las almohadillas. Regla del dorso de la mano: si no aguantás 5 segundos apoyada, es mucho para ellos. Paseen temprano o de noche.', ['#Verano', '#CuidadoDePatas']],
  ['tips', '¿Qué hago si mi perro adoptado le ladra a todo?', 'Es muy bueno en casa pero en la calle le ladra a bicis, motos y otros perros. Imagino que es miedo. ¿Recomiendan algún trabajo de desensibilización?', ['#Conducta', '#Adoptados']],
  // health
  ['health', '¿Cada cuánto desparasitar a un cachorro?', 'Mi veterinaria me dijo cada 15 días hasta los 3 meses y después cada mes hasta los 6. Lo pongo acá por si le sirve a alguien que recién arranca.', ['#Cachorros', '#Desparasitación']],
  ['health', 'Mi perra senior tiene artrosis: ¿suplementos que recomienden?', 'Tiene 11 años y le cuesta subir escalones. Estamos probando condroprotectores y fisioterapia. Cuéntenme qué les dio resultado.', ['#PerrosSenior', '#Artrosis']],
  ['health', 'Castración: ¿cuál es la edad ideal en gatos?', 'En el refugio nos dijeron que se puede desde los 4 a 6 meses. Mi vete prefería esperar un poco más. ¿Qué les indicaron a ustedes?', ['#Castración', '#Gatos']],
  ['health', 'Alimento balanceado vs. comida casera: qué me dijo mi veterinaria', 'Me explicó que lo importante es que sea completo. La comida casera requiere asesoramiento nutricional para no generar carencias. Nosotros seguimos con balanceado de buena calidad.', ['#Alimentación', '#Nutrición']],
  ['health', 'Mi gato vomita bolas de pelo seguido, ¿es normal?', 'Una vez por semana más o menos. Le cepillo el pelo a diario y le doy pasta maltada. ¿Debería preocuparme o es parte de ser gato?', ['#Gatos', '#Salud']],
  ['health', 'Calendario de vacunas que me pasó mi vete', 'Perros: séxtuple a las 6, 9 y 12 semanas, antirrábica desde los 3 meses y refuerzo anual. Gatos: triple felina y leucemia, también con refuerzo anual. Consulten siempre con su veterinario.', ['#Vacunas', '#Prevención']],
  ['health', 'Golpe de calor en perros: cómo reconocerlo', 'Jadeo exagerado, encías muy rojas, babeo espeso, desorientación. Hay que llevarlo a la sombra, mojarlo con agua fresca (no helada) y correr al veterinario. Los braquicéfalos son los más riesgosos.', ['#Verano', '#Emergencias']],
  ['health', 'Dermatitis alérgica: lo que aprendimos tras un año de pelea', 'Fue una mezcla de dieta de eliminación, baños medicados y control de pulgas todo el año. Tuvo mejoras claras recién a los tres meses. Paciencia y constancia.', ['#Dermatitis', '#Alergias']],
  // events
  ['events', 'Jornada de adopción este sábado', 'Este sábado de 10 a 14 hacemos una jornada de adopción con perros y gatos de varios refugios. Va a haber charlas sobre tenencia responsable. ¡Sumate y traé tu difusión!', ['#Adopción', '#Jornada']],
  ['events', 'Colecta de alimento para refugios', 'Juntamos alimento balanceado, mantas y medicamentos para los refugios de la zona. Podés dejar tu donación el domingo en el punto de encuentro. Cada kilo suma.', ['#Colecta', '#Donaciones']],
  ['events', 'Charla gratuita de tenencia responsable', 'Un equipo de veterinarios y adiestradores va a hablar de castración, vacunación, identificación y convivencia. Cupos limitados, se pide inscripción previa.', ['#Charla', '#TenenciaResponsable']],
  ['events', 'Campaña de castración a bajo costo: cómo anotarse', 'Se abrió la inscripción para una campaña de castración con turnos limitados. Se necesita llevar al animal en ayunas y con libreta sanitaria si la tiene. Compartan para que llegue a más gente.', ['#Castración', '#Campaña']],
  ['events', 'Encuentro de perros adoptados', 'Armamos un picnic para que los adoptados se reencuentren con los voluntarios que los cuidaron. Traigan agua, juguetes y muchas ganas. ¡Habrá premios al más pachón!', ['#Adoptados', '#Encuentro']],
  ['events', 'Taller de primeros auxilios para mascotas', 'Vamos a practicar reanimación, manejo de heridas y qué hacer ante un atragantamiento. Lo dicta una veterinaria de emergencias. Entrada con alimento no perecedero.', ['#PrimerosAuxilios', '#Taller']],
  // search
  ['search', 'Cómo armar un buen cartel de mascota perdida', 'Foto clara y reciente, nombre, zona y fecha donde se perdió, y un teléfono de contacto. Menos texto y letras grandes. Publicalo en PataMatch y pegalo en un radio de 10 cuadras.', ['#MascotaPerdida', '#Difusión']],
  ['search', 'Se perdió mi perra en el barrio, ¿cómo difundir?', 'Se escapó ayer a la tarde con un ruido de pirotecnia. Ya recorrí la zona y avisé a los vecinos. ¿Qué más puedo hacer? Cualquier ayuda me sirve.', ['#MascotaPerdida', '#Ayuda']],
  ['search', 'Tips para buscar a un gato que escapó', 'Los gatos suelen esconderse muy cerca de casa. Buscá de noche con una linterna, dejá su arenero y una prenda tuya afuera, y revisá patios y techos. Muchos vuelven solos a los pocos días.', ['#Gatos', '#Búsqueda']],
  ['search', 'Gracias a todos: encontramos a Toto', 'Después de cuatro días, un vecino lo reconoció por el cartel y nos llamó. Estaba asustado pero bien. Gracias a quienes compartieron y a quienes recorrieron las calles con nosotros.', ['#FinalFeliz', '#Gracias']],
  ['search', 'Grupo de voluntarios para búsquedas los fines de semana', 'Estamos armando un grupo para ayudar a buscar mascotas perdidas en la zona. Si tenés bici, auto o simplemente ganas de recorrer, sumate. Coordinamos por acá.', ['#Voluntariado', '#Búsqueda']],
  ['search', '¿El chip sirve realmente? Mi experiencia', 'Encontraron a mi perro a 15 km y en la veterinaria lo escanearon y me llamaron esa misma tarde. El chip no tiene GPS, pero los datos actualizados hacen toda la diferencia.', ['#Microchip', '#Identificación']]
];

const COMENTARIOS = {
  tips: ['¡Excelente consejo! A nosotros nos funcionó lo mismo.', 'Gracias por compartirlo, justo lo estaba necesitando.', 'Paciencia y rutina. A los diez días ya era otro.', 'Yo probé con premios y mucho refuerzo positivo, y mejoró un montón.', 'Lo mejor que me dijeron: no apurar los tiempos del animal.', 'Totalmente de acuerdo. Cada uno tiene su ritmo.', 'Voy a probarlo este fin de semana, gracias!', 'Mi vete me dijo lo mismo y ayudó mucho.'],
  health: ['Siempre consultá con tu veterinario, cada caso es distinto.', 'Gracias por la info, la guardo.', 'A mi perro le pasó algo parecido y se resolvió con tratamiento.', 'Muy importante lo de la prevención. Nunca hay que saltearse los refuerzos.', 'Mi veterinaria recomendó lo mismo.', 'Qué bueno que lo expliques tan claro.', 'Compartido con mi familia, ¡gracias!', 'Yo hice el control y salió todo bien. No lo posterguen.'],
  events: ['¡Ahí estaremos! Gracias por organizar.', 'Qué buena iniciativa, ya lo compartí.', 'Voy a llevar alimento. ¿Hasta qué hora reciben donaciones?', 'Me anoto. ¿Se puede ir con mascotas?', '¡Muy buena propuesta! Hacen falta más espacios así.', 'Difundido en mis redes.', 'Gracias por la info, llevo a mis hijos.', 'Excelente, ojalá se repita todos los meses.'],
  search: ['Compartido en todos mis grupos. ¡Ojalá aparezca pronto!', 'Mucha fuerza, ya vamos a encontrarlo.', 'Los carteles con foto grande funcionan muchísimo.', 'Yo recorrí la zona esta mañana, avisen si necesitan ayuda.', 'Qué alegría saber que lo encontraron.', 'Gracias por los consejos, me sirven un montón.', 'Revisen también las veterinarias y refugios cercanos.', 'Tengo un auto, puedo ayudar a buscar el sábado.']
};

const HISTORIAS_TITULOS = ['{Nombre} ya tiene casa', 'El día que {Nombre} llegó a casa', 'De la calle al sillón: la historia de {Nombre}', '{Nombre}, una segunda oportunidad', 'Cómo {Nombre} cambió nuestra rutina', 'Un final feliz para {Nombre}'];
const HISTORIAS_CUERPOS = [
  'Cuando conocimos a {Nombre} en {refugio} estaba muy tímid{o}, pero en dos días ya nos seguía por toda la casa. Hoy duerme a los pies de la cama y nos recibe cada vez que volvemos del trabajo. Si estás pensando en adoptar, animate: nosotros no lo dudaríamos de nuevo.',
  'Llevábamos meses pensando en sumar un animal a la familia. Nos hablaron de {Nombre} y fuimos a conocer{lo} sin ninguna promesa. Salimos del refugio con {ella} en brazos. Pasaron {tiempo} y no podemos imaginar la casa sin {ella}.',
  '{Nombre} llegó con miedo a todo: a las escobas, a los ruidos, a los desconocidos. Con paciencia, rutina y mucho cariño, hoy es otr{o}. Gracias a {refugio} por cuidar{lo} y por acompañarnos en cada paso del proceso.',
  'No teníamos experiencia, pero el equipo de {refugio} nos explicó todo. {Nombre} se adaptó más rápido de lo que pensábamos y los chicos de la casa están felices. Es la mejor decisión que tomamos este año.',
  'Después de {tiempo} en el refugio, {Nombre} por fin encontró su lugar en el mundo. Sigue siendo igual de divertid{o} que el primer día y nos enseñó que adoptar es un acto de amor de ida y vuelta.',
  'Vimos a {Nombre} en PataMatch, escribimos esa misma noche y a la semana ya estaba en casa. Se ganó a toda la familia, incluidos los vecinos. Gracias por existir, refugios.'
];
const HISTORIAS_BADGES = [['Final Feliz', 70], ['Segunda Oportunidad', 18], ['Adopción Senior', 6], ['Cachorro Rescatado', 6]];

const TAREAS = [
  ['Paseo de los perros del refugio', 'Sacamos a pasear a los perros en grupos de a dos. Hace falta ropa cómoda y ganas de caminar.'],
  ['Jornada de adopción en la plaza', 'Armamos una mesa con fotos y carnets de los animales. Se necesitan voluntarios para atender al público.'],
  ['Limpieza y desinfección de caniles', 'Limpieza profunda de caniles y comederos. Se aporta el material de limpieza.'],
  ['Traslado al veterinario', 'Llevar a dos animales a su control y esperar la atención. Se necesita auto o movilidad propia.'],
  ['Armado de camas con ropa reciclada', 'Taller para hacer camitas con mantas y ropa donada para los animales en tránsito.'],
  ['Difusión en redes', 'Sacar fotos lindas y escribir los textos para los animales que buscan hogar.'],
  ['Colecta de alimento en el supermercado', 'Mesa de colecta en la puerta del súper un sábado por la mañana.'],
  ['Cuidado de gatitos con mamadera', 'Alimentación de gatitos huérfanos cada tres horas, en turnos acordados.'],
  ['Control de peso y desparasitación', 'Registro de peso y aplicación de antiparasitarios bajo supervisión veterinaria.'],
  ['Visita a hogares de adopción', 'Visita de seguimiento a familias que adoptaron en los últimos tres meses.']
];

const DON_ESPECIE = ['20 kg de alimento balanceado para perros adultos', '15 kg de alimento para gatos', 'Mantas y camas usadas en buen estado', 'Antiparasitarios para 10 animales', 'Arena sanitaria (4 bolsas)', 'Collares, correas y pretales', 'Medicamentos de venta libre y gasas', 'Bebederos y comederos de acero', 'Jaulas transportadoras', 'Productos de limpieza'];
const DON_NOTAS = ['Gracias por lo que hacen.', 'Ojalá sirva para los más chiquitos.', 'Lo dejo el sábado en el refugio.', 'Es mi cumpleaños y prefiero donar.', 'Para los que más lo necesiten.', 'Un abrazo a todos los voluntarios.'];

const NOTAS_TRANSITO = ['Se adaptó rápido a la casa.', 'Necesita medicación cada 12 horas.', 'Llegó muy flaquito, ya engordó.', 'Se lleva bien con los otros animales de la casa.', 'Está aprendiendo a usar el arenero.', 'Todavía le cuesta quedarse solo.', 'Es muy tranquilo, ideal para la recuperación.'];
const NOTAS_VOLUNTARIO = ['Casa con patio cerrado, sin otras mascotas.', 'Departamento amplio, disponibilidad todo el día.', 'Tengo experiencia cuidando animales en recuperación.', 'Vivo con mi familia, los chicos están encantados.', 'Puedo recibir cachorros y gatitos, con mamadera incluida.', 'Casa con jardín. Tengo un perro tranquilo.'];

// ============================================================
// Fotos
// ============================================================

const UNSPLASH = (id) => `https://images.unsplash.com/${id}?w=600&q=80&auto=format&fit=crop`;
// Las mismas fotos que usa el seed original: sirven si falla el servicio de fotos.
const FOTOS_RESPALDO = {
  perro: ['photo-1543466835-00a7907e9de1', 'photo-1602241628512-459cdd3234fe', 'photo-1537151608828-ea2b11777ee8', 'photo-1596490634801-c536934af56e', 'photo-1530281700549-e82e7bf110d6', 'photo-1561037404-61cd46aa615b', 'photo-1518717758536-85ae29035b6d', 'photo-1583511655857-d19b40a7a54e'].map(UNSPLASH),
  gato: ['photo-1472491235688-bdc81a63246e', 'photo-1495360010541-f48722764df0', 'photo-1574158622682-e40e69881006', 'photo-1514888286974-6c03e2ca1dba'].map(UNSPLASH)
};

async function pedirJSON(url, ms = 20000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`${url} respondió ${r.status}`);
  return r.json();
}

// Reparte fotos por clave ('perro:labrador', 'gato:siam', 'gato:general'). Se piden
// de a una tanda por clave antes de armar los datos, y si el servicio falla se usan
// las de respaldo: el script nunca se queda sin fotos.
class Fotos {
  constructor() { this.cola = new Map(); this.todas = new Map(); this.razasPerro = null; this.avisos = 0; }

  async precargar(necesidades) {
    try {
      const lista = (await pedirJSON('https://dog.ceo/api/breeds/list/all')).message;
      this.razasPerro = lista;
    } catch (e) { this.avisar('dog.ceo no responde'); }

    for (const [clave, cantidad] of necesidades) {
      const [tipo, id] = clave.split(':');
      let urls = [];
      try {
        if (tipo === 'perro') urls = await this.pedirPerro(id, cantidad);
        else urls = await this.pedirGato(id, cantidad);
      } catch (e) { this.avisar(`${clave}: ${e.message}`); }
      urls = [...new Set(urls)];
      if (!urls.length) urls = shuffle(FOTOS_RESPALDO[tipo]);
      this.todas.set(clave, urls);
      this.cola.set(clave, [...urls]);
    }
  }

  avisar(msg) { if (this.avisos++ < 6) console.log(`   (aviso fotos: ${msg}; se usan fotos de respaldo)`); }

  rutaPerroValida(ruta) {
    if (!this.razasPerro) return false;
    const [principal, sub] = ruta.split('/');
    return Object.prototype.hasOwnProperty.call(this.razasPerro, principal) && (!sub || this.razasPerro[principal].includes(sub));
  }

  async pedirPerro(ruta, cantidad) {
    if (!this.rutaPerroValida(ruta)) throw new Error('raza inexistente');
    const json = await pedirJSON(`https://dog.ceo/api/breed/${ruta}/images/random/${Math.min(50, Math.max(2, cantidad + 2))}`);
    return Array.isArray(json.message) ? json.message : [];
  }

  async pedirGato(id, cantidad) {
    const urls = [];
    const base = 'https://api.thecatapi.com/v1/images/search?mime_types=jpg,png';
    const llamadas = id === 'general' ? Math.ceil((cantidad + 4) / 10) + 1 : 1;
    for (let i = 0; i < llamadas; i++) {
      const lote = await pedirJSON(`${base}&limit=10${id === 'general' ? '' : `&breed_ids=${id}`}`);
      urls.push(...lote.map(x => x.url));
    }
    return urls;
  }

  // Siguiente foto de la clave; si se agotaron, vuelve a empezar (mejor repetir que dejar vacío).
  siguiente(clave) {
    let cola = this.cola.get(clave);
    if (!cola || !cola.length) {
      const [tipo] = clave.split(':');
      const origen = this.todas.get(clave) || FOTOS_RESPALDO[tipo];
      this.cola.set(clave, [...shuffle(origen)]);
      cola = this.cola.get(clave);
    }
    return cola.shift();
  }
}

// ============================================================
// Construcción de los datos en memoria
// ============================================================

function edadTexto(meses) {
  if (meses < 12) return meses === 1 ? '1 Mes' : `${meses} Meses`;
  const años = Math.floor(meses / 12);
  const resto = meses % 12;
  if (resto >= 6) return `${años}.5 Años`;
  return años === 1 ? '1 Año' : `${años} Años`;
}

function sorteoEdadMeses() {
  const grupo = weighted([['cachorro', 28], ['joven', 27], ['adulto', 33], ['senior', 12]]);
  if (grupo === 'cachorro') return int(2, 10);
  if (grupo === 'joven') return int(12, 30);
  if (grupo === 'adulto') return int(36, 84);
  return int(96, 156);
}

function telefono(zona) { return `(${zona.area}) 555-0${int(100, 199)}`; }

function microchip() {
  const grupo = () => String(int(0, 9999)).padStart(4, '0');
  return `9851 ${grupo()} ${grupo()} ${String(int(0, 999)).padStart(3, '0')}`;
}

function estadoVacuna(proxima) {
  const dias = (proxima - AHORA) / 86400000;
  if (dias < 0) return 'expired';
  if (dias <= 30) return 'expiring';
  return 'updated';
}

function armarVacunas(esPerro, meses) {
  if (chance(0.1)) return [];
  const lista = [];
  const dosis = (name, ultima, intervalo = 12) => {
    const proxima = new Date(ultima); proxima.setMonth(proxima.getMonth() + intervalo);
    return { name, last_dose: fechaCorta(ultima), next_dose: fechaCorta(proxima), status: estadoVacuna(proxima) };
  };
  if (meses < 4) {
    const primera = haceDias(int(10, 40));
    const segunda = sumar(primera, 21);
    lista.push({ name: `${esPerro ? 'Séxtuple (DHPPiL)' : 'Triple felina'} — 1ª dosis`, last_dose: fechaCorta(primera), next_dose: fechaCorta(segunda), status: 'updated' });
    if (segunda < AHORA) lista.push({ name: `${esPerro ? 'Séxtuple (DHPPiL)' : 'Triple felina'} — 2ª dosis`, last_dose: fechaCorta(segunda), next_dose: fechaCorta(sumar(segunda, 21)), status: estadoVacuna(sumar(segunda, 21)) });
    lista.push({ name: 'Antirrábica', last_dose: '', next_dose: 'Pendiente (desde los 3 meses)', status: 'expired' });
    return lista;
  }
  const ultima = () => haceDias(int(20, 420));
  if (esPerro) {
    lista.push(dosis('Séxtuple (DHPPiL)', ultima()));
    lista.push(dosis('Antirrábica', ultima()));
    if (chance(0.4)) lista.push(dosis('Tos de las perreras', ultima()));
  } else {
    lista.push(dosis('Triple felina', ultima()));
    lista.push(dosis('Leucemia felina', ultima()));
    lista.push(dosis('Antirrábica', ultima()));
  }
  return lista;
}

function armarCarnet(m, zona) {
  const esPerro = m.species === 'Perro';
  const kgBase = m.raza.kg ? num(m.raza.kg[0], m.raza.kg[1]) : (m.size === 'Grande' ? num(22, 34) : m.size === 'Mediano' ? num(11, 20) : num(4, 9));
  // Un cachorro no pesa lo que un adulto: se escala por edad.
  const peso = Number((kgBase * Math.min(1, 0.18 + m.edadMeses / 14)).toFixed(1));
  const nac = new Date(AHORA); nac.setMonth(nac.getMonth() - m.edadMeses);
  const castrado = m.edadMeses >= 6 && chance(0.65);
  const enfermedades = chance(0.18) ? [pick(esPerro ? ENFERMEDADES_PERRO : ENFERMEDADES_GATO)] : [];
  const historial = [{ date: fechaHistorial(pasado(sumar(m.created_at, 1))), title: 'Rescate y primer control', description: `Ingresó al refugio con ${m.edadMeses < 12 ? 'poca edad' : 'buen ánimo'}. Revisación general sin hallazgos graves.` }];
  if (chance(0.7)) historial.push({ date: fechaHistorial(pasado(sumar(m.created_at, 6))), title: 'Desparasitación', description: 'Desparasitación interna y externa. Peso registrado.' });
  if (castrado) historial.push({ date: fechaHistorial(pasado(sumar(m.created_at, int(10, 30)))), title: 'Castración', description: 'Cirugía sin complicaciones. Reposo relativo por 10 días.' });
  const medica = (m.health_status !== 'disponible' && m.health_note) ? m.health_note.split('.')[0] : '';

  return {
    gender: m.hembra ? 'Hembra' : 'Macho',
    birth_date: fecha(nac),
    color_markings: m.raza.color || '',
    microchip_id: chance(0.55) ? microchip() : '',
    weight_kg: peso,
    spayed_neutered: castrado ? 1 : 0,
    vaccinations: JSON.stringify(armarVacunas(esPerro, m.edadMeses)),
    diseases: JSON.stringify(enfermedades),
    treatments: enfermedades.some(e => e.status === 'en_tratamiento') ? 'Tratamiento en curso según indicación veterinaria' : medica,
    allergies: chance(0.9) ? 'Ninguna conocida' : pick(ALERGIAS),
    medical_history: JSON.stringify(historial),
    vet_name: pick(VETS),
    vet_clinic: pick(CLINICAS),
    vet_phone: telefono(zona)
  };
}

function notaSalud(estado, ctx) {
  const d1 = fechaLarga(haceDias(int(3, 14)));
  const d2 = fechaLarga(estado === 'cirugia_programada' ? enDias(int(4, 25)) : enDias(int(3, 20)));
  return texto(pick(NOTAS_SALUD[estado]), ctx)
    .replace(/\{d1\}/g, d1).replace(/\{d2\}/g, d2)
    .replace(/\{op\}/g, pick(OPERACIONES)).replace(/\{cx\}/g, pick(CIRUGIAS));
}

function descripcion(esPerro, ctx) {
  const rasgos = shuffle(esPerro ? RASGOS_PERRO : RASGOS_GATO);
  const partes = [pick(OPENERS), rasgos[0], rasgos[1]];
  if (chance(0.6)) partes.push(pick(REQUISITOS));
  return texto(partes.join(' '), ctx);
}

function construir() {
  const hash = bcrypt.hashSync(CLAVE_DEMO, 10);
  const emails = new Set();
  const emailUnico = (base) => {
    let e = `${base}@${DOMINIO}`; let i = 2;
    while (emails.has(e)) e = `${base}${i++}@${DOMINIO}`;
    emails.add(e); return e;
  };

  const retratos = { mujer: shuffle([...Array(100).keys()]), hombre: shuffle([...Array(100).keys()]) };
  const retrato = (hembra) => `https://randomuser.me/api/portraits/${hembra ? 'women' : 'men'}/${(hembra ? retratos.mujer : retratos.hombre).shift()}.jpg`;

  const datos = { usuarios: [], mascotas: [], carnetsMascota: [], perdidas: [], posts: [], comentarios: [], likes: [], historias: [],
    favoritos: [], chats: [], mensajes: [], notificaciones: [], voluntarios: [], estadias: [], tareas: [], donaciones: [], carnetsUsuario: [] };

  // ---- Usuarios ----
  const refugios = REFUGIOS.map(([nombre, zi, barrio, foco]) => {
    const zona = ZONAS[zi];
    const u = {
      kind: 'refugio', name: nombre, email: emailUnico(`contacto.${slug(nombre)}`), city: `${zona.ciudad}, Argentina`,
      avatar_url: '', lat: jitter(zona.lat, 0.025), lng: jitter(zona.lng, 0.025), role: 'refugio',
      created_at: haceDias(int(150, 330)), zona, barrio, foco: foco || null
    };
    datos.usuarios.push(u); return u;
  });

  const nuevaPersona = (rol) => {
    const hembra = chance(0.55);
    const nombre = pick(hembra ? NOMBRES_F : NOMBRES_M);
    const apellido = pick(APELLIDOS);
    const zona = zonaAlAzar();
    const u = {
      kind: rol, name: `${nombre} ${apellido}`, nombre, apellido, hembra, email: emailUnico(`${slug(nombre)}.${slug(apellido)}`),
      city: `${zona.ciudad}, Argentina`, avatar_url: chance(0.8) ? retrato(hembra) : '',
      lat: jitter(zona.lat, 0.045), lng: jitter(zona.lng, 0.045), role: rol, created_at: haceDias(int(5, 240)), zona
    };
    datos.usuarios.push(u); return u;
  };
  const personas = Array.from({ length: 48 }, () => nuevaPersona('usuario'));
  const voluntarios = Array.from({ length: 12 }, () => nuevaPersona('voluntario'));
  const todasPersonas = [...personas, ...voluntarios];

  // ---- Mascotas ----
  const crearMascota = (dueño, esRefugio) => {
    const soloGatos = dueño.foco === 'gatos';
    const esPerro = soloGatos ? chance(0.08) : chance(0.58);
    const hembra = chance(0.5);
    const raza = weighted((esPerro ? RAZAS_PERRO : RAZAS_GATO).map(r => [r, r.peso]));
    const nombre = pick(esPerro ? (hembra ? NOM_PERRA : NOM_PERRO) : (hembra ? NOM_GATA : NOM_GATO));
    const edadMeses = sorteoEdadMeses();
    const adoptada = chance(0.2);
    const estado = adoptada ? 'disponible' : weighted([['disponible', 78], ['con_cuidado', 9], ['en_reposo', 6], ['cirugia_programada', 7]]);
    const tam = raza.tam || weighted([['Pequeño', 30], ['Mediano', 45], ['Grande', 25]]);
    const ctx = { nombre, hembra };
    const barrio = esRefugio ? dueño.barrio : pick(dueño.zona.barrios);
    const creada = adoptada ? haceDias(int(40, 170)) : haceDias(int(0, 120));
    const m = {
      dueño, esPerro, hembra, raza, edadMeses, adoptada, health_status: estado,
      name: nombre, species: esPerro ? 'Perro' : 'Gato', breed: raza.n, age: edadTexto(edadMeses), size: tam,
      location: `${barrio}, ${dueño.zona.ciudad}`, badge: null, badge_color: null,
      description: descripcion(esPerro, ctx), is_adopted: adoptada ? 1 : 0,
      adopted_quote: adoptada ? texto(pick(CITAS_ADOPCION), ctx) : '', health_note: '',
      created_at: creada, ctx, zona: dueño.zona
    };
    // Clave de foto: la raza concreta (perros con 'Mestizo' eligen una ruta al azar).
    m.fotoClave = esPerro ? `perro:${pick(raza.rutas)}` : `gato:${raza.cat || 'general'}`;
    if (!adoptada) {
      m.health_note = estado === 'disponible' ? '' : notaSalud(estado, ctx);
      const reciente = (AHORA - creada) / 86400000 <= 14;
      if (chance(0.08)) { m.badge = 'Urgente'; m.badge_color = 'primary'; }
      else if (reciente && chance(0.45)) { m.badge = 'Recién Llegado'; m.badge_color = 'secondary'; }
      else if (edadMeses >= 96 && chance(0.35)) { m.badge = 'Senior'; m.badge_color = 'primary'; }
    }
    datos.mascotas.push(m); return m;
  };

  refugios.forEach(r => { for (let i = int(7, 11); i > 0; i--) crearMascota(r, true); });
  for (let i = 0; i < 22; i++) crearMascota(pick(personas), false);
  return { datos, hash, refugios, personas, voluntarios, todasPersonas };
}

// ============================================================
// Acceso a la base
// ============================================================

async function reservarIds(client, tabla, n) {
  if (!n) return [];
  const r = await client.query(`SELECT nextval(pg_get_serial_sequence($1, 'id')) AS id FROM generate_series(1, $2)`, [tabla, n]);
  return r.rows.map(x => Number(x.id));
}

async function insertarVarios(client, tabla, columnas, filas) {
  if (!filas.length) return;
  const porTanda = Math.floor(60000 / columnas.length);
  for (let i = 0; i < filas.length; i += porTanda) {
    const tanda = filas.slice(i, i + porTanda);
    const params = [];
    const valores = tanda.map(fila => `(${fila.map(v => { params.push(v); return `$${params.length}`; }).join(',')})`);
    await client.query(`INSERT INTO ${tabla} (${columnas.join(',')}) VALUES ${valores.join(',')}`, params);
  }
}

// Ids de todo lo que es de demo, en tablas temporales de la transacción.
async function marcarDemo(client) {
  await client.query('DROP TABLE IF EXISTS demo_users, demo_pets, demo_posts, demo_chats');
  await client.query(`CREATE TEMP TABLE demo_users AS SELECT id FROM users WHERE email LIKE '%@${DOMINIO}'`);
  await client.query('CREATE TEMP TABLE demo_pets AS SELECT id FROM pets WHERE user_id IN (SELECT id FROM demo_users)');
  await client.query('CREATE TEMP TABLE demo_posts AS SELECT id FROM posts WHERE user_id IN (SELECT id FROM demo_users)');
  await client.query(`CREATE TEMP TABLE demo_chats AS SELECT id FROM chats
    WHERE pet_id IN (SELECT id FROM demo_pets) OR adopter_id IN (SELECT id FROM demo_users) OR owner_id IN (SELECT id FROM demo_users)`);
}

const CONTEOS = {
  usuarios: 'SELECT COUNT(*) FROM demo_users',
  mascotas: 'SELECT COUNT(*) FROM demo_pets',
  carnets_de_mascota: 'SELECT COUNT(*) FROM pet_carnets WHERE pet_id IN (SELECT id FROM demo_pets)',
  mascotas_perdidas: 'SELECT COUNT(*) FROM lost_pets WHERE user_id IN (SELECT id FROM demo_users)',
  publicaciones: 'SELECT COUNT(*) FROM demo_posts',
  comentarios: 'SELECT COUNT(*) FROM post_comments WHERE user_id IN (SELECT id FROM demo_users) OR post_id IN (SELECT id FROM demo_posts)',
  me_gusta: 'SELECT COUNT(*) FROM post_likes WHERE user_id IN (SELECT id FROM demo_users) OR post_id IN (SELECT id FROM demo_posts)',
  historias: 'SELECT COUNT(*) FROM stories WHERE user_id IN (SELECT id FROM demo_users)',
  favoritos: 'SELECT COUNT(*) FROM favorites WHERE user_id IN (SELECT id FROM demo_users) OR pet_id IN (SELECT id FROM demo_pets)',
  chats: 'SELECT COUNT(*) FROM demo_chats',
  mensajes: 'SELECT COUNT(*) FROM messages WHERE chat_id IN (SELECT id FROM demo_chats)',
  notificaciones: 'SELECT COUNT(*) FROM notifications WHERE user_id IN (SELECT id FROM demo_users)',
  voluntarios: 'SELECT COUNT(*) FROM volunteers WHERE user_id IN (SELECT id FROM demo_users)',
  estadias_en_transito: 'SELECT COUNT(*) FROM foster_stays WHERE pet_id IN (SELECT id FROM demo_pets) OR created_by IN (SELECT id FROM demo_users) OR volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM demo_users))',
  tareas_de_voluntariado: 'SELECT COUNT(*) FROM volunteer_tasks WHERE created_by IN (SELECT id FROM demo_users) OR volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM demo_users))',
  donaciones: 'SELECT COUNT(*) FROM donations WHERE donor_id IN (SELECT id FROM demo_users) OR refugio_id IN (SELECT id FROM demo_users)',
  carnets_de_usuario: 'SELECT COUNT(*) FROM carnets WHERE user_id IN (SELECT id FROM demo_users)'
};

async function contarDemo(client) {
  await marcarDemo(client);
  const resultado = {};
  for (const [clave, sql] of Object.entries(CONTEOS)) resultado[clave] = Number((await client.query(sql)).rows[0].count);
  return resultado;
}

// Borra en orden de dependencias. Solo toca filas que cuelgan de usuarios, mascotas,
// publicaciones o chats de demo.
async function limpiar(client) {
  await marcarDemo(client);
  const pasos = [
    'DELETE FROM messages WHERE chat_id IN (SELECT id FROM demo_chats)',
    'DELETE FROM chats WHERE id IN (SELECT id FROM demo_chats)',
    'DELETE FROM favorites WHERE user_id IN (SELECT id FROM demo_users) OR pet_id IN (SELECT id FROM demo_pets)',
    `DELETE FROM foster_stays WHERE pet_id IN (SELECT id FROM demo_pets) OR created_by IN (SELECT id FROM demo_users)
       OR volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM demo_users))`,
    `DELETE FROM volunteer_tasks WHERE created_by IN (SELECT id FROM demo_users)
       OR volunteer_id IN (SELECT id FROM volunteers WHERE user_id IN (SELECT id FROM demo_users))`,
    'DELETE FROM donations WHERE donor_id IN (SELECT id FROM demo_users) OR refugio_id IN (SELECT id FROM demo_users)',
    'DELETE FROM notifications WHERE user_id IN (SELECT id FROM demo_users)',
    'DELETE FROM pet_carnets WHERE pet_id IN (SELECT id FROM demo_pets)',
    'DELETE FROM pets WHERE id IN (SELECT id FROM demo_pets)',
    'DELETE FROM lost_pets WHERE user_id IN (SELECT id FROM demo_users)',
    'DELETE FROM post_likes WHERE user_id IN (SELECT id FROM demo_users) OR post_id IN (SELECT id FROM demo_posts)',
    'DELETE FROM post_comments WHERE user_id IN (SELECT id FROM demo_users) OR post_id IN (SELECT id FROM demo_posts)',
    'DELETE FROM posts WHERE id IN (SELECT id FROM demo_posts)',
    'DELETE FROM stories WHERE user_id IN (SELECT id FROM demo_users)',
    'DELETE FROM carnets WHERE user_id IN (SELECT id FROM demo_users)',
    'DELETE FROM shelter_suggestions WHERE user_id IN (SELECT id FROM demo_users) OR reviewed_by IN (SELECT id FROM demo_users)',
    'DELETE FROM volunteers WHERE user_id IN (SELECT id FROM demo_users)',
    'DELETE FROM users WHERE id IN (SELECT id FROM demo_users)'
  ];
  for (const sql of pasos) await client.query(sql);
}

// ============================================================
// Carga
// ============================================================

async function cargar(client) {
  const fotos = new Fotos();
  const mundo = construir();
  const { datos, hash, refugios, personas, voluntarios, todasPersonas } = mundo;

  // Cuentas de demo ya existentes: reciben algo de actividad para que su bandeja no esté vacía.
  const existentes = (await client.query(
    `SELECT id, email, name, role FROM users WHERE email IN ('demo@patamatch.com','david@patamatch.com','sarah@patamatch.com')`
  )).rows;
  const cuenta = (email) => existentes.find(u => u.email === email);
  const sarah = cuenta('sarah@patamatch.com');
  const petsDeSarah = sarah
    ? (await client.query('SELECT id, name, user_id, created_at FROM pets WHERE user_id = $1 AND is_adopted = 0', [sarah.id])).rows
    : [];

  // ---- Fotos: se cuenta cuántas hacen falta por clave y se piden juntas ----
  const necesidades = new Map();
  const pedir = (clave, n = 1) => necesidades.set(clave, (necesidades.get(clave) || 0) + n);
  datos.mascotas.forEach(m => pedir(m.fotoClave));
  // Mascotas perdidas y mascotas propias con carnet: la raza se sortea ANTES que la
  // foto, para que la foto y la raza que se muestra coincidan.
  const planAnimal = () => {
    const esPerro = chance(0.6);
    const raza = esPerro ? pick(RAZAS_PERRO) : pick(RAZAS_GATO);
    const hembra = chance(0.5);
    const nombre = pick(esPerro ? (hembra ? NOM_PERRA : NOM_PERRO) : (hembra ? NOM_GATA : NOM_GATO));
    return { esPerro, raza, hembra, nombre, foto: esPerro ? `perro:${pick(raza.rutas)}` : `gato:${raza.cat || 'general'}` };
  };
  const LOST_N = 26; const CARNETS_USER = 20;
  const planPerdidas = Array.from({ length: LOST_N }, planAnimal);
  const planCarnets = Array.from({ length: CARNETS_USER }, planAnimal);
  [...planPerdidas, ...planCarnets].forEach(p => pedir(p.foto));
  refugios.forEach(() => pedir('perro:mix'));
  console.log(`Pidiendo fotos (${[...necesidades.values()].reduce((a, b) => a + b, 0)} en ${necesidades.size} grupos)...`);
  await fotos.precargar(necesidades);
  datos.mascotas.forEach(m => { m.image_url = fotos.siguiente(m.fotoClave); });
  refugios.forEach(r => { r.avatar_url = fotos.siguiente('perro:mix'); });

  // ---- Ids (se reservan de la secuencia, así no dependemos del orden de RETURNING) ----
  const idsUsuarios = await reservarIds(client, 'users', datos.usuarios.length);
  datos.usuarios.forEach((u, i) => { u.id = idsUsuarios[i]; });
  const idsMascotas = await reservarIds(client, 'pets', datos.mascotas.length);
  datos.mascotas.forEach((m, i) => { m.id = idsMascotas[i]; });

  // ---- Carnets de las mascotas en adopción ----
  datos.mascotas.filter(m => !m.adoptada && chance(0.87)).forEach(m => { datos.carnetsMascota.push({ m, c: armarCarnet(m, m.zona) }); });

  // ---- Chats, mensajes y notificaciones ----
  const parAdoptante = new Set();
  const nuevoChat = (m, adoptante, estado, creado) => {
    const clave = `${m.id}:${adoptante.id}`;
    if (parAdoptante.has(clave) || adoptante.id === m.dueño?.id) return null;
    parAdoptante.add(clave);
    const chat = { m, adoptante, dueñoId: m.dueño.id, dueño: m.dueño, estado, created_at: creado };
    datos.chats.push(chat); return chat;
  };

  const recibe = (u) => !!u.kind; // solo los usuarios de demo reciben notificaciones (las de cuentas reales no se tocan)
  datos.mascotas.forEach(m => {
    if (m.adoptada) {
      const adoptante = pick(personas);
      const chat = nuevoChat(m, adoptante, 'aprobada', pasado(sumar(m.created_at, int(2, 15))));
      if (chat) { m.adoptante = adoptante; m.fechaAdopcion = pasado(sumar(chat.created_at, int(2, 12))); }
    } else if (chance(0.4)) {
      for (let i = int(1, 3); i > 0; i--) nuevoChat(m, pick(todasPersonas), chance(0.72) ? 'pendiente' : 'rechazada', pasado(sumar(m.created_at, int(1, 20))));
    }
  });
  // Actividad con las cuentas de demo que ya existen.
  const demo = cuenta('demo@patamatch.com');
  if (demo) {
    shuffle(datos.mascotas.filter(m => !m.adoptada)).slice(0, 4).forEach((m, i) =>
      nuevoChat(m, { id: demo.id, name: demo.name, nombre: 'Demo', existente: true }, i === 0 ? 'rechazada' : 'pendiente', haceDias(int(1, 12))));
  }
  petsDeSarah.slice(0, 3).forEach(p => {
    const adoptante = pick(personas);
    const clave = `${p.id}:${adoptante.id}`;
    if (parAdoptante.has(clave)) return;
    parAdoptante.add(clave);
    datos.chats.push({ m: { id: p.id, name: p.name, esPerro: p.name !== 'Luna', hembra: p.name === 'Luna' }, adoptante, dueñoId: sarah.id, dueño: { id: sarah.id, existente: true },
      estado: 'pendiente', created_at: haceDias(int(1, 10)) });
  });

  const idsChats = await reservarIds(client, 'chats', datos.chats.length);
  datos.chats.forEach((c, i) => { c.id = idsChats[i]; });

  datos.chats.forEach(c => {
    const nombrePila = c.adoptante.nombre || (c.adoptante.name || 'Hola').split(' ')[0];
    const hembra = !!c.m.hembra;
    const contexto = {
      pet: c.m.name, adopter: nombrePila, especie: c.m.esPerro === false ? 'gato' : 'perro',
      o: hembra ? 'a' : 'o', lo: hembra ? 'la' : 'lo',
      castrado: hembra ? 'Está castrada.' : 'Está castrado.'
    };
    const guion = c.estado === 'rechazada' ? CONVERSACION_RECHAZO(contexto) : pick(CONVERSACIONES)(contexto);
    let momento = c.created_at;
    guion.forEach(([quien, cuerpo]) => {
      momento = sumar(momento, 0, int(1, 20) + (chance(0.3) ? int(10, 40) : 0));
      if (momento > AHORA) momento = AHORA;
      datos.mensajes.push({ chat_id: c.id, sender_id: quien === 'a' ? c.adoptante.id : c.dueñoId, body: cuerpo, created_at: momento });
    });
    if (c.estado === 'pendiente' && recibe(c.dueño) && !c.dueño.existente) {
      datos.notificaciones.push({ user_id: c.dueñoId, type: 'adoption_request', related_id: c.id,
        text: `${c.adoptante.name} quiere adoptar a ${c.m.name}. ¡Abre el chat para conversar!`, is_read: chance(0.45) ? 1 : 0, created_at: pasado(sumar(c.created_at, 0, 1)) });
    }
    if (c.estado !== 'pendiente' && recibe(c.adoptante) && !c.adoptante.existente) {
      datos.notificaciones.push({ user_id: c.adoptante.id, type: 'adoption_status', related_id: c.id,
        text: c.estado === 'aprobada' ? `¡Buenas noticias! Aprobaron tu solicitud para adoptar a ${c.m.name}` : `Tu solicitud para adoptar a ${c.m.name} no prosperó esta vez`,
        is_read: chance(0.8) ? 1 : 0, created_at: pasado(sumar(momento, 0, int(1, 6))) });
    }
  });

  // ---- Historias de éxito (de las adopciones concretadas) ----
  // Solo de mascotas que dio un refugio: el texto agradece al refugio por su nombre.
  shuffle(datos.mascotas.filter(m => m.adoptada && m.adoptante && m.dueño.kind === 'refugio')).slice(0, 18).forEach(m => {
    const ctx = m.ctx;
    const refugio = m.dueño.name;
    datos.historias.push({
      pet_name: m.name, author_name: `Familia ${m.adoptante.apellido || m.adoptante.name.split(' ').slice(-1)[0]}`,
      title: texto(pick(HISTORIAS_TITULOS), ctx),
      body: texto(pick(HISTORIAS_CUERPOS), ctx).replace(/\{refugio\}/g, refugio).replace(/\{tiempo\}/g, pick(['unas semanas', 'dos meses', 'seis meses', 'casi un año'])),
      image_url: m.image_url, badge: weighted(HISTORIAS_BADGES), is_approved: 1, user_id: m.adoptante.id,
      created_at: pasado(sumar(m.fechaAdopcion, int(3, 25)))
    });
  });

  // ---- Favoritos ----
  const disponibles = datos.mascotas.filter(m => !m.adoptada);
  const parFav = new Set();
  const fav = (userId, mascota) => { const k = `${userId}:${mascota.id}`; if (!parFav.has(k) && mascota.dueño.id !== userId) { parFav.add(k); datos.favoritos.push([userId, mascota.id]); } };
  personas.forEach(p => shuffle(disponibles).slice(0, int(2, 7)).forEach(m => fav(p.id, m)));
  if (demo) shuffle(disponibles).slice(0, 6).forEach(m => fav(demo.id, m));

  // ---- Mascotas perdidas ----
  const lugares = ['cerca de la plaza', 'por la avenida principal', 'cerca de la terminal', 'por el parque', 'a pocas cuadras de casa', 'cerca del río', 'por el centro comercial', 'saliendo de la veterinaria'];
  const haceTexto = (h) => (h < 24 ? `Hace ${h} hora${h === 1 ? '' : 's'}` : (h < 48 ? 'Ayer' : `Hace ${Math.floor(h / 24)} días`));
  planPerdidas.forEach((plan, i) => {
    const { raza, hembra, nombre } = plan;
    const dueño = pick(personas);
    const encontrada = i >= 18; // las últimas 8 ya aparecieron y no se muestran en el mapa
    const horas = encontrada ? int(96, 400) : weighted([[int(1, 8), 35], [int(9, 30), 35], [int(31, 120), 30]]);
    const zona = dueño.zona;
    const lat = jitter(zona.lat, 0.035); const lng = jitter(zona.lng, 0.035);
    const ctx = { nombre, hembra };
    datos.perdidas.push({
      name: nombre, breed: raza.n, location: `${pick(zona.barrios)}, ${zona.ciudad}`,
      last_seen: `${haceTexto(horas)}, ${pick(lugares)}`,
      description: texto(pick([
        '{Nombre} se perdió {l}. Es muy cariños{o}, responde a su nombre y se asusta con los ruidos fuertes.',
        'Se escapó mientras paseábamos. {Nombre} es tranquil{o}, no muerde y va a querer esconderse. Por favor avisen si {lo} ven.',
        'Salió del patio y no volvió. {Nombre} está {chip}. Si {lo} ven, no {lo} persigan: llamen y se acerca.',
        '{Nombre} desapareció {l}. La familia {lo} extraña muchísimo. Cualquier dato ayuda.'
      ]), ctx).replace(/\{l\}/g, pick(lugares)).replace(/\{chip\}/g, chance(0.4) ? 'con chip' : 'muy dócil con la gente'),
      image_url: fotos.siguiente(plan.foto), badge: !encontrada && horas <= 30 && chance(0.7) ? 'Urgente' : null,
      lat, lng, is_found: encontrada ? 1 : 0, user_id: dueño.id, created_at: haceDias(0, horas)
    });
  });
  datos.perdidas.forEach(p => { p.marker_image = p.image_url; });

  // ---- Comunidad ----
  const autores = [...personas, ...voluntarios];
  const interactuan = [...autores.map(u => u.id), ...existentes.map(u => u.id)];
  const idsPosts = await reservarIds(client, 'posts', POSTS.length);
  POSTS.forEach(([categoria, titulo, cuerpo, tags], i) => {
    const creado = haceDias(int(1, 75), int(0, 20));
    const post = { id: idsPosts[i], title: titulo, body: cuerpo, category: categoria, tags: JSON.stringify(tags), user_id: pick(autores).id, created_at: creado };
    datos.posts.push(post);
    const nComentarios = chance(0.8) ? int(1, 6) : 0;
    const respondieron = shuffle(interactuan).slice(0, nComentarios);
    respondieron.forEach(uid => datos.comentarios.push({ post_id: post.id, user_id: uid, body: pick(COMENTARIOS[categoria]), created_at: pasado(sumar(creado, 0, int(2, 140))) }));
    shuffle(interactuan).slice(0, int(2, 22)).forEach(uid => datos.likes.push([post.id, uid]));
  });

  // ---- Voluntarios y hogares de tránsito ----
  const idsVol = await reservarIds(client, 'volunteers', voluntarios.length);
  voluntarios.forEach((u, i) => {
    datos.voluntarios.push({
      id: idsVol[i], user_id: u.id, phone: telefono(u.zona), capacity: int(1, 3),
      accepts_species: weighted([['ambos', 50], ['perro', 25], ['gato', 25]]),
      accepts_sizes: JSON.stringify(weighted([[['pequeno', 'mediano', 'grande'], 25], [['pequeno', 'mediano'], 40], [['pequeno'], 20], [['mediano', 'grande'], 15]])),
      has_yard: chance(0.55) ? 1 : 0, has_other_pets: chance(0.35) ? 1 : 0, max_weeks: weighted([[4, 20], [8, 40], [12, 25], [null, 15]]),
      notes: pick(NOTAS_VOLUNTARIO), is_active: 1, created_at: pasado(sumar(u.created_at, int(1, 20))), u
    });
  });
  const tamClave = { Pequeño: 'pequeno', Mediano: 'mediano', Grande: 'grande' };
  const ocupadas = new Set();
  const estadias = [];
  const candidatas = shuffle(disponibles.filter(m => m.dueño.kind === 'refugio'))
    .sort((a, b) => (a.health_status === 'disponible') - (b.health_status === 'disponible')); // primero los que se recuperan
  datos.voluntarios.forEach(v => {
    if (!chance(0.75)) return;
    let libres = v.capacity;
    const acepta = JSON.parse(v.accepts_sizes);
    for (const m of candidatas) {
      if (!libres) break;
      if (ocupadas.has(m.id)) continue;
      if (v.accepts_species !== 'ambos' && v.accepts_species !== m.species.toLowerCase()) continue;
      if (!acepta.includes(tamClave[m.size])) continue;
      ocupadas.add(m.id); libres--;
      const inicio = haceDias(int(4, 55));
      estadias.push({ volunteer_id: v.id, pet_id: m.id, created_by: m.dueño.id, start_date: fecha(inicio), end_date: null, status: 'activa', notes: pick(NOTAS_TRANSITO), created_at: inicio });
    }
  });
  for (let i = 0; i < 14; i++) {
    const m = pick(datos.mascotas.filter(x => x.dueño.kind === 'refugio'));
    const v = pick(datos.voluntarios);
    const inicio = haceDias(int(60, 170)); const fin = sumar(inicio, int(14, 70));
    estadias.push({ volunteer_id: v.id, pet_id: m.id, created_by: m.dueño.id, start_date: fecha(inicio), end_date: fecha(fin), status: chance(0.9) ? 'finalizada' : 'cancelada', notes: pick(NOTAS_TRANSITO), created_at: inicio });
  }
  datos.estadias = estadias;

  const tareas = [];
  TAREAS.forEach(([titulo, desc]) => {
    for (let k = int(1, 2); k > 0; k--) {
      const refugio = pick(refugios);
      const estado = weighted([['pendiente', 35], ['aceptada', 30], ['completada', 30], ['cancelada', 5]]);
      const futuro = estado === 'pendiente' || estado === 'aceptada';
      tareas.push({
        volunteer_id: estado === 'pendiente' ? null : pick(datos.voluntarios).id, created_by: refugio.id, title: titulo, description: desc,
        task_date: fecha(futuro ? enDias(int(1, 30)) : haceDias(int(1, 45))), status: estado, created_at: haceDias(int(2, 60))
      });
    }
  });
  datos.tareas = tareas;

  // ---- Donaciones ----
  const donantes = [...personas, ...existentes.filter(u => u.email !== 'sarah@patamatch.com')];
  for (let i = 0; i < 90; i++) {
    const refugio = pick(refugios); const donante = pick(donantes);
    const tipo = chance(0.62) ? 'dinero' : 'especie';
    const estado = weighted([['recibida', 55], ['comprometida', 35], ['cancelada', 10]]);
    const creada = haceDias(int(1, 110), int(0, 20));
    datos.donaciones.push({
      donor_id: donante.id, donorName: donante.name, refugio, tipo, monto: tipo === 'dinero' ? pick([3000, 5000, 8000, 10000, 15000, 20000, 30000, 50000]) : null,
      descripcion: tipo === 'especie' ? pick(DON_ESPECIE) : '', estado, notas: chance(0.3) ? pick(DON_NOTAS) : '', created_at: creada,
      recibida_at: estado === 'recibida' ? pasado(sumar(creada, int(1, 6))) : null
    });
  }
  const idsDon = await reservarIds(client, 'donations', datos.donaciones.length);
  datos.donaciones.forEach((d, i) => { d.id = idsDon[i]; });
  datos.donaciones.forEach(d => {
    const detalle = d.tipo === 'dinero' ? `$${d.monto}` : d.descripcion;
    datos.notificaciones.push({ user_id: d.refugio.id, type: 'donation', related_id: d.id, text: `${d.donorName} se comprometió a donar ${detalle}`, is_read: chance(0.6) ? 1 : 0, created_at: d.created_at });
    if (d.estado === 'recibida' && personas.some(p => p.id === d.donor_id)) {
      datos.notificaciones.push({ user_id: d.donor_id, type: 'donation', related_id: d.id, text: '¡Gracias! El refugio confirmó que recibió tu donación', is_read: chance(0.75) ? 1 : 0, created_at: d.recibida_at });
    }
  });

  // ---- Carnet de la mascota propia de algunos usuarios ----
  shuffle(personas).slice(0, CARNETS_USER).forEach((u, i) => {
    const { esPerro, raza, hembra, nombre } = planCarnets[i];
    const meses = int(8, 120);
    const nac = new Date(AHORA); nac.setMonth(nac.getMonth() - meses);
    datos.carnetsUsuario.push({
      pet_name: nombre, species: esPerro ? 'Canino (Perro)' : 'Felino (Gato)', breed: raza.n,
      gender: hembra ? 'Hembra' : 'Macho', color_markings: raza.color || '', microchip_id: microchip(), image_url: fotos.siguiente(planCarnets[i].foto), qr_url: '',
      birth_date: fecha(nac), vaccinations: JSON.stringify(armarVacunas(esPerro, meses)),
      medical_history: JSON.stringify([{ date: fechaHistorial(haceDias(int(20, 300))), title: 'Control anual', description: 'Revisación general en excelente estado.' }]),
      vet_name: pick(VETS), vet_clinic: pick(CLINICAS), vet_phone: telefono(u.zona), vet_image: '', owner_name: u.name, owner_city: u.city, user_id: u.id
    });
  });

  // ---- Escritura ----
  console.log('Guardando...');
  await insertarVarios(client, 'users', ['id', 'name', 'email', 'password_hash', 'city', 'avatar_url', 'lat', 'lng', 'role', 'created_at'],
    datos.usuarios.map(u => [u.id, u.name, u.email, hash, u.city, u.avatar_url, u.lat, u.lng, u.role, tiempo(u.created_at)]));
  await insertarVarios(client, 'pets',
    ['id', 'name', 'species', 'breed', 'age', 'size', 'location', 'image_url', 'badge', 'badge_color', 'description', 'is_adopted', 'adopted_quote', 'user_id', 'health_status', 'health_note', 'created_at'],
    datos.mascotas.map(m => [m.id, m.name, m.species, m.breed, m.age, m.size, m.location, m.image_url, m.badge, m.badge_color, m.description, m.is_adopted, m.adopted_quote, m.dueño.id, m.health_status, m.health_note, tiempo(m.created_at)]));
  await insertarVarios(client, 'pet_carnets',
    ['pet_id', 'gender', 'birth_date', 'color_markings', 'microchip_id', 'weight_kg', 'spayed_neutered', 'vaccinations', 'diseases', 'treatments', 'allergies', 'medical_history', 'vet_name', 'vet_clinic', 'vet_phone', 'updated_at'],
    datos.carnetsMascota.map(({ m, c }) => [m.id, c.gender, c.birth_date, c.color_markings, c.microchip_id, c.weight_kg, c.spayed_neutered, c.vaccinations, c.diseases, c.treatments, c.allergies, c.medical_history, c.vet_name, c.vet_clinic, c.vet_phone, tiempo(pasado(sumar(m.created_at, 2)))]));
  await insertarVarios(client, 'lost_pets',
    ['name', 'breed', 'location', 'last_seen', 'description', 'image_url', 'badge', 'marker_top', 'marker_left', 'marker_image', 'is_found', 'user_id', 'lat', 'lng', 'created_at'],
    datos.perdidas.map(p => [p.name, p.breed, p.location, p.last_seen, p.description, p.image_url, p.badge, String(p.lat), String(p.lng), p.marker_image, p.is_found, p.user_id, p.lat, p.lng, tiempo(p.created_at)]));
  await insertarVarios(client, 'posts', ['id', 'title', 'body', 'category', 'tags', 'user_id', 'created_at'],
    datos.posts.map(p => [p.id, p.title, p.body, p.category, p.tags, p.user_id, tiempo(p.created_at)]));
  await insertarVarios(client, 'post_comments', ['post_id', 'user_id', 'body', 'created_at'],
    datos.comentarios.map(c => [c.post_id, c.user_id, c.body, tiempo(c.created_at)]));
  const likesUnicos = [...new Map(datos.likes.map(l => [l.join(':'), l])).values()];
  await insertarVarios(client, 'post_likes', ['post_id', 'user_id'], likesUnicos);
  await insertarVarios(client, 'stories', ['pet_name', 'author_name', 'title', 'body', 'image_url', 'badge', 'is_approved', 'user_id', 'created_at'],
    datos.historias.map(h => [h.pet_name, h.author_name, h.title, h.body, h.image_url, h.badge, h.is_approved, h.user_id, tiempo(h.created_at)]));
  await insertarVarios(client, 'favorites', ['user_id', 'pet_id'], datos.favoritos);
  await insertarVarios(client, 'chats', ['id', 'pet_id', 'adopter_id', 'owner_id', 'status', 'created_at'],
    datos.chats.map(c => [c.id, c.m.id, c.adoptante.id, c.dueñoId, c.estado, tiempo(c.created_at)]));
  await insertarVarios(client, 'messages', ['chat_id', 'sender_id', 'body', 'created_at'],
    datos.mensajes.map(x => [x.chat_id, x.sender_id, x.body, tiempo(x.created_at)]));
  await insertarVarios(client, 'volunteers',
    ['id', 'user_id', 'phone', 'capacity', 'accepts_species', 'accepts_sizes', 'has_yard', 'has_other_pets', 'max_weeks', 'notes', 'is_active', 'created_at'],
    datos.voluntarios.map(v => [v.id, v.user_id, v.phone, v.capacity, v.accepts_species, v.accepts_sizes, v.has_yard, v.has_other_pets, v.max_weeks, v.notes, v.is_active, tiempo(v.created_at)]));
  await insertarVarios(client, 'foster_stays', ['volunteer_id', 'pet_id', 'created_by', 'start_date', 'end_date', 'status', 'notes', 'created_at'],
    datos.estadias.map(e => [e.volunteer_id, e.pet_id, e.created_by, e.start_date, e.end_date, e.status, e.notes, tiempo(e.created_at)]));
  await insertarVarios(client, 'volunteer_tasks', ['volunteer_id', 'created_by', 'title', 'description', 'task_date', 'status', 'created_at'],
    datos.tareas.map(t => [t.volunteer_id, t.created_by, t.title, t.description, t.task_date, t.status, tiempo(t.created_at)]));
  await insertarVarios(client, 'donations', ['id', 'donor_id', 'refugio_id', 'tipo', 'monto', 'descripcion', 'estado', 'notas', 'created_at', 'recibida_at'],
    datos.donaciones.map(d => [d.id, d.donor_id, d.refugio.id, d.tipo, d.monto, d.descripcion, d.estado, d.notas, tiempo(d.created_at), d.recibida_at ? tiempo(d.recibida_at) : null]));
  await insertarVarios(client, 'carnets',
    ['pet_name', 'species', 'breed', 'gender', 'color_markings', 'microchip_id', 'image_url', 'qr_url', 'birth_date', 'vaccinations', 'medical_history', 'vet_name', 'vet_clinic', 'vet_phone', 'vet_image', 'owner_name', 'owner_city', 'user_id'],
    datos.carnetsUsuario.map(c => [c.pet_name, c.species, c.breed, c.gender, c.color_markings, c.microchip_id, c.image_url, c.qr_url, c.birth_date, c.vaccinations, c.medical_history, c.vet_name, c.vet_clinic, c.vet_phone, c.vet_image, c.owner_name, c.owner_city, c.user_id]));
  await insertarVarios(client, 'notifications', ['user_id', 'type', 'related_id', 'text', 'is_read', 'created_at'],
    datos.notificaciones.map(n => [n.user_id, n.type, n.related_id, n.text, n.is_read, tiempo(n.created_at)]));

  return { datos, ejemplos: { refugio: refugios[0].email, usuario: personas[0].email, voluntario: voluntarios[0].email } };
}

// Algunas filas generadas, para revisar a ojo que los textos y las fotos tengan sentido.
function mostrarMuestras(datos) {
  const linea = (s) => console.log(`  ${s}`);
  console.log('\nMuestras de lo generado:');
  const conSalud = datos.mascotas.filter(m => !m.adoptada && m.health_note).slice(0, 2);
  [...shuffle(datos.mascotas.filter(m => !m.adoptada && !m.health_note)).slice(0, 3), ...conSalud].forEach(m => {
    linea(`MASCOTA  ${m.name} · ${m.species} · ${m.breed} · ${m.age} · ${m.size} · ${m.location}${m.badge ? ` · [${m.badge}]` : ''} · ${m.health_status}`);
    linea(`         ${m.description}`);
    if (m.health_note) linea(`         Salud: ${m.health_note}`);
    linea(`         ${m.image_url}`);
  });
  const adoptada = datos.mascotas.find(m => m.adoptada && m.adoptante);
  if (adoptada) linea(`ADOPTADA ${adoptada.name} (${adoptada.breed}) ${adoptada.adopted_quote}`);
  const h = datos.historias[0];
  if (h) { linea(`HISTORIA ${h.title} — ${h.author_name} [${h.badge}]`); linea(`         ${h.body}`); }
  const p = datos.perdidas[0];
  if (p) { linea(`PERDIDA  ${p.name} · ${p.breed} · ${p.location} · ${p.last_seen}`); linea(`         ${p.description}`); }
  const c = datos.chats.find(x => x.estado === 'aprobada') || datos.chats[0];
  if (c) {
    linea(`CHAT     ${c.adoptante.name} → ${c.m.name} (${c.estado})`);
    datos.mensajes.filter(x => x.chat_id === c.id).forEach(x => linea(`         ${x.sender_id === c.adoptante.id ? 'A' : 'R'}: ${x.body}`));
  }
  const d = datos.donaciones[0];
  if (d) linea(`DONACION ${d.donorName} → ${d.refugio.name}: ${d.tipo === 'dinero' ? `$${d.monto}` : d.descripcion} (${d.estado})`);
  const e = datos.carnetsMascota[0];
  if (e) linea(`CARNET   ${e.m.name}: ${e.c.gender}, ${e.c.weight_kg} kg, vacunas ${e.c.vaccinations}`);
}

// ============================================================
// Programa principal
// ============================================================

function preguntar(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(pregunta, r => { rl.close(); resolve(/^(s|si|sí|y|yes)$/i.test(r.trim())); }));
}

function mostrarConteos(titulo, conteos) {
  console.log(`\n${titulo}`);
  Object.entries(conteos).forEach(([k, v]) => console.log(`  ${k.replace(/_/g, ' ').padEnd(26)} ${v}`));
}

async function main() {
  if (args.has('--ayuda') || args.has('-h')) { console.log(AYUDA); return; }
  if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL en el archivo .env'); process.exit(1); }

  const modo = args.has('--limpiar') ? 'limpiar' : args.has('--prueba') ? 'prueba' : args.has('--recargar') ? 'recargar' : 'cargar';
  const host = new URL(process.env.DATABASE_URL).host;
  console.log(`Base de datos: ${host}`);

  if (modo !== 'prueba' && !args.has('--si')) {
    const accion = modo === 'limpiar' ? 'BORRAR los datos de demo de'
      : modo === 'recargar' ? 'BORRAR y volver a cargar los datos de demo en'
      : 'cargar muchos datos de demo en';
    const ok = await preguntar(`¿Querés ${accion} esta base? Si es la base de tu sitio publicado, los visitantes los van a ver. (s/N) `);
    if (!ok) { console.log('Cancelado. No se tocó nada.'); return; }
  }

  await initDatabase(); // crea las tablas que falten
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false }, max: 1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const previos = await contarDemo(client);
    const hayDatos = previos.usuarios > 0;

    if (modo === 'limpiar') {
      await limpiar(client);
      mostrarConteos('Se borró:', previos);
    } else {
      if (hayDatos && modo === 'cargar') {
        console.error(`\nYa hay datos de demo (${previos.usuarios} usuarios). Usá --recargar para reemplazarlos o --limpiar para borrarlos.`);
        await client.query('ROLLBACK');
        process.exitCode = 1; return;
      }
      if (hayDatos) { await limpiar(client); console.log(`Se borraron los datos de demo anteriores (${previos.usuarios} usuarios).`); }

      const { datos, ejemplos } = await cargar(client);
      const nuevos = await contarDemo(client);
      mostrarConteos(modo === 'prueba' ? 'Se cargaría (ensayo):' : 'Se cargó:', nuevos);
      if (modo === 'prueba') mostrarMuestras(datos);

      if (modo === 'prueba') {
        // El ensayo también prueba la limpieza: tiene que dejar todo en cero.
        await limpiar(client);
        const restos = await contarDemo(client);
        const sobran = Object.entries(restos).filter(([, v]) => v > 0);
        if (sobran.length) throw new Error(`La limpieza dejó filas: ${sobran.map(([k, v]) => `${k}=${v}`).join(', ')}`);
        console.log('\nLa limpieza deja todo en cero. Ensayo OK: se deshace la transacción, no se guardó nada.');
      } else {
        console.log(`\nTodas las cuentas de demo usan la contraseña "${CLAVE_DEMO}". Por ejemplo:`);
        console.log(`  refugio    ${ejemplos.refugio}`);
        console.log(`  usuario    ${ejemplos.usuario}`);
        console.log(`  voluntario ${ejemplos.voluntario}`);
        console.log('\nPara borrar todo esto: node scripts/seed-demo.js --limpiar');
      }
    }

    await client.query(modo === 'prueba' ? 'ROLLBACK' : 'COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().then(() => process.exit(process.exitCode || 0)).catch(err => { console.error('\nError:', err.message); process.exit(1); });
