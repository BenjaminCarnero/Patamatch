const router = require('express').Router();
const { queryAll } = require('../db/database');
const { optionalAuth } = require('../middleware/auth');

// RF-16 — Asistente de adopción.
//
// Se fija un modelo concreto y no un alias 'latest': el comportamiento no debe
// cambiar solo entre hoy y la defensa.
//
// Se eligió el modelo "lite" tras medirlo: para esta tarea (elegir 3 mascotas de
// un catálogo chico y explicar por qué) responde en ~1,3s contra ~15s del flash
// completo, con las mismas recomendaciones. La diferencia es que el modelo
// grande gasta ~1000 tokens razonando algo que no lo necesita, y 15 segundos de
// espera en vivo se sienten como que la aplicación se colgó.
const MODELO = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`;

// El modelo está obligado a responder con esta forma exacta. Es la restricción
// más fuerte que tenemos: no queda lugar en la respuesta para texto libre fuera
// de tema, porque el formato lo impone la API y no el prompt.
const ESQUEMA = {
  type: 'OBJECT',
  properties: {
    mensaje: { type: 'STRING' },
    recomendaciones: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          pet_id: { type: 'INTEGER' },
          razon: { type: 'STRING' }
        },
        required: ['pet_id', 'razon']
      }
    },
    sugerir_transito: { type: 'BOOLEAN' }
  },
  required: ['mensaje', 'recomendaciones', 'sugerir_transito']
};

const INSTRUCCION = `Sos el asistente de adopción de PataMatch, una plataforma de adopción de mascotas.

REGLAS QUE NO PODÉS ROMPER:
- Recomendás mascotas ÚNICAMENTE de la lista del catálogo que se te pasa, usando su pet_id exacto. Si inventás una mascota que no está en la lista, el sistema la descarta.
- Máximo 3 recomendaciones, ordenadas de mejor a peor encaje.
- NO das consejos veterinarios, médicos ni de salud animal. Si te preguntan eso, aclarás que tienen que consultar a un veterinario.
- Solo hablás de adopción de mascotas en PataMatch. Cualquier otro tema queda fuera de tu alcance.
- Si ninguna mascota del catálogo encaja razonablemente con el perfil del hogar, devolvés la lista de recomendaciones vacía y ponés sugerir_transito en true.

ESTILO: español rioplatense (vos, no tú), cálido y breve. El campo "mensaje" son 1 o 2 oraciones de introducción. Cada "razon" es una sola oración que conecta la mascota con algo concreto que dijo la persona.`;

function describirPerfil(p) {
  const partes = [];
  partes.push(`Vive en ${p.vivienda === 'casa' ? 'una casa' : 'un departamento'}${p.patio ? ' con patio' : ' sin patio'}.`);
  partes.push(p.ninos ? 'Hay chicos en casa.' : 'No hay chicos en casa.');
  partes.push(p.otras_mascotas ? 'Ya tiene otras mascotas.' : 'No tiene otras mascotas.');
  const tiempos = { poco: 'menos de 1 hora por día', medio: 'entre 1 y 3 horas por día', mucho: 'más de 3 horas por día' };
  partes.push(`Puede dedicarle ${tiempos[p.tiempo] || 'un tiempo no especificado'}.`);
  partes.push(p.experiencia ? 'Ya tuvo mascotas antes.' : 'No tuvo mascotas antes.');
  if (p.preferencia && p.preferencia !== 'indistinto') partes.push(`Prefiere ${p.preferencia}.`);
  return partes.join(' ');
}

// El modelo puede devolver UNAVAILABLE por saturación: se reintenta antes de
// darle un error al usuario, porque esto se usa en vivo durante la demo.
async function llamarGemini(cuerpo, intentos = 3) {
  let ultimoError;
  for (let i = 0; i < intentos; i++) {
    const r = await fetch(`${API_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo)
    });
    const j = await r.json().catch(() => ({}));

    if (!j.error) return j;
    ultimoError = j.error;

    const recuperable = ['UNAVAILABLE', 'RESOURCE_EXHAUSTED', 'INTERNAL'].includes(j.error.status);
    if (!recuperable) break;
    await new Promise(res => setTimeout(res, 800 * (i + 1)));
  }
  const err = new Error(ultimoError?.message || 'Error llamando al modelo');
  err.status = ultimoError?.status;
  throw err;
}

// POST /recomendar — recibe el perfil del hogar y devuelve mascotas del catálogo.
router.post('/recomendar', optionalAuth, async (req, res) => {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.status(503).json({ success: false, error: 'El asistente no está configurado en este momento.' });
    }

    const { perfil } = req.body;
    if (!perfil || !perfil.vivienda) {
      return res.status(400).json({ success: false, error: 'Falta el perfil del hogar' });
    }

    // El catálogo real: solo mascotas publicadas y todavía disponibles.
    // image_url se trae para poder mostrar la tarjeta, pero no se manda al
    // modelo: no aporta nada a la recomendación y agranda el prompt al pedo.
    const disponibles = await queryAll(
      'SELECT id, name, species, breed, age, size, location, description, image_url FROM pets WHERE is_adopted = 0'
    );

    if (disponibles.length === 0) {
      return res.json({
        success: true,
        data: { mensaje: 'Por ahora no hay mascotas disponibles en el catálogo.', recomendaciones: [], sugerir_transito: false }
      });
    }

    const catalogo = disponibles.map(p => ({
      pet_id: p.id, nombre: p.name, especie: p.species, raza: p.breed,
      edad: p.age, tamano: p.size, zona: p.location, descripcion: p.description
    }));

    const respuesta = await llamarGemini({
      systemInstruction: { parts: [{ text: INSTRUCCION }] },
      contents: [{
        role: 'user',
        parts: [{ text: `CATÁLOGO DISPONIBLE:\n${JSON.stringify(catalogo)}\n\nPERFIL DEL HOGAR:\n${describirPerfil(perfil)}` }]
      }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: ESQUEMA, temperature: 0.4 }
    });

    const texto = respuesta.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!texto) {
      return res.status(502).json({ success: false, error: 'El asistente no devolvió una respuesta utilizable.' });
    }

    const salida = JSON.parse(texto);

    // Validación: cualquier pet_id que no exista en el catálogo real se
    // descarta. Es la red que atrapa una alucinación antes de la pantalla.
    const porId = new Map(disponibles.map(p => [p.id, p]));
    const recomendaciones = (salida.recomendaciones || [])
      .filter(r => porId.has(r.pet_id))
      .slice(0, 3)
      .map(r => ({ ...porId.get(r.pet_id), razon: r.razon }));

    const descartadas = (salida.recomendaciones || []).length - recomendaciones.length;
    if (descartadas > 0) {
      console.warn(`Asistente: se descartaron ${descartadas} mascota(s) inexistente(s)`);
    }

    res.json({
      success: true,
      data: {
        mensaje: salida.mensaje,
        recomendaciones,
        // Si no quedó ninguna válida, ofrecer tránsito es la salida útil.
        sugerir_transito: Boolean(salida.sugerir_transito) || recomendaciones.length === 0
      }
    });
  } catch (err) {
    console.error('Asistente error:', err.message);
    const saturado = ['UNAVAILABLE', 'RESOURCE_EXHAUSTED'].includes(err.status);
    res.status(saturado ? 503 : 500).json({
      success: false,
      error: saturado
        ? 'El asistente está con mucha demanda en este momento. Probá de nuevo en unos segundos.'
        : 'No pudimos generar recomendaciones ahora mismo.'
    });
  }
});

module.exports = router;
