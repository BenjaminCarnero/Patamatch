/**
 * Genera las capturas de pantalla del sistema para la carpeta de documentación
 * (apartados 2.8 Prototipado y 2.13 Manual de Usuario).
 *
 * Se automatiza en vez de sacarlas a mano para que se puedan regenerar cuando
 * cambie la interfaz, y para que todas salgan con el mismo tamaño y encuadre.
 *
 *   node scripts/capturas.js            (contra localhost:3000)
 *   BASE_URL=https://... node scripts/capturas.js
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SALIDA = path.join(__dirname, '..', 'docs', 'capturas');
const VIEWPORT = { width: 1440, height: 900, deviceScaleFactor: 2 };

// Cuentas de demostración. Cada pantalla se captura con el rol que corresponde.
const CUENTAS = {
  refugio: { email: 'sarah@patamatch.com', password: 'demo123' },
  usuario: { email: 'david@patamatch.com', password: 'demo123' }
};

const PANTALLAS = [
  { archivo: '01-home', hash: 'home', sesion: null, descripcion: 'Portada pública' },
  { archivo: '02-catalogo-adopcion', hash: 'adoptar', sesion: null, descripcion: 'Catálogo con filtros' },
  { archivo: '03-mascotas-perdidas', hash: 'mascotas-perdidas', sesion: null, descripcion: 'Mapa de mascotas perdidas', espera: 3000 },
  { archivo: '04-login', hash: 'login', sesion: null, descripcion: 'Inicio de sesión' },
  { archivo: '05-asistente-ia', hash: 'home', sesion: null, descripcion: 'Asistente de adopción con IA', accion: 'asistente' },
  { archivo: '06-voluntariado', hash: 'voluntariado', sesion: 'usuario', descripcion: 'Alta de hogar de tránsito' },
  { archivo: '07-voluntariado-panel', hash: 'voluntariado', sesion: 'refugio', descripcion: 'Panel de hogares de tránsito' },
  { archivo: '08-donaciones', hash: 'donaciones', sesion: 'usuario', descripcion: 'Registro de donación' },
  { archivo: '09-panel-gestion', hash: 'backoffice', sesion: 'refugio', descripcion: 'Panel de gestión del refugio' },
  { archivo: '10-perfil-mi-zona', hash: 'perfil', sesion: 'usuario', descripcion: 'Perfil con la zona de alertas' }
];

async function iniciarSesion(page, cuenta) {
  const datos = await page.evaluate(async (c) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c)
    }).then(r => r.json());
    if (!r.success) return null;
    localStorage.setItem('patamatch_token', r.data.token);
    localStorage.setItem('patamatch_user', JSON.stringify(r.data.user));
    return r.data.user.email;
  }, cuenta);
  if (!datos) throw new Error(`No se pudo iniciar sesión con ${cuenta.email}`);
  return datos;
}

// Recorre el cuestionario del asistente para capturarlo con recomendaciones
// reales en pantalla, no con el formulario vacío.
async function abrirAsistente(page) {
  await page.evaluate(async () => {
    document.getElementById('asis-boton').click();
    await new Promise(r => setTimeout(r, 500));
    for (const idx of [1, 1, 0, 1, 1, 1, 2]) {
      const botones = [...document.querySelectorAll('#asis-opciones button')];
      if (!botones.length) break;
      botones[idx].click();
      await new Promise(r => setTimeout(r, 350));
    }
  });
  // Esperar a que la IA responda y las tarjetas estén dibujadas.
  await page.waitForFunction(
    () => document.querySelectorAll('#asis-cuerpo a[href="#adoptar"]').length > 0,
    { timeout: 30000 }
  ).catch(() => console.log('   (el asistente no respondió a tiempo)'));
  await page.evaluate(() => {
    const c = document.getElementById('asis-cuerpo');
    if (c) c.scrollTop = c.scrollHeight;
  });
  await new Promise(r => setTimeout(r, 1200));
}

(async () => {
  fs.mkdirSync(SALIDA, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new' });

  console.log(`Capturando ${BASE} → docs/capturas/\n`);

  for (const p of PANTALLAS) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    try {
      await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });

      if (p.sesion) await iniciarSesion(page, CUENTAS[p.sesion]);

      await page.goto(`${BASE}/#${p.hash}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await page.evaluate(() => window.scrollTo(0, 0));
      await new Promise(r => setTimeout(r, p.espera || 2000));

      if (p.accion === 'asistente') await abrirAsistente(page);

      const destino = path.join(SALIDA, `${p.archivo}.png`);
      await page.screenshot({ path: destino, fullPage: !p.accion });

      const kb = (fs.statSync(destino).size / 1024).toFixed(0);
      console.log(`  ✓ ${p.archivo}.png`.padEnd(32) + `${String(kb).padStart(5)} kB   ${p.descripcion}`);
    } catch (err) {
      console.log(`  ✗ ${p.archivo}: ${err.message.split('\n')[0]}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log(`\nListo. Las capturas están en ${SALIDA}`);
})();
