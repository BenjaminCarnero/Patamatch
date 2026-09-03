const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth, attachRole, ROLES } = require('../middleware/auth');
const { sanitizeHTML } = require('../middleware/sanitize');

// El sistema registra donaciones y hace seguimiento; no cobra. Una donación
// nace 'comprometida' y el refugio la marca 'recibida' cuando llega de verdad.

// GET /refugios — a quién se le puede donar. Solo refugios verificados: esa
// verificación es justamente lo que evita que cualquiera se declare refugio y
// reciba donaciones a su nombre.
router.get('/refugios', async (req, res) => {
  try {
    const refugios = await queryAll(
      "SELECT id, name, city, avatar_url FROM users WHERE role = 'refugio' ORDER BY name"
    );
    res.json({ success: true, data: refugios });
  } catch (err) {
    console.error('Listar refugios error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch shelters' });
  }
});

// POST / — registrar una donación.
router.post('/', requireAuth, async (req, res) => {
  try {
    const { refugio_id, tipo, monto, descripcion, notas } = req.body;

    if (!['dinero', 'especie'].includes(tipo)) {
      return res.status(400).json({ success: false, error: 'Tipo inválido. Válidos: dinero, especie' });
    }

    const refugio = await queryOne("SELECT id, name, role FROM users WHERE id = ?", [refugio_id]);
    if (!refugio || refugio.role !== ROLES.REFUGIO) {
      return res.status(404).json({ success: false, error: 'Refugio no encontrado o no verificado' });
    }

    if (tipo === 'dinero') {
      const n = Number(monto);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ success: false, error: 'Indicá un monto mayor a cero' });
      }
    } else if (!descripcion || !descripcion.trim()) {
      return res.status(400).json({ success: false, error: 'Contá qué vas a donar (ej: 20 kg de alimento)' });
    }

    const result = await runQuery(
      'INSERT INTO donations (donor_id, refugio_id, tipo, monto, descripcion, notas) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, refugio_id, tipo,
       tipo === 'dinero' ? Number(monto) : null,
       sanitizeHTML(descripcion || ''), sanitizeHTML(notas || '')]
    );

    const detalle = tipo === 'dinero' ? `$${Number(monto)}` : sanitizeHTML(descripcion);
    await runQuery(
      'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
      [refugio_id, 'donation', result.lastInsertRowid, `${req.user.name} se comprometió a donar ${detalle}`]
    );

    const donacion = await queryOne('SELECT * FROM donations WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, data: donacion });
  } catch (err) {
    console.error('Registrar donacion error:', err);
    res.status(500).json({ success: false, error: 'Failed to register donation' });
  }
});

// GET /mias — lo que yo doné.
router.get('/mias', requireAuth, async (req, res) => {
  try {
    const donaciones = await queryAll(`
      SELECT d.*, u.name AS refugio_name, u.city AS refugio_city
      FROM donations d JOIN users u ON u.id = d.refugio_id
      WHERE d.donor_id = ? ORDER BY d.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, data: donaciones });
  } catch (err) {
    console.error('Listar mis donaciones error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch donations' });
  }
});

// GET /recibidas — lo que recibe mi refugio. El admin ve todo el sistema.
router.get('/recibidas', requireAuth, attachRole, async (req, res) => {
  try {
    const esAdmin = req.user.role === ROLES.ADMIN;
    const filtro = esAdmin ? '' : 'WHERE d.refugio_id = ?';
    const params = esAdmin ? [] : [req.user.id];

    const donaciones = await queryAll(`
      SELECT d.*, u.name AS donor_name, u.email AS donor_email,
             r.name AS refugio_name
      FROM donations d
      JOIN users u ON u.id = d.donor_id
      JOIN users r ON r.id = d.refugio_id
      ${filtro}
      ORDER BY d.estado = 'comprometida' DESC, d.created_at DESC
    `, params);

    // Los totales solo cuentan lo efectivamente recibido: una promesa no es
    // plata en la caja, y mostrarla como tal daría un número falso.
    const recibidas = donaciones.filter(d => d.estado === 'recibida');
    const resumen = {
      total_dinero_recibido: recibidas
        .filter(d => d.tipo === 'dinero')
        .reduce((acc, d) => acc + Number(d.monto || 0), 0),
      donaciones_en_especie_recibidas: recibidas.filter(d => d.tipo === 'especie').length,
      comprometidas_pendientes: donaciones.filter(d => d.estado === 'comprometida').length
    };

    res.json({ success: true, data: { donaciones, resumen } });
  } catch (err) {
    console.error('Listar donaciones recibidas error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch donations' });
  }
});

// PUT /:id/estado — el refugio confirma que llegó, o la cancela.
router.put('/:id/estado', requireAuth, attachRole, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['comprometida', 'recibida', 'cancelada'].includes(estado)) {
      return res.status(400).json({ success: false, error: 'Estado inválido. Válidos: comprometida, recibida, cancelada' });
    }

    const donacion = await queryOne('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    if (!donacion) {
      return res.status(404).json({ success: false, error: 'Donación no encontrada' });
    }

    // Confirmar la recepción es potestad de quien la recibe. El donante puede
    // cancelar lo que prometió, pero no puede darla por recibida él mismo.
    const esRefugio = donacion.refugio_id === req.user.id;
    const esDonante = donacion.donor_id === req.user.id;
    const esAdmin = req.user.role === ROLES.ADMIN;

    if (!esRefugio && !esAdmin && !(esDonante && estado === 'cancelada')) {
      return res.status(403).json({ success: false, error: 'No tenés permisos sobre esta donación' });
    }

    await runQuery(
      `UPDATE donations SET estado = ?, recibida_at = ${estado === 'recibida' ? 'CURRENT_TIMESTAMP' : 'NULL'} WHERE id = ?`,
      [estado, req.params.id]
    );

    if (estado === 'recibida') {
      await runQuery(
        'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
        [donacion.donor_id, 'donation', donacion.id, '¡Gracias! El refugio confirmó que recibió tu donación']
      );
    }

    const actualizada = await queryOne('SELECT * FROM donations WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: actualizada });
  } catch (err) {
    console.error('Actualizar donacion error:', err);
    res.status(500).json({ success: false, error: 'Failed to update donation' });
  }
});

module.exports = router;
