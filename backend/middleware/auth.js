const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'patamatch-dev-fallback-key';

const ROLES = {
  USUARIO: 'usuario',
  VOLUNTARIO: 'voluntario',
  REFUGIO: 'refugio',
  ADMIN: 'admin'
};

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

// Optional auth — sets req.user if token present, but doesn't fail
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    } catch (e) { /* ignore */ }
  }
  next();
}

// Deja el rol disponible en req.user sin restringir el acceso. Se usa cuando lo
// que decide el permiso es ser dueño del recurso, y el rol solo cambia el
// alcance: un usuario ve lo suyo, un admin ve todo.
async function attachRole(req, res, next) {
  try {
    const { queryOne } = require('../db/database');
    const user = await queryOne('SELECT role FROM users WHERE id = ?', [req.user.id]);
    req.user.role = user ? user.role : ROLES.USUARIO;
    next();
  } catch (err) {
    console.error('Error leyendo rol:', err);
    req.user.role = ROLES.USUARIO;
    next();
  }
}

// Restringe una ruta a ciertos roles. Se usa después de requireAuth:
//   router.get('/panel', requireAuth, requireRole(ROLES.REFUGIO, ROLES.ADMIN), ...)
//
// El rol se lee de la base en cada request y NO del token. El token dura 7
// días: si se guardara el rol adentro, un usuario degradado seguiría entrando
// con el rol viejo hasta que expire, y uno promovido tendría que volver a
// iniciar sesión. El costo es una consulta extra, solo en rutas privilegiadas.
function requireRole(...rolesPermitidos) {
  return async (req, res, next) => {
    try {
      const { queryOne } = require('../db/database');
      const user = await queryOne('SELECT role FROM users WHERE id = ?', [req.user.id]);

      if (!user) {
        return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
      }

      req.user.role = user.role;

      if (!rolesPermitidos.includes(user.role)) {
        return res.status(403).json({
          success: false,
          error: 'No tenés permisos para realizar esta acción'
        });
      }

      next();
    } catch (err) {
      console.error('Error verificando rol:', err);
      return res.status(500).json({ success: false, error: 'Error verificando permisos' });
    }
  };
}

module.exports = { requireAuth, optionalAuth, requireRole, attachRole, ROLES, JWT_SECRET };
