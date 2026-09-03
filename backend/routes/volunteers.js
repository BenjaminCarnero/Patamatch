const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth, requireRole, ROLES } = require('../middleware/auth');
const { sanitizeHTML } = require('../middleware/sanitize');

const ESPECIES = ['perro', 'gato', 'ambos'];
const TAMANOS = ['pequeno', 'mediano', 'grande'];

// Cupo libre = capacidad declarada menos animales alojados ahora mismo.
// Se calcula siempre desde las estadías activas y nunca se guarda en una
// columna, así no puede quedar desincronizado.
const SELECT_VOLUNTARIO = `
  SELECT v.*, u.name, u.email, u.city, u.avatar_url, u.lat, u.lng,
         (SELECT COUNT(*) FROM foster_stays s
           WHERE s.volunteer_id = v.id AND s.status = 'activa') AS alojados,
         v.capacity - (SELECT COUNT(*) FROM foster_stays s
           WHERE s.volunteer_id = v.id AND s.status = 'activa') AS cupo_libre
  FROM volunteers v
  JOIN users u ON u.id = v.user_id
`;

function parsear(v) {
  if (!v) return v;
  return {
    ...v,
    accepts_sizes: JSON.parse(v.accepts_sizes || '[]'),
    alojados: Number(v.alojados),
    cupo_libre: Number(v.cupo_libre)
  };
}

// GET /me — mi ficha de hogar de tránsito y los animales que tengo alojados.
router.get('/me', requireAuth, async (req, res) => {
  try {
    const ficha = await queryOne(`${SELECT_VOLUNTARIO} WHERE v.user_id = ?`, [req.user.id]);
    if (!ficha) return res.json({ success: true, data: null });

    const estadias = await queryAll(`
      SELECT s.*, p.name AS pet_name, p.species, p.size, p.image_url
      FROM foster_stays s
      JOIN pets p ON p.id = s.pet_id
      WHERE s.volunteer_id = ?
      ORDER BY s.status = 'activa' DESC, s.start_date DESC
    `, [ficha.id]);

    res.json({ success: true, data: { ...parsear(ficha), estadias } });
  } catch (err) {
    console.error('Get hogar de transito error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch volunteer' });
  }
});

// POST / — ofrecerse como hogar de tránsito. Autogestionado: no da acceso a
// datos de nadie, así que no necesita que un admin lo apruebe.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { phone, capacity, accepts_species, accepts_sizes, has_yard, has_other_pets, max_weeks, notes } = req.body;

    const cap = Number(capacity);
    if (!Number.isInteger(cap) || cap < 1) {
      return res.status(400).json({ success: false, error: 'La capacidad debe ser al menos 1 animal' });
    }

    const especie = ESPECIES.includes(accepts_species) ? accepts_species : 'ambos';
    const tamanos = Array.isArray(accepts_sizes) ? accepts_sizes.filter(t => TAMANOS.includes(t)) : [];
    if (tamanos.length === 0) {
      return res.status(400).json({ success: false, error: 'Indicá al menos un tamaño de animal que podés recibir' });
    }

    const campos = [
      sanitizeHTML(phone || ''), cap, especie, JSON.stringify(tamanos),
      has_yard ? 1 : 0, has_other_pets ? 1 : 0,
      max_weeks ? Number(max_weeks) : null, sanitizeHTML(notes || '')
    ];

    const existente = await queryOne('SELECT id FROM volunteers WHERE user_id = ?', [req.user.id]);
    if (existente) {
      // Volver a ofrecerse después de una baja reactiva la misma ficha, para no
      // perder el historial de estadías anteriores.
      await runQuery(`
        UPDATE volunteers SET phone = ?, capacity = ?, accepts_species = ?, accepts_sizes = ?,
          has_yard = ?, has_other_pets = ?, max_weeks = ?, notes = ?, is_active = 1
        WHERE id = ?
      `, [...campos, existente.id]);
    } else {
      await runQuery(`
        INSERT INTO volunteers (phone, capacity, accepts_species, accepts_sizes,
          has_yard, has_other_pets, max_weeks, notes, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [...campos, req.user.id]);
    }

    // Solo se promueve desde 'usuario': un refugio o un admin que se ofrezca
    // como hogar conserva su rol, que tiene más permisos.
    const usuario = await queryOne('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (usuario.role === ROLES.USUARIO) {
      await runQuery('UPDATE users SET role = ? WHERE id = ?', [ROLES.VOLUNTARIO, req.user.id]);
    }

    const ficha = await queryOne(`${SELECT_VOLUNTARIO} WHERE v.user_id = ?`, [req.user.id]);
    const rol = await queryOne('SELECT role FROM users WHERE id = ?', [req.user.id]);

    res.status(201).json({ success: true, data: { ...parsear(ficha), role: rol.role } });
  } catch (err) {
    console.error('Alta hogar de transito error:', err);
    res.status(500).json({ success: false, error: 'Failed to register volunteer' });
  }
});

// DELETE /me — darse de baja. No se permite con animales alojados.
router.delete('/me', requireAuth, async (req, res) => {
  try {
    const ficha = await queryOne(`${SELECT_VOLUNTARIO} WHERE v.user_id = ?`, [req.user.id]);
    if (!ficha) {
      return res.status(404).json({ success: false, error: 'No estás anotado como hogar de tránsito' });
    }

    if (Number(ficha.alojados) > 0) {
      return res.status(409).json({
        success: false,
        error: `No podés darte de baja con ${ficha.alojados} animal(es) todavía alojados. Coordiná primero el fin del tránsito.`
      });
    }

    await runQuery('UPDATE volunteers SET is_active = 0 WHERE id = ?', [ficha.id]);

    const usuario = await queryOne('SELECT role FROM users WHERE id = ?', [req.user.id]);
    if (usuario.role === ROLES.VOLUNTARIO) {
      await runQuery('UPDATE users SET role = ? WHERE id = ?', [ROLES.USUARIO, req.user.id]);
    }

    res.json({ success: true, message: 'Te diste de baja como hogar de tránsito' });
  } catch (err) {
    console.error('Baja hogar de transito error:', err);
    res.status(500).json({ success: false, error: 'Failed to unregister volunteer' });
  }
});

// GET / — listado para el backoffice. Con ?species= y ?size= devuelve solo los
// que tienen cupo libre y aceptan ese animal: es la búsqueda de "¿quién puede
// recibir a este perro grande hoy?".
router.get('/', requireAuth, requireRole(ROLES.REFUGIO, ROLES.ADMIN), async (req, res) => {
  try {
    const { species, size } = req.query;

    const voluntarios = await queryAll(`${SELECT_VOLUNTARIO} WHERE v.is_active = 1 ORDER BY cupo_libre DESC, v.created_at DESC`);
    let resultado = voluntarios.map(parsear);

    if (species || size) {
      resultado = resultado.filter(v => {
        if (v.cupo_libre <= 0) return false;
        if (species && v.accepts_species !== 'ambos' && v.accepts_species !== species) return false;
        if (size && !v.accepts_sizes.includes(size)) return false;
        return true;
      });
    }

    res.json({ success: true, data: resultado });
  } catch (err) {
    console.error('Listar hogares error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch volunteers' });
  }
});

// POST /stays — asignar un animal a un hogar de tránsito.
router.post('/stays', requireAuth, requireRole(ROLES.REFUGIO, ROLES.ADMIN), async (req, res) => {
  try {
    const { volunteer_id, pet_id, notes } = req.body;

    const hogar = await queryOne(`${SELECT_VOLUNTARIO} WHERE v.id = ? AND v.is_active = 1`, [volunteer_id]);
    if (!hogar) {
      return res.status(404).json({ success: false, error: 'Hogar de tránsito no encontrado' });
    }

    const mascota = await queryOne('SELECT id, name, species, size, user_id FROM pets WHERE id = ?', [pet_id]);
    if (!mascota) {
      return res.status(404).json({ success: false, error: 'Mascota no encontrada' });
    }

    // Un refugio solo puede derivar a tránsito los animales que publicó él:
    // no puede disponer de una mascota que subió otro usuario. El admin sí,
    // para poder resolver casos a mano.
    if (req.user.role !== ROLES.ADMIN && mascota.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Solo podés derivar a tránsito los animales que publicaste'
      });
    }

    if (Number(hogar.cupo_libre) <= 0) {
      return res.status(409).json({
        success: false,
        error: `${hogar.name} no tiene cupo libre (${hogar.alojados}/${hogar.capacity})`
      });
    }

    const ficha = parsear(hogar);
    const especieOk = ficha.accepts_species === 'ambos' ||
      ficha.accepts_species === String(mascota.species || '').toLowerCase();
    if (!especieOk) {
      return res.status(409).json({ success: false, error: `${hogar.name} no recibe ${mascota.species}` });
    }

    const yaAlojada = await queryOne("SELECT id FROM foster_stays WHERE pet_id = ? AND status = 'activa'", [pet_id]);
    if (yaAlojada) {
      return res.status(409).json({ success: false, error: `${mascota.name} ya está en un hogar de tránsito` });
    }

    await runQuery(
      'INSERT INTO foster_stays (volunteer_id, pet_id, created_by, notes) VALUES (?, ?, ?, ?)',
      [volunteer_id, pet_id, req.user.id, sanitizeHTML(notes || '')]
    );

    // Avisar al voluntario reutilizando el centro de notificaciones.
    await runQuery(
      'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
      [hogar.user_id, 'foster_stay', volunteer_id, `Te asignaron a ${mascota.name} en hogar de tránsito`]
    );

    const estadia = await queryOne(
      'SELECT * FROM foster_stays WHERE volunteer_id = ? AND pet_id = ? ORDER BY id DESC LIMIT 1',
      [volunteer_id, pet_id]
    );

    res.status(201).json({ success: true, data: estadia });
  } catch (err) {
    console.error('Asignar transito error:', err);
    res.status(500).json({ success: false, error: 'Failed to create foster stay' });
  }
});

// PUT /stays/:id/status — finalizar o cancelar un tránsito. Lo puede hacer el
// hogar (el animal ya se fue) o quien lo coordinó.
router.put('/stays/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['activa', 'finalizada', 'cancelada'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado inválido. Válidos: activa, finalizada, cancelada' });
    }

    const estadia = await queryOne('SELECT * FROM foster_stays WHERE id = ?', [req.params.id]);
    if (!estadia) {
      return res.status(404).json({ success: false, error: 'Tránsito no encontrado' });
    }

    const ficha = await queryOne('SELECT id FROM volunteers WHERE user_id = ?', [req.user.id]);
    const esHogar = ficha && estadia.volunteer_id === ficha.id;
    if (!esHogar && estadia.created_by !== req.user.id) {
      return res.status(403).json({ success: false, error: 'No tenés permisos sobre este tránsito' });
    }

    // Al cerrarlo se libera el cupo, porque cupo_libre cuenta solo las activas.
    const cierra = status !== 'activa';
    await runQuery(
      `UPDATE foster_stays SET status = ?, end_date = ${cierra ? 'CURRENT_DATE' : 'NULL'} WHERE id = ?`,
      [status, req.params.id]
    );

    const actualizada = await queryOne('SELECT * FROM foster_stays WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: actualizada });
  } catch (err) {
    console.error('Actualizar transito error:', err);
    res.status(500).json({ success: false, error: 'Failed to update foster stay' });
  }
});

module.exports = router;
