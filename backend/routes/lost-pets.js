const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth } = require('../middleware/auth');

// RF-09 — Alertas automáticas a usuarios cercanos al lugar del extravío.
// Radio en km alrededor del reporte dentro del cual se avisa a los vecinos.
const RADIO_ALERTA_KM = 5;

// Notifica a los usuarios cuya "zona" (users.lat/lng) cae dentro del radio.
// Usa la fórmula de Haversine sobre la Tierra (6371 km de radio medio).
// Nunca hace fallar el reporte: si algo sale mal, solo se loguea.
async function alertarVecinos({ lostPet, lat, lng, reporterId }) {
  try {
    const vecinos = await queryAll(`
      SELECT id, ROUND((6371 * acos(LEAST(1,
        cos(radians(?::numeric)) * cos(radians(lat)) * cos(radians(lng) - radians(?::numeric))
        + sin(radians(?::numeric)) * sin(radians(lat))
      )))::numeric, 1) AS km
      FROM users
      WHERE lat IS NOT NULL AND lng IS NOT NULL AND id <> ?
    `, [lat, lng, lat, reporterId]);

    const cercanos = vecinos.filter(v => Number(v.km) <= RADIO_ALERTA_KM);

    for (const vecino of cercanos) {
      const texto = `Se perdió ${lostPet.name}${lostPet.breed ? ` (${lostPet.breed})` : ''} a ${vecino.km} km de tu zona — ${lostPet.location}`;
      await runQuery(
        'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
        [vecino.id, 'lost_pet_nearby', lostPet.id, texto]
      );
    }

    return cercanos.length;
  } catch (err) {
    console.error('Alerta por cercanía falló:', err);
    return 0;
  }
}

// GET / — list lost pets (not yet found)
router.get('/', async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const pets = await queryAll(
      'SELECT * FROM lost_pets WHERE is_found = 0 ORDER BY created_at DESC LIMIT ?',
      [Number(limit)]
    );

    res.json({ success: true, data: pets });
  } catch (err) {
    console.error('List lost pets error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch lost pets' });
  }
});

// POST / — report a lost pet
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, breed, location, description, image_url, lat, lng } = req.body;

    if (!name || !location) {
      return res.status(400).json({ success: false, error: 'Name and location are required' });
    }

    const latNum = Number(lat ?? 19.4326);
    const lngNum = Number(lng ?? -99.1332);

    const result = await runQuery(
      'INSERT INTO lost_pets (name, breed, location, description, image_url, marker_top, marker_left, lat, lng, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, breed || null, location, description || null, image_url || null,
       String(latNum), String(lngNum), latNum, lngNum, req.user.id]
    );

    const lostPet = await queryOne('SELECT * FROM lost_pets WHERE id = ?', [result.lastInsertRowid]);

    const alertados = await alertarVecinos({
      lostPet, lat: latNum, lng: lngNum, reporterId: req.user.id
    });

    res.status(201).json({ success: true, data: lostPet, alertados });
  } catch (err) {
    console.error('Report lost pet error:', err);
    res.status(500).json({ success: false, error: 'Failed to report lost pet' });
  }
});

// PUT /:id/found — mark lost pet as found
router.put('/:id/found', requireAuth, async (req, res) => {
  try {
    const pet = await queryOne('SELECT * FROM lost_pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Lost pet report not found' });
    }

    await runQuery('UPDATE lost_pets SET is_found = 1 WHERE id = ?', [req.params.id]);

    const updated = await queryOne('SELECT * FROM lost_pets WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('Mark found error:', err);
    res.status(500).json({ success: false, error: 'Failed to update lost pet status' });
  }
});

module.exports = router;
