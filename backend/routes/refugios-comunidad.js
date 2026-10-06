const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth, attachRole, requireRole, ROLES } = require('../middleware/auth');
const { sanitizeHTML } = require('../middleware/sanitize');

// Refugios aportados por la comunidad (tabla shelter_suggestions).
//
// Los refugios chicos no están en ninguna base de mapas: los conoce quien vive
// cerca. Cualquier usuario con sesión puede sugerir uno, y un admin lo aprueba
// antes de que aparezca en el mapa. Si quien sugiere es admin, queda aprobado
// directo: no tiene sentido que se revise a sí mismo.

const MAX_PENDIENTES = 5;      // sugerencias sin revisar por usuario, contra el spam
const CERCANIA_DUPLICADO = 0.002; // grados (~200 m): mismo nombre a esta distancia = repetido
const ESTADOS = ['pendiente', 'aprobado', 'rechazado'];

// Texto de una línea, sin caracteres de control ni espacios de más.
const limpiar = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

// Acepta "instagram.com/usuario" o "https://...". Devuelve una URL http(s) con
// dominio, o null. Un "@usuario" suelto no alcanza: no se sabe de qué red es.
function normalizarUrl(valor) {
  let v = String(valor ?? '').trim();
  if (!v) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!['http:', 'https:'].includes(u.protocol) || !u.hostname.includes('.')) return null;
    const url = u.toString();
    return url.length <= 300 ? url : null;
  } catch (e) {
    return null;
  }
}

// Valida y normaliza el cuerpo de una sugerencia. Devuelve { error } o { datos }.
function validar(body) {
  const name = limpiar(body.name);
  const city = limpiar(body.city);
  const address = limpiar(body.address);
  const notes = limpiar(body.notes);
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  const url = normalizarUrl(body.url);

  if (name.length < 3 || name.length > 80) return { error: 'El nombre del refugio debe tener entre 3 y 80 caracteres' };
  if (city.length < 2 || city.length > 80) return { error: 'Indicá la localidad (hasta 80 caracteres)' };
  if (address.length > 160) return { error: 'La referencia puede tener hasta 160 caracteres' };
  if (notes.length > 300) return { error: 'Las observaciones pueden tener hasta 300 caracteres' };
  if (!url) return { error: 'Pegá el link de su perfil o web (ej. https://instagram.com/usuario): lo usamos para verificarlo' };
  if (body.lat == null || body.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { error: 'Marcá la ubicación del refugio en el mapa' };
  }

  return {
    datos: { name, city, address, notes, url, lat, lng, approximate: body.approximate === false ? 0 : 1 }
  };
}

// Cuando el punto es aproximado se redondea a ~100 m, para que no se pueda
// ubicar la puerta exacta de una casa desde el mapa público.
const publico = (s) => {
  const aprox = Number(s.approximate) === 1;
  const redondear = (v) => (aprox ? Number(Number(v).toFixed(3)) : Number(v));
  return { lat: redondear(s.lat), lng: redondear(s.lng), approximate: aprox };
};

// GET / — los refugios aprobados, para el mapa (público).
router.get('/', async (req, res) => {
  try {
    const filas = await queryAll(`
      SELECT id, name, city, address, lat, lng, approximate, url, notes, created_at
      FROM shelter_suggestions
      WHERE status = 'aprobado'
      ORDER BY name
      LIMIT 500
    `);
    res.json({ success: true, data: filas.map(s => ({ ...s, ...publico(s) })) });
  } catch (err) {
    console.error('Listar refugios de la comunidad error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch community shelters' });
  }
});

// POST / — sugerir un refugio.
router.post('/', requireAuth, attachRole, async (req, res) => {
  try {
    const { error, datos } = validar(req.body || {});
    if (error) return res.status(400).json({ success: false, error });

    const esAdmin = req.user.role === ROLES.ADMIN;

    if (!esAdmin) {
      const { n } = await queryOne(
        "SELECT COUNT(*) AS n FROM shelter_suggestions WHERE user_id = ? AND status = 'pendiente'", [req.user.id]
      );
      if (Number(n) >= MAX_PENDIENTES) {
        return res.status(429).json({
          success: false,
          error: `Ya tenés ${MAX_PENDIENTES} sugerencias esperando revisión. Esperá a que las revisemos para sumar más.`
        });
      }
    }

    const repetido = await queryOne(`
      SELECT id FROM shelter_suggestions
      WHERE status <> 'rechazado' AND lower(name) = lower(?)
        AND abs(lat - ?::numeric) < ? AND abs(lng - ?::numeric) < ?
    `, [datos.name, datos.lat, CERCANIA_DUPLICADO, datos.lng, CERCANIA_DUPLICADO]);
    if (repetido) {
      return res.status(409).json({ success: false, error: 'Ese refugio ya fue sugerido. ¡Gracias igual!' });
    }

    const resultado = await runQuery(`
      INSERT INTO shelter_suggestions
        (user_id, name, city, address, lat, lng, approximate, url, notes, status, reviewed_by, reviewed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${esAdmin ? 'CURRENT_TIMESTAMP' : 'NULL'})
    `, [
      req.user.id, datos.name, datos.city, datos.address, datos.lat, datos.lng, datos.approximate,
      datos.url, datos.notes, esAdmin ? 'aprobado' : 'pendiente', esAdmin ? req.user.id : null
    ]);

    res.status(201).json({
      success: true,
      data: { id: resultado.lastInsertRowid, status: esAdmin ? 'aprobado' : 'pendiente' }
    });
  } catch (err) {
    console.error('Sugerir refugio error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit shelter' });
  }
});

// GET /moderacion?estado= — todas las sugerencias, para el admin. Las pendientes primero.
router.get('/moderacion', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const estado = ESTADOS.includes(req.query.estado) ? req.query.estado : null;
    const filas = await queryAll(`
      SELECT s.*, u.name AS user_name
      FROM shelter_suggestions s
      JOIN users u ON u.id = s.user_id
      ${estado ? 'WHERE s.status = ?' : ''}
      ORDER BY (s.status = 'pendiente') DESC, s.created_at DESC
      LIMIT 200
    `, estado ? [estado] : []);

    res.json({
      success: true,
      data: filas.map(s => ({
        ...s,
        lat: Number(s.lat),
        lng: Number(s.lng),
        approximate: Number(s.approximate) === 1
      }))
    });
  } catch (err) {
    console.error('Listar sugerencias error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch suggestions' });
  }
});

// PUT /:id — el admin aprueba, rechaza o devuelve a pendiente una sugerencia.
router.put('/:id', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { status } = req.body || {};
    const nota = limpiar(req.body?.note).slice(0, 200);

    if (!Number.isInteger(id)) return res.status(400).json({ success: false, error: 'Identificador inválido' });
    if (!ESTADOS.includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado inválido. Válidos: pendiente, aprobado, rechazado' });
    }

    const sugerencia = await queryOne('SELECT * FROM shelter_suggestions WHERE id = ?', [id]);
    if (!sugerencia) return res.status(404).json({ success: false, error: 'Sugerencia no encontrada' });

    await runQuery(
      'UPDATE shelter_suggestions SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, nota, req.user.id, id]
    );

    // Se avisa a quien la sugirió, salvo que sea el propio admin o no haya cambio.
    // El texto se escapa: la lista de notificaciones lo inserta como HTML.
    if (status !== 'pendiente' && status !== sugerencia.status && sugerencia.user_id !== req.user.id) {
      const nombre = sanitizeHTML(sugerencia.name);
      const textos = {
        aprobado: `¡Gracias! "${nombre}" ya aparece en el mapa de refugios`,
        rechazado: `No pudimos publicar "${nombre}" en el mapa de refugios${nota ? `: ${sanitizeHTML(nota)}` : ''}`
      };
      await runQuery(
        'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
        [sugerencia.user_id, 'shelter_suggestion', id, textos[status]]
      );
    }

    const actualizada = await queryOne('SELECT * FROM shelter_suggestions WHERE id = ?', [id]);
    res.json({ success: true, data: { ...actualizada, lat: Number(actualizada.lat), lng: Number(actualizada.lng) } });
  } catch (err) {
    console.error('Moderar sugerencia error:', err);
    res.status(500).json({ success: false, error: 'Failed to update suggestion' });
  }
});

module.exports = router;
