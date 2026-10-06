const router = require('express').Router();
const { queryAll } = require('../db/database');

// Directorio público de refugios verificados, con su ubicación para el mapa.
// La ubicación es "mi zona" (users.lat/lng), el mismo punto que fija cualquier
// usuario en su perfil: un refugio sin zona aparece en el listado pero no en el
// mapa, y se le indica que la complete desde su perfil.
router.get('/', async (req, res) => {
  try {
    const refugios = await queryAll(`
      SELECT u.id, u.name, u.city, u.avatar_url, u.lat, u.lng, u.created_at,
             (SELECT COUNT(*) FROM pets p WHERE p.user_id = u.id AND p.is_adopted = 0) AS en_adopcion,
             (SELECT COUNT(*) FROM pets p WHERE p.user_id = u.id AND p.is_adopted = 1) AS adoptadas,
             (SELECT COUNT(*) FROM foster_stays s JOIN pets p ON p.id = s.pet_id
               WHERE p.user_id = u.id AND s.status = 'activa') AS en_transito
      FROM users u
      WHERE u.role = 'refugio'
      ORDER BY u.name
    `);

    res.json({
      success: true,
      data: refugios.map(r => ({
        ...r,
        lat: r.lat == null ? null : Number(r.lat),
        lng: r.lng == null ? null : Number(r.lng),
        en_adopcion: Number(r.en_adopcion),
        adoptadas: Number(r.adoptadas),
        en_transito: Number(r.en_transito)
      }))
    });
  } catch (err) {
    console.error('Listar refugios error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shelters' });
  }
});

// ---------- Refugios externos (búsqueda en la zona) ----------
//
// Además de los refugios registrados en PataMatch, el mapa muestra los que
// existen en la zona visible según un proveedor externo:
//   - Google Places (Text Search) si hay GOOGLE_MAPS_API_KEY configurada. Es la
//     única fuente con cobertura completa: varias búsquedas, paginadas, dentro
//     del recuadro del mapa.
//   - OpenStreetMap (Nominatim, amenity=animal_shelter) como respaldo sin clave
//     o si Google falla. Solo trae lo que alguien cargó en OSM, que en muchas
//     ciudades es poco o nada.
// La llamada se hace desde el servidor para no exponer la clave al navegador,
// y se cachea 10 minutos por zona para cuidar la cuota.

const cacheExternos = new Map();
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
const GRILLA = 0.05;   // grados (~5 km): zonas vecinas comparten caché
const SPAN_MAX = 2;    // grados: tope del recuadro de búsqueda (~220 km)

const BUSQUEDAS_GOOGLE = ['refugio de animales', 'protectora de animales y rescate animal', 'animal shelter'];
const PAGINAS_GOOGLE = 3; // 20 resultados por página, hasta 60 por búsqueda

// "Refugio" también es una casilla de montaña, y una veterinaria o tienda puede
// aparecer en la búsqueda: solo se descartan si no se presentan como refugio.
const TIPOS_NO_REFUGIO = ['lodging', 'campground', 'restaurant', 'food', 'place_of_worship', 'church', 'school', 'tourist_attraction', 'park'];
const TIPOS_COMERCIO = ['pet_store', 'store', 'veterinary_care'];
const RE_NOMBRE_REFUGIO = /refugio|protectora|rescat|albergue|santuario|adopci|hogar de|shelter|rescue|sanctuary/i;

// Recuadro { s, w, n, e } a partir de la consulta. Acepta el recuadro visible
// del mapa (s, w, n, e) o, por compatibilidad, un centro con radio en metros.
function leerRecuadro(q) {
  const num = (v) => (v === undefined || v === '' ? NaN : Number(v));
  let s = num(q.s), w = num(q.w), n = num(q.n), e = num(q.e);

  if (![s, w, n, e].every(Number.isFinite)) {
    const lat = num(q.lat), lng = num(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const radio = Math.min(50000, Math.max(1000, Number(q.radio) || 15000));
    const dLat = radio / 111000;
    const dLng = dLat / Math.max(0.2, Math.cos(lat * Math.PI / 180));
    s = lat - dLat; n = lat + dLat; w = lng - dLng; e = lng + dLng;
  }

  s = Math.max(-85, s); n = Math.min(85, n);
  w = Math.max(-180, w); e = Math.min(180, e);
  if (!(s < n) || !(w < e)) return null;

  // Un mapa muy alejado se acota alrededor de su centro.
  const acotar = (a, b) => (b - a > SPAN_MAX ? [(a + b) / 2 - SPAN_MAX / 2, (a + b) / 2 + SPAN_MAX / 2] : [a, b]);
  [s, n] = acotar(s, n);
  [w, e] = acotar(w, e);

  // Se ajusta hacia afuera a la grilla para que paneos pequeños reutilicen la caché.
  const redondear = (v, f) => Number((f(v / GRILLA) * GRILLA).toFixed(2));
  return { s: redondear(s, Math.floor), w: redondear(w, Math.floor), n: redondear(n, Math.ceil), e: redondear(e, Math.ceil) };
}

function esRefugio(p) {
  if (p.businessStatus === 'CLOSED_PERMANENTLY') return false;
  const tipos = p.types || [];
  if (tipos.includes('animal_shelter')) return true;
  if (tipos.some(t => TIPOS_NO_REFUGIO.includes(t))) return false;
  if (tipos.some(t => TIPOS_COMERCIO.includes(t))) return RE_NOMBRE_REFUGIO.test(p.displayName?.text || '');
  return true;
}

async function paginaGoogle(texto, r, pageToken) {
  const body = {
    textQuery: texto,
    languageCode: 'es',
    pageSize: 20,
    locationRestriction: {
      rectangle: { low: { latitude: r.s, longitude: r.w }, high: { latitude: r.n, longitude: r.e } }
    }
  };
  if (pageToken) body.pageToken = pageToken;

  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.nationalPhoneNumber,places.types,places.businessStatus,nextPageToken'
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000)
  });
  if (!resp.ok) {
    const detalle = (await resp.text()).slice(0, 300);
    throw new Error(`Google Places respondió ${resp.status}: ${detalle}`);
  }
  return resp.json();
}

// Una búsqueda de texto con todas sus páginas. Si falla la primera, se propaga
// el error; si falla una posterior, se conserva lo ya obtenido.
async function buscarTextoGoogle(texto, r) {
  const lugares = [];
  let token;
  for (let pagina = 0; pagina < PAGINAS_GOOGLE; pagina++) {
    let json;
    try {
      json = await paginaGoogle(texto, r, token);
    } catch (err) {
      if (pagina === 0) throw err;
      console.error('Google Places, página siguiente:', err.message);
      break;
    }
    lugares.push(...(json.places || []));
    token = json.nextPageToken;
    if (!token) break;
  }
  return lugares;
}

async function buscarEnGoogle(r) {
  const resultados = await Promise.allSettled(BUSQUEDAS_GOOGLE.map(t => buscarTextoGoogle(t, r)));
  const ok = resultados.filter(x => x.status === 'fulfilled');
  if (!ok.length) throw resultados[0].reason;
  resultados.filter(x => x.status === 'rejected').forEach(x => console.error('Google Places, búsqueda parcial:', x.reason.message));

  const unicos = new Map();
  ok.flatMap(x => x.value).forEach(p => { if (p.id && !unicos.has(p.id)) unicos.set(p.id, p); });

  return [...unicos.values()].filter(esRefugio).map(p => ({
    id: `google-${p.id}`,
    name: p.displayName?.text || 'Refugio',
    address: p.formattedAddress || '',
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating ?? null,
    reviews: p.userRatingCount ?? null,
    phone: p.nationalPhoneNumber || '',
    url: p.googleMapsUri || '',
    source: 'google'
  })).filter(p => p.lat != null && p.lng != null);
}

// Nominatim (el buscador de OpenStreetMap) entiende la frase especial
// "[animal_shelter]", que busca por categoría y no por nombre. Se usa en vez
// de Overpass porque sus servidores públicos suelen saturarse. Exige un
// User-Agent identificable y no más de 1 consulta por segundo: la caché de
// zona mantiene el uso muy por debajo de eso.
async function buscarEnOSM(r) {
  const viewbox = [r.w, r.n, r.e, r.s].join(','); // izquierda, arriba, derecha, abajo
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=40&bounded=1&addressdetails=1&extratags=1` +
              `&viewbox=${viewbox}&q=${encodeURIComponent('[animal_shelter]')}`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': 'PataMatch/1.0 (proyecto academico PIN 2026)', 'Accept-Language': 'es' },
    signal: AbortSignal.timeout(15000)
  });
  if (!resp.ok) throw new Error(`Nominatim respondió ${resp.status}`);
  const json = await resp.json();
  return json.map(e => {
    const a = e.address || {};
    const t = e.extratags || {};
    const direccion = [a.road, a.house_number, a.suburb || a.neighbourhood, a.city || a.town || a.state]
      .filter(Boolean).join(', ');
    return {
      id: `osm-${e.osm_type}-${e.osm_id}`,
      name: e.name || 'Refugio de animales',
      address: direccion,
      lat: Number(e.lat),
      lng: Number(e.lon),
      rating: null,
      reviews: null,
      phone: t.phone || t['contact:phone'] || '',
      url: t.website || t['contact:website'] || `https://www.openstreetmap.org/${e.osm_type}/${e.osm_id}`,
      source: 'osm'
    };
  }).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

// Más cercanos al centro del recuadro primero.
function ordenarPorCentro(lugares, r) {
  const cLat = (r.s + r.n) / 2;
  const cLng = (r.w + r.e) / 2;
  const k = Math.cos(cLat * Math.PI / 180);
  const dist = (p) => (p.lat - cLat) ** 2 + ((p.lng - cLng) * k) ** 2;
  return lugares.sort((a, b) => dist(a) - dist(b));
}

function guardarEnCache(clave, data) {
  if (cacheExternos.size >= CACHE_MAX) {
    const ahora = Date.now();
    for (const [k, v] of cacheExternos) if (ahora - v.en >= CACHE_MS) cacheExternos.delete(k);
    if (cacheExternos.size >= CACHE_MAX) cacheExternos.delete(cacheExternos.keys().next().value);
  }
  cacheExternos.set(clave, { en: Date.now(), data });
}

// GET /externos?s=&w=&n=&e= — refugios dentro del recuadro visible del mapa
// (o ?lat=&lng=&radio=), según el proveedor disponible.
router.get('/externos', async (req, res) => {
  const r = leerRecuadro(req.query);
  if (!r) {
    return res.status(400).json({ success: false, error: 'Indicá el recuadro del mapa (s, w, n, e) o lat y lng' });
  }

  const clave = `${r.s},${r.w},${r.n},${r.e}`;
  const cacheado = cacheExternos.get(clave);
  if (cacheado && Date.now() - cacheado.en < CACHE_MS) {
    return res.json({ success: true, data: cacheado.data, cached: true });
  }

  try {
    let proveedor = 'osm';
    let lugares;
    let degradado = false;

    if (process.env.GOOGLE_MAPS_API_KEY) {
      try {
        lugares = await buscarEnGoogle(r);
        proveedor = 'google';
      } catch (err) {
        // Clave inválida, API sin habilitar o cuota agotada: se muestra al menos lo de OSM.
        console.error('Google Places falló, se usa OpenStreetMap:', err.message);
        degradado = true;
      }
    }
    if (!lugares) lugares = await buscarEnOSM(r);

    const data = { proveedor, degradado, recuadro: r, lugares: ordenarPorCentro(lugares, r) };
    if (!degradado) guardarEnCache(clave, data);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Buscar refugios externos error:', err.message);
    res.status(502).json({ success: false, error: 'No se pudo consultar el proveedor de mapas. Probá de nuevo en unos minutos.' });
  }
});

module.exports = router;
