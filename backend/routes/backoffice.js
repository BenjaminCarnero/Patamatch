const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth, attachRole, ROLES } = require('../middleware/auth');

// Panel de gestión de publicaciones propias.
//
// El acceso lo da ser dueño de la publicación, no el rol: en PataMatch cualquier
// usuario puede dar una mascota en adopción, así que también tiene que poder
// gestionar sus solicitudes. El rol solo cambia el alcance — un admin ve todo
// el sistema para moderar. Lo exclusivo del refugio (hogares de tránsito,
// donaciones a su nombre) vive en sus propios módulos.
const soloGestores = [requireAuth, attachRole];

const esAdmin = (req) => req.user.role === ROLES.ADMIN;

// GET /resumen — números de la portada del panel.
router.get('/resumen', ...soloGestores, async (req, res) => {
  try {
    // El admin ve todo el sistema; un refugio solo lo suyo. La condición se
    // arma una vez y se reusa, para que no se escape ninguna consulta sin filtro.
    const mias = esAdmin(req) ? '' : ' AND p.user_id = ?';
    const params = esAdmin(req) ? [] : [req.user.id];

    const [publicadas, adoptadas, pendientes, transito] = await Promise.all([
      queryOne(`SELECT COUNT(*) AS n FROM pets p WHERE p.is_adopted = 0${mias}`, params),
      queryOne(`SELECT COUNT(*) AS n FROM pets p WHERE p.is_adopted = 1${mias}`, params),
      queryOne(`SELECT COUNT(*) AS n FROM chats c JOIN pets p ON p.id = c.pet_id
                WHERE c.status = 'pendiente'${mias}`, params),
      queryOne(`SELECT COUNT(*) AS n FROM foster_stays s JOIN pets p ON p.id = s.pet_id
                WHERE s.status = 'activa'${mias}`, params)
    ]);

    res.json({
      success: true,
      data: {
        publicadas: Number(publicadas.n),
        adoptadas: Number(adoptadas.n),
        solicitudes_pendientes: Number(pendientes.n),
        en_transito: Number(transito.n),
        alcance: esAdmin(req) ? 'todo el sistema' : 'tus publicaciones'
      }
    });
  } catch (err) {
    console.error('Resumen backoffice error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch summary' });
  }
});

// GET /mascotas — las publicaciones que gestiona este usuario.
router.get('/mascotas', ...soloGestores, async (req, res) => {
  try {
    const filtro = esAdmin(req) ? '' : 'WHERE p.user_id = ?';
    const params = esAdmin(req) ? [] : [req.user.id];

    const mascotas = await queryAll(`
      SELECT p.*,
             (SELECT COUNT(*) FROM chats c WHERE c.pet_id = p.id AND c.status = 'pendiente') AS solicitudes_pendientes,
             (SELECT COUNT(*) FROM foster_stays s WHERE s.pet_id = p.id AND s.status = 'activa') AS en_transito
      FROM pets p ${filtro}
      ORDER BY p.is_adopted ASC, p.id DESC
    `, params);

    res.json({ success: true, data: mascotas });
  } catch (err) {
    console.error('Listar mascotas backoffice error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch pets' });
  }
});

// GET /solicitudes — pedidos de adopción sobre las mascotas que gestiona.
router.get('/solicitudes', ...soloGestores, async (req, res) => {
  try {
    const filtro = esAdmin(req) ? '' : 'WHERE p.user_id = ?';
    const params = esAdmin(req) ? [] : [req.user.id];

    const solicitudes = await queryAll(`
      SELECT c.id, c.status, c.created_at,
             p.id AS pet_id, p.name AS pet_name, p.image_url, p.is_adopted,
             u.id AS adopter_id, u.name AS adopter_name, u.email AS adopter_email, u.city AS adopter_city,
             (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) AS mensajes
      FROM chats c
      JOIN pets p ON p.id = c.pet_id
      JOIN users u ON u.id = c.adopter_id
      ${filtro}
      ORDER BY c.status = 'pendiente' DESC, c.created_at DESC
    `, params);

    res.json({ success: true, data: solicitudes });
  } catch (err) {
    console.error('Listar solicitudes error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch requests' });
  }
});

// PUT /solicitudes/:id — aprobar o rechazar un pedido de adopción.
router.put('/solicitudes/:id', ...soloGestores, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['aprobada', 'rechazada', 'pendiente'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Estado inválido. Válidos: aprobada, rechazada, pendiente' });
    }

    const solicitud = await queryOne(`
      SELECT c.*, p.name AS pet_name, p.user_id AS owner_id
      FROM chats c JOIN pets p ON p.id = c.pet_id WHERE c.id = ?
    `, [req.params.id]);

    if (!solicitud) {
      return res.status(404).json({ success: false, error: 'Solicitud no encontrada' });
    }

    if (!esAdmin(req) && solicitud.owner_id !== req.user.id) {
      return res.status(403).json({ success: false, error: 'Esta solicitud no es sobre una mascota tuya' });
    }

    await runQuery('UPDATE chats SET status = ? WHERE id = ?', [status, req.params.id]);

    if (status === 'aprobada') {
      // Aprobar concreta la adopción: la mascota sale del catálogo y el resto
      // de los pedidos sobre ella se rechazan, para no dejar gente esperando
      // por un animal que ya tiene hogar.
      await runQuery('UPDATE pets SET is_adopted = 1 WHERE id = ?', [solicitud.pet_id]);
      await runQuery(
        "UPDATE chats SET status = 'rechazada' WHERE pet_id = ? AND id <> ? AND status = 'pendiente'",
        [solicitud.pet_id, req.params.id]
      );
    } else if (status === 'rechazada' || status === 'pendiente') {
      // Si se revierte una aprobación, la mascota vuelve a estar disponible.
      const sigueAprobada = await queryOne(
        "SELECT id FROM chats WHERE pet_id = ? AND status = 'aprobada'", [solicitud.pet_id]
      );
      if (!sigueAprobada) {
        await runQuery('UPDATE pets SET is_adopted = 0 WHERE id = ?', [solicitud.pet_id]);
      }
    }

    const textos = {
      aprobada: `¡Buenas noticias! Aprobaron tu solicitud para adoptar a ${solicitud.pet_name}`,
      rechazada: `Tu solicitud para adoptar a ${solicitud.pet_name} no prosperó esta vez`,
      pendiente: `Tu solicitud para adoptar a ${solicitud.pet_name} volvió a estar en revisión`
    };
    await runQuery(
      'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
      [solicitud.adopter_id, 'adoption_status', solicitud.id, textos[status]]
    );

    const actualizada = await queryOne('SELECT * FROM chats WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: actualizada });
  } catch (err) {
    console.error('Actualizar solicitud error:', err);
    res.status(500).json({ success: false, error: 'Failed to update request' });
  }
});

module.exports = router;
