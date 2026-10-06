// Gráficos del panel de gestión. Son SVG/HTML a mano (sin librería): el panel
// muestra pocas series y pocos puntos, y así el estilo queda alineado con el
// resto de la interfaz. Reglas que siguen todos:
//   - marcas finas (barras de hasta 24px), punta redondeada, base recta
//   - 2px de separación en color de fondo entre marcas que se tocan
//   - el texto nunca lleva el color de la serie; la identidad la da la marca
//   - leyenda siempre que haya 2 o más series; tooltip al pasar el mouse

const TEXTO = '#44403c';   // stone-700
const TEXTO_SUAVE = '#78716c'; // stone-500
const GRILLA = '#e7e5e4';  // stone-200
const FONDO = '#ffffff';

export function esc(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ---------- Tooltip compartido ----------

let tooltip = null;
function asegurarTooltip() {
  if (tooltip) return tooltip;
  tooltip = document.createElement('div');
  tooltip.className = 'fixed z-[300] pointer-events-none hidden bg-stone-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl';
  document.body.appendChild(tooltip);
  return tooltip;
}

// Cualquier elemento con data-tip muestra su texto al pasar el mouse. Se
// delega en el contenedor para no colgar un listener por marca.
export function activarTooltips(contenedor) {
  const tip = asegurarTooltip();
  contenedor.addEventListener('mousemove', (e) => {
    const marca = e.target.closest('[data-tip]');
    if (!marca) { tip.classList.add('hidden'); return; }
    tip.innerHTML = marca.dataset.tip;
    tip.classList.remove('hidden');
    tip.style.left = `${e.clientX + 12}px`;
    tip.style.top = `${e.clientY - 28}px`;
  });
  contenedor.addEventListener('mouseleave', () => tip.classList.add('hidden'));
}

function leyenda(series) {
  return `<div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
    ${series.map(s => `<span class="inline-flex items-center gap-1.5 text-[11px] text-stone-600">
      <span class="w-2.5 h-2.5 rounded-sm" style="background:${s.color}"></span>${esc(s.label)}
    </span>`).join('')}
  </div>`;
}

function escalaMax(valores) {
  const max = Math.max(1, ...valores);
  // Redondea hacia arriba a un número "limpio" para los ticks del eje.
  const paso = max <= 5 ? 1 : max <= 10 ? 2 : max <= 20 ? 5 : Math.pow(10, Math.floor(Math.log10(max))) / 2;
  return Math.ceil(max / paso) * paso;
}

const MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export function etiquetaMes(mes) {
  return MES_CORTO[Number(mes.slice(5, 7)) - 1];
}

// ---------- Columnas por mes (1 o más series) ----------
// filas: [{ mes: '2026-04', ...valores }], series: [{ key, label, color }]
export function columnasPorMes(filas, series, { formato = (v) => v, vacio = 'Sin actividad en los últimos 6 meses.' } = {}) {
  const valores = filas.flatMap(f => series.map(s => Number(f[s.key]) || 0));
  if (!valores.some(v => v > 0)) return `<p class="text-sm text-stone-400">${vacio}</p>`;

  const W = 560, H = 190, padL = 44, padR = 8, padT = 14, padB = 26;
  const ancho = W - padL - padR, alto = H - padT - padB;
  const max = escalaMax(valores);
  const grupo = ancho / filas.length;
  const barra = Math.min(24, (grupo - 12) / series.length - 2);
  // Con máximos chicos, 4 ticks repetirían el mismo entero redondeado.
  const ticks = Math.max(1, Math.min(4, max));

  const grilla = Array.from({ length: ticks + 1 }, (_, i) => {
    const y = padT + alto - (alto * i) / ticks;
    const v = (max * i) / ticks;
    return `<line x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}" stroke="${GRILLA}" stroke-width="1"/>
            <text x="${padL - 6}" y="${y + 3}" text-anchor="end" font-size="10" fill="${TEXTO_SUAVE}">${formato(Math.round(v))}</text>`;
  }).join('');

  const columnas = filas.map((f, i) => {
    const x0 = padL + grupo * i + (grupo - (barra + 2) * series.length) / 2;
    const ultima = i === filas.length - 1;
    return series.map((s, j) => {
      const v = Number(f[s.key]) || 0;
      const h = (alto * v) / max;
      const x = x0 + (barra + 2) * j;
      const y = padT + alto - h;
      // Punta redondeada 4px, base recta: se dibuja como path solo si hay altura.
      const r = Math.min(4, h);
      const path = h === 0 ? '' :
        `M${x},${y + alto - (alto - h)} V${y + r} Q${x},${y} ${x + r},${y} H${x + barra - r} Q${x + barra},${y} ${x + barra},${y + r} V${padT + alto} Z`;
      const tip = `<strong>${esc(s.label)}</strong> · ${etiquetaMes(f.mes)}<br>${esc(formato(v))}`;
      return `<g data-tip="${esc(tip)}">
        <rect x="${x - 2}" y="${padT}" width="${barra + 4}" height="${alto}" fill="transparent"/>
        ${path ? `<path d="${path}" fill="${s.color}"/>` : ''}
        ${ultima && v > 0 ? `<text x="${x + barra / 2}" y="${y - 4}" text-anchor="middle" font-size="10" font-weight="700" fill="${TEXTO}">${esc(formato(v))}</text>` : ''}
      </g>`;
    }).join('') + `<text x="${padL + grupo * i + grupo / 2}" y="${H - 8}" text-anchor="middle" font-size="11" fill="${TEXTO_SUAVE}">${etiquetaMes(f.mes)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" font-family="inherit" role="img">
      ${grilla}${columnas}
    </svg>${series.length > 1 ? leyenda(series) : ''}`;
}

// ---------- Barras horizontales (una serie, magnitud) ----------
// items: [{ label, n }]
export function barrasHorizontales(items, color, { vacio = 'Sin datos todavía.' } = {}) {
  if (!items.length) return `<p class="text-sm text-stone-400">${vacio}</p>`;
  const max = Math.max(1, ...items.map(i => i.n));
  return `<div class="space-y-2.5">${items.map(i => `
    <div class="grid items-center gap-3" style="grid-template-columns: 96px 1fr 32px" data-tip="${esc(`<strong>${i.label}</strong><br>${i.n}`)}">
      <span class="text-xs text-stone-600 truncate">${esc(i.label)}</span>
      <div class="h-3 rounded-r-[4px] overflow-hidden bg-stone-100">
        <div class="h-full rounded-r-[4px]" style="width:${(i.n / max) * 100}%;background:${color}"></div>
      </div>
      <span class="text-xs font-bold text-stone-700 text-right">${i.n}</span>
    </div>`).join('')}</div>`;
}

// ---------- Barra apilada (parte del todo) ----------
// segmentos: [{ label, n, color, icon }]
export function barraApilada(segmentos, { vacio = 'Sin datos todavía.' } = {}) {
  const total = segmentos.reduce((a, s) => a + s.n, 0);
  if (!total) return `<p class="text-sm text-stone-400">${vacio}</p>`;
  const visibles = segmentos.filter(s => s.n > 0);
  return `
    <div class="flex h-6 rounded-[4px] overflow-hidden" style="gap:2px;background:${FONDO}">
      ${visibles.map(s => {
        const pct = (s.n / total) * 100;
        return `<div class="h-full flex items-center justify-center text-[11px] font-bold text-white" style="width:${pct}%;background:${s.color}" data-tip="${esc(`<strong>${s.label}</strong><br>${s.n} de ${total} (${Math.round(pct)}%)`)}">
          ${pct >= 5 ? s.n : ''}
        </div>`;
      }).join('')}
    </div>
    <div class="flex flex-wrap gap-x-4 gap-y-1 mt-3">
      ${segmentos.map(s => `<span class="inline-flex items-center gap-1.5 text-[11px] text-stone-600">
        <span class="w-2.5 h-2.5 rounded-sm" style="background:${s.color}"></span>
        ${s.icon ? `<span class="material-symbols-outlined text-[13px] text-stone-500">${s.icon}</span>` : ''}${esc(s.label)} · <strong class="text-stone-800">${s.n}</strong>
      </span>`).join('')}
    </div>`;
}

// ---------- Medidor (un valor contra un límite) ----------
export function medidor(valor, total, color, { label = '' } = {}) {
  const pct = total ? Math.round((valor / total) * 100) : 0;
  return `
    <div class="flex items-end justify-between mb-2">
      <span class="text-xs text-stone-600">${esc(label)}</span>
      <span class="text-sm font-bold text-stone-800">${valor} <span class="text-stone-400 font-normal">/ ${total}</span></span>
    </div>
    <div class="h-3 rounded-[4px] bg-stone-100 overflow-hidden" data-tip="${esc(`${pct}% ${label}`)}">
      <div class="h-full rounded-[4px]" style="width:${pct}%;background:${color}"></div>
    </div>`;
}

// Tarjeta contenedora de cada gráfico, con título y subtítulo.
export function tarjeta(titulo, subtitulo, cuerpo, { icono = 'bar_chart', clase = '' } = {}) {
  return `
    <section class="bg-white rounded-2xl border border-stone-100 p-5 ${clase}">
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 class="text-sm font-bold text-stone-800 flex items-center gap-1.5">
            <span class="material-symbols-outlined text-[18px] text-[#D96C4A]">${icono}</span>${esc(titulo)}
          </h3>
          ${subtitulo ? `<p class="text-[11px] text-stone-500 mt-0.5">${esc(subtitulo)}</p>` : ''}
        </div>
      </div>
      ${cuerpo}
    </section>`;
}
