const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { queryOne, runQuery } = require('../db/database');
const { requireAuth, requireRole, ROLES, JWT_SECRET } = require('../middleware/auth');
const { sanitizeHTML } = require('../middleware/sanitize');

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, city } = req.body;

    if (!name || !email || !password || !city) {
      return res.status(400).json({ success: false, error: 'All fields are required (name, email, password, city)' });
    }

    const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ success: false, error: 'Email already registered' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    // Sin columna `role` en el INSERT: todo registro nuevo queda como
    // 'usuario' por el DEFAULT de la tabla, sin importar qué mande el cliente.
    const result = await runQuery(
      'INSERT INTO users (name, email, password_hash, city) VALUES (?, ?, ?, ?)',
      [sanitizeHTML(name), email, password_hash, sanitizeHTML(city)]
    );

    const user = await queryOne('SELECT id, name, email, city, role, lat, lng, created_at FROM users WHERE id = ?', [result.lastInsertRowid]);
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ success: true, data: { token, user } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, error: 'Failed to register user' });
  }
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const user = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });

    const { password_hash, ...userData } = user;
    res.json({ success: true, data: { token, user: userData } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, error: 'Failed to login' });
  }
});

// GET /me
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await queryOne('SELECT id, name, email, city, avatar_url, role, lat, lng, created_at FROM users WHERE id = ?', [req.user.id]);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch user data' });
  }
});

// PUT /me
router.put('/me', requireAuth, async (req, res) => {
  try {
    // `role` se omite a propósito: un usuario no puede cambiarse el rol a sí
    // mismo. Promover a refugio o admin es tarea del panel de administración.
    const { name, avatar_url, lat, lng } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    await runQuery(
      'UPDATE users SET name = ?, avatar_url = ? WHERE id = ?',
      [sanitizeHTML(name), avatar_url || '', req.user.id]
    );

    // "Mi zona" (RF-09): solo se actualiza si el usuario fijó un punto en el mapa.
    if (lat != null && lng != null && !Number.isNaN(Number(lat)) && !Number.isNaN(Number(lng))) {
      await runQuery(
        'UPDATE users SET lat = ?, lng = ? WHERE id = ?',
        [Number(lat), Number(lng), req.user.id]
      );
    }

    const user = await queryOne('SELECT id, name, email, city, avatar_url, role, lat, lng, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Update me error:', err);
    res.status(500).json({ success: false, error: 'Failed to update user data' });
  }
});

// PUT /users/:id/role — un admin cambia el rol de un usuario.
// Es el mecanismo por el que un refugio queda verificado: sin este paso
// cualquiera podría declararse refugio y recibir donaciones a su nombre.
router.put('/users/:id/role', requireAuth, requireRole(ROLES.ADMIN), async (req, res) => {
  try {
    const { role } = req.body;
    const targetId = Number(req.params.id);

    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Rol inválido. Válidos: ${Object.values(ROLES).join(', ')}`
      });
    }

    // Evita que el admin se quite el rol a sí mismo y deje el sistema sin nadie
    // que pueda verificar refugios.
    if (targetId === req.user.id && role !== ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        error: 'No podés quitarte a vos mismo el rol de administrador'
      });
    }

    const target = await queryOne('SELECT id FROM users WHERE id = ?', [targetId]);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    await runQuery('UPDATE users SET role = ? WHERE id = ?', [role, targetId]);

    const user = await queryOne('SELECT id, name, email, city, role FROM users WHERE id = ?', [targetId]);
    res.json({ success: true, data: user });
  } catch (err) {
    console.error('Cambiar rol error:', err);
    res.status(500).json({ success: false, error: 'Failed to update role' });
  }
});

module.exports = router;
