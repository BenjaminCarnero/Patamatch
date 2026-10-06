const router = require('express').Router();
const { queryAll, queryOne, runQuery } = require('../db/database');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Estados de salud válidos para el cartel del catálogo. Espejan el CHECK de la
// base; se validan acá para devolver un 400 claro en vez de un error de Postgres.
const ESTADOS_SALUD = ['disponible', 'con_cuidado', 'en_reposo', 'cirugia_programada'];

// GET / — list pets with optional filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { species, size, age, is_adopted, health_status, limit = 20, offset = 0 } = req.query;
    const conditions = [];
    const params = [];

    if (health_status && ESTADOS_SALUD.includes(health_status)) {
      conditions.push('p.health_status = ?');
      params.push(health_status);
    }

    if (species) {
      conditions.push('p.species = ?');
      params.push(species);
    }
    if (size) {
      conditions.push('p.size = ?');
      params.push(size);
    }
    if (age) {
      conditions.push('p.age = ?');
      params.push(age);
    }
    if (is_adopted !== undefined) {
      conditions.push('p.is_adopted = ?');
      params.push(Number(is_adopted));
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    // has_carnet permite mostrar el botón "Ver carnet" sin pedir cada carnet aparte.
    const sql = `SELECT p.*,
                        EXISTS (SELECT 1 FROM pet_carnets c WHERE c.pet_id = p.id) AS has_carnet
                 FROM pets p ${whereClause} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const pets = await queryAll(sql, params);

    if (req.user) {
      const favorites = await queryAll('SELECT pet_id FROM favorites WHERE user_id = ?', [req.user.id]);
      const favSet = new Set(favorites.map(f => f.pet_id));
      for (let pet of pets) {
        pet.isFavorite = favSet.has(pet.id);
      }
    }

    res.json({ success: true, data: pets });
  } catch (err) {
    console.error('List pets error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch pets' });
  }
});

// GET /:id — single pet
router.get('/:id', async (req, res) => {
  try {
    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    res.json({ success: true, data: pet });
  } catch (err) {
    console.error('Get pet error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch pet' });
  }
});

// POST / — create pet
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, species, breed, age, size, location, image_url, description, health_status, health_note } = req.body;

    if (!name || !species) {
      return res.status(400).json({ success: false, error: 'Name and species are required' });
    }
    if (health_status && !ESTADOS_SALUD.includes(health_status)) {
      return res.status(400).json({ success: false, error: 'Estado de salud inválido' });
    }

    const result = await runQuery(
      `INSERT INTO pets (name, species, breed, age, size, location, image_url, description, health_status, health_note, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, species, breed || null, age || null, size || null, location || null, image_url || null, description || null,
       health_status || 'disponible', health_note || '', req.user.id]
    );

    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ success: true, data: pet });
  } catch (err) {
    console.error('Create pet error:', err);
    res.status(500).json({ success: false, error: 'Failed to create pet' });
  }
});

// Solo el dueño de la publicación puede tocarla. El admin también, para poder
// moderar contenido inapropiado sin depender de que el dueño lo borre.
async function puedeEditar(pet, user) {
  if (pet.user_id === user.id) return true;
  const { role } = await queryOne('SELECT role FROM users WHERE id = ?', [user.id]) || {};
  return role === 'admin';
}

// PUT /:id — editar una publicación
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Mascota no encontrada' });
    }

    if (!await puedeEditar(pet, req.user)) {
      return res.status(403).json({ success: false, error: 'Solo podés editar tus propias publicaciones' });
    }

    const { name, species, breed, age, size, location, image_url, description, health_status, health_note } = req.body;
    if (!name || !species) {
      return res.status(400).json({ success: false, error: 'El nombre y la especie son obligatorios' });
    }
    if (health_status && !ESTADOS_SALUD.includes(health_status)) {
      return res.status(400).json({ success: false, error: 'Estado de salud inválido' });
    }

    // Si el estado vuelve a 'disponible', la nota anterior deja de tener sentido.
    const nuevoEstado = health_status || pet.health_status;
    const nuevaNota = nuevoEstado === 'disponible' ? '' : (health_note ?? pet.health_note ?? '');

    await runQuery(
      `UPDATE pets SET name = ?, species = ?, breed = ?, age = ?, size = ?,
       location = ?, image_url = ?, description = ?, health_status = ?, health_note = ? WHERE id = ?`,
      [name, species, breed || null, age || null, size || null, location || null,
       image_url || pet.image_url, description || null, nuevoEstado, nuevaNota, req.params.id]
    );

    const actualizada = await queryOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    res.json({ success: true, data: actualizada });
  } catch (err) {
    console.error('Editar mascota error:', err);
    res.status(500).json({ success: false, error: 'Failed to update pet' });
  }
});

// DELETE /:id — dar de baja una publicación
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Mascota no encontrada' });
    }

    if (!await puedeEditar(pet, req.user)) {
      return res.status(403).json({ success: false, error: 'Solo podés eliminar tus propias publicaciones' });
    }

    // No se puede borrar una mascota que está alojada en un hogar de tránsito:
    // hay una persona real cuidándola y su estadía quedaría huérfana.
    const enTransito = await queryOne(
      "SELECT id FROM foster_stays WHERE pet_id = ? AND status = 'activa'", [req.params.id]
    );
    if (enTransito) {
      return res.status(409).json({
        success: false,
        error: 'Esta mascota está en un hogar de tránsito. Finalizá el tránsito antes de dar de baja la publicación.'
      });
    }

    await runQuery('DELETE FROM favorites WHERE pet_id = ?', [req.params.id]);
    await runQuery('DELETE FROM pets WHERE id = ?', [req.params.id]);

    res.json({ success: true, message: 'Publicación eliminada' });
  } catch (err) {
    console.error('Eliminar mascota error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete pet' });
  }
});

// ---------- Carnet digital de la mascota en adopción ----------

// Las listas viajan como JSON en texto; se devuelven ya parseadas.
function parsearCarnet(carnet) {
  for (const campo of ['vaccinations', 'diseases', 'medical_history']) {
    if (typeof carnet[campo] === 'string') {
      try { carnet[campo] = JSON.parse(carnet[campo]); } catch (_) { carnet[campo] = []; }
    }
    if (!Array.isArray(carnet[campo])) carnet[campo] = [];
  }
  return carnet;
}

// Solo se guardan los campos que espera cada ítem, así el carnet no acumula
// claves arbitrarias enviadas desde el cliente.
function limpiarLista(lista, campos) {
  if (!Array.isArray(lista)) return [];
  return lista
    .filter(item => item && typeof item === 'object')
    .map(item => Object.fromEntries(campos.map(c => [c, String(item[c] ?? '').trim()])))
    .filter(item => Object.values(item).some(v => v !== ''));
}

// GET /:id/carnet — público: cualquiera que mire el catálogo puede abrirlo.
// Devuelve la mascota con el carnet adentro (null si todavía no se cargó), para
// que el modal pueda mostrar la ficha básica y el estado aunque falte lo médico.
router.get('/:id/carnet', async (req, res) => {
  try {
    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Mascota no encontrada' });
    }

    const carnet = await queryOne('SELECT * FROM pet_carnets WHERE pet_id = ?', [pet.id]);
    pet.carnet = carnet ? parsearCarnet(carnet) : null;

    res.json({ success: true, data: pet });
  } catch (err) {
    console.error('Get pet carnet error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch carnet' });
  }
});

// PUT /:id/carnet — crea o actualiza el carnet. Mismo permiso que editar la publicación.
router.put('/:id/carnet', requireAuth, async (req, res) => {
  try {
    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [req.params.id]);
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Mascota no encontrada' });
    }
    if (!await puedeEditar(pet, req.user)) {
      return res.status(403).json({ success: false, error: 'Solo podés cargar el carnet de tus propias publicaciones' });
    }

    const b = req.body || {};
    const peso = b.weight_kg === '' || b.weight_kg == null ? null : Number(b.weight_kg);
    if (peso !== null && (Number.isNaN(peso) || peso < 0)) {
      return res.status(400).json({ success: false, error: 'El peso debe ser un número' });
    }

    const valores = [
      String(b.gender || ''),
      String(b.birth_date || ''),
      String(b.color_markings || ''),
      String(b.microchip_id || ''),
      peso,
      b.spayed_neutered ? 1 : 0,
      JSON.stringify(limpiarLista(b.vaccinations, ['name', 'last_dose', 'next_dose', 'status'])),
      JSON.stringify(limpiarLista(b.diseases, ['name', 'status', 'notes'])),
      String(b.treatments || ''),
      String(b.allergies || ''),
      JSON.stringify(limpiarLista(b.medical_history, ['date', 'title', 'description'])),
      String(b.vet_name || ''),
      String(b.vet_clinic || ''),
      String(b.vet_phone || '')
    ];

    await runQuery(
      `INSERT INTO pet_carnets (pet_id, gender, birth_date, color_markings, microchip_id, weight_kg, spayed_neutered,
         vaccinations, diseases, treatments, allergies, medical_history, vet_name, vet_clinic, vet_phone)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (pet_id) DO UPDATE SET
         gender = EXCLUDED.gender, birth_date = EXCLUDED.birth_date, color_markings = EXCLUDED.color_markings,
         microchip_id = EXCLUDED.microchip_id, weight_kg = EXCLUDED.weight_kg, spayed_neutered = EXCLUDED.spayed_neutered,
         vaccinations = EXCLUDED.vaccinations, diseases = EXCLUDED.diseases, treatments = EXCLUDED.treatments,
         allergies = EXCLUDED.allergies, medical_history = EXCLUDED.medical_history,
         vet_name = EXCLUDED.vet_name, vet_clinic = EXCLUDED.vet_clinic, vet_phone = EXCLUDED.vet_phone,
         updated_at = CURRENT_TIMESTAMP`,
      [pet.id, ...valores]
    );

    const carnet = await queryOne('SELECT * FROM pet_carnets WHERE pet_id = ?', [pet.id]);
    res.json({ success: true, data: parsearCarnet(carnet) });
  } catch (err) {
    console.error('Guardar carnet error:', err);
    res.status(500).json({ success: false, error: 'Failed to save carnet' });
  }
});

// POST /:id/adopt — create adoption request / chat
router.post('/:id/adopt', requireAuth, async (req, res) => {
  try {
    const petId = req.params.id;
    const adopterId = req.user.id;
    const pet = await queryOne('SELECT * FROM pets WHERE id = ?', [petId]);
    
    if (!pet) {
      return res.status(404).json({ success: false, error: 'Pet not found' });
    }

    if (pet.user_id === adopterId) {
      return res.status(400).json({ success: false, error: 'No puedes adoptar tu propia mascota' });
    }

    // Check if chat already exists
    let chat = await queryOne('SELECT * FROM chats WHERE pet_id = ? AND adopter_id = ?', [petId, adopterId]);
    
    if (!chat) {
      const result = await runQuery(
        'INSERT INTO chats (pet_id, adopter_id, owner_id) VALUES (?, ?, ?)',
        [petId, adopterId, pet.user_id]
      );
      chat = await queryOne('SELECT * FROM chats WHERE id = ?', [result.lastInsertRowid]);
      
      // Create notification for owner
      const text = `${req.user.name} quiere adoptar a ${pet.name}. ¡Abre el chat para conversar!`;
      await runQuery(
        'INSERT INTO notifications (user_id, type, related_id, text) VALUES (?, ?, ?, ?)',
        [pet.user_id, 'adoption_request', chat.id, text]
      );
    }

    res.json({ success: true, data: { message: '¡Solicitud enviada! Revisa tus chats.', chat_id: chat.id } });
  } catch (err) {
    console.error('Adopt pet error:', err);
    res.status(500).json({ success: false, error: 'Failed to process adoption request' });
  }
});

module.exports = router;
