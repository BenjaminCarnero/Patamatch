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
// existen alrededor de un punto según un proveedor externo:
//   - Google Places (Text Search) si hay GOOGLE_MAPS_API_KEY configurada.
//   - OpenStreetMap (Overpass, amenity=animal_shelter) como respaldo sin clave.
// La llamada se hace desde el servidor para no exponer la clave al navegador,
// y se cachea 10 minutos por zona para cuidar la cuota.

const cacheExternos = new Map();
const CACHE_MS = 10 * 60 * 1000;

async function buscarEnGoogle(lat, lng, radio) {
  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': process.env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.googleMapsUri,places.nationalPhoneNumber'
    },
    body: JSON.stringify({
      textQuery: 'refugio de animales',
      languageCode: 'es',
      maxResultCount: 20,
      locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: radio } }
    })
  });
  if (!resp.ok) throw new Error(`Google Places respondió ${resp.status}`);
  const json = await resp.json();
  return (json.places || []).map(p => ({
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
// zona de más abajo mantiene el uso muy por debajo de eso.
async function buscarEnOSM(lat, lng, radio) {
  // radio en metros → grados aproximados (1° ≈ 111 km) para el recuadro de búsqueda.
  const d = radio / 111000;
  const viewbox = [lng - d, lat + d, lng + d, lat - d].join(',');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=25&bounded=1&addressdetails=1&extratags=1` +
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

// GET /externos?lat=&lng=&radio= — refugios cercanos según el proveedor disponible.
router.get('/externos', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radio = Math.min(50000, Math.max(1000, Number(req.query.radio) || 15000));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res.status(400).json({ success: false, error: 'Indicá lat y lng' });
  }

  // La zona se redondea a ~1 km para que dos búsquedas casi iguales compartan caché.
  const clave = `${lat.toFixed(2)},${lng.toFixed(2)},${radio}`;
  const cacheado = cacheExternos.get(clave);
  if (cacheado && Date.now() - cacheado.en < CACHE_MS) {
    return res.json({ success: true, data: cacheado.data, cached: true });
  }

  const usaGoogle = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  try {
    const lugares = usaGoogle ? await buscarEnGoogle(lat, lng, radio) : await buscarEnOSM(lat, lng, radio);
    const data = { proveedor: usaGoogle ? 'google' : 'osm', lugares };
    cacheExternos.set(clave, { en: Date.now(), data });
    res.json({ success: true, data });
  } catch (err) {
    console.error('Buscar refugios externos error:', err.message);
    res.status(502).json({ success: false, error: 'No se pudo consultar el proveedor de mapas. Probá de nuevo en unos minutos.' });
  }
});

module.exports = router;
