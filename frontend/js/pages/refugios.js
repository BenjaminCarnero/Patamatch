import { getRefugiosMapa, buscarRefugiosCercanos } from '../api.js';

// Directorio de refugios con mapa. Muestra dos capas:
//   - los refugios registrados y verificados en PataMatch (pin terracota),
//   - los que existen en la zona según Google Places / OpenStreetMap (pin gris),
// para que quien busca dónde adoptar, donar o llevar un animal vea también los
// refugios que todavía no están en la plataforma.

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function render() {
    return `
    <div class="max-w-7xl mx-auto px-6 py-12">
        <div class="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div class="max-w-2xl">
                <h1 class="font-headline-lg text-stone-800 mb-2">Refugios</h1>
                <p class="text-stone-600">
                    Dónde están los refugios que publican en PataMatch y cuáles hay cerca de tu zona.
                    Podés ir a sus mascotas en adopción o registrar una donación.
                </p>
            </div>
            <div class="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-[#D96C4A]"></span>Refugio en PataMatch</span>
                <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-stone-500"></span>Encontrado en la zona</span>
            </div>
        </div>

        <div class="grid lg:grid-cols-12 gap-6">
            <div class="lg:col-span-7">
                <div class="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                    <div class="p-3 border-b border-stone-100 flex flex-wrap gap-2">
                        <form id="ref-buscar-form" class="flex-1 min-w-[280px] flex gap-2">
                            <input id="ref-buscar" type="text" placeholder="Buscar una ciudad o zona (ej. Córdoba, Argentina)"
                                class="flex-1 px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white outline-none"/>
                            <button type="submit" class="px-4 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold inline-flex items-center gap-1">
                                <span class="material-symbols-outlined text-[18px]">search</span>Ir
                            </button>
                        </form>
                        <button id="ref-buscar-zona" class="flex-1 sm:flex-none justify-center px-4 py-2.5 rounded-xl bg-[#D96C4A] text-white text-sm font-semibold inline-flex items-center gap-1 shadow-sm">
                            <span class="material-symbols-outlined text-[18px]">travel_explore</span>Buscar refugios en esta zona
                        </button>
                    </div>
                    <div id="ref-mapa" class="h-[520px] bg-stone-100"></div>
                </div>
                <p id="ref-proveedor" class="text-[11px] text-stone-400 mt-2"></p>
            </div>

            <div class="lg:col-span-5 space-y-6">
                <section>
                    <h2 class="font-bold text-lg text-stone-800 mb-1">En PataMatch</h2>
                    <p class="text-xs text-stone-500 mb-3">Refugios verificados. Tocá uno para ubicarlo en el mapa.</p>
                    <div id="ref-lista" class="space-y-3"><p class="text-sm text-stone-400">Cargando refugios...</p></div>
                </section>
                <section id="ref-externos-bloque" class="hidden">
                    <h2 class="font-bold text-lg text-stone-800 mb-1">Encontrados en la zona</h2>
                    <p class="text-xs text-stone-500 mb-3" id="ref-externos-sub"></p>
                    <div id="ref-externos" class="space-y-2"></div>
                </section>
            </div>
        </div>
    </div>`;
}

async function cargarLeaflet() {
    if (window.L) return;
    await new Promise((resolve) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

function pin(color, icono) {
    return L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div style="width:36px;height:36px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center">
                 <span class="material-symbols-outlined" style="transform:rotate(45deg);color:#fff;font-size:18px;font-variation-settings:'FILL' 1">${icono}</span>
               </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -34]
    });
}

export async function init() {
    const $ = (id) => document.getElementById(id);
    const aviso = (msg, tipo) => window.PataMatch.toast(msg, tipo);

    await cargarLeaflet();

    // Centro inicial: la zona del usuario si la fijó; si no, se encuadra en los refugios.
    const yo = window.PataMatch.user;
    const centro = yo?.lat != null ? [Number(yo.lat), Number(yo.lng)] : [19.4326, -99.1332];
    const mapa = L.map('ref-mapa', { zoomControl: false }).setView(centro, 11);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri', maxZoom: 18
    }).addTo(mapa);
    L.control.zoom({ position: 'bottomright' }).addTo(mapa);
    setTimeout(() => mapa.invalidateSize(), 150);

    const capaPropios = L.layerGroup().addTo(mapa);
    const capaExternos = L.layerGroup().addTo(mapa);
    const marcadores = {};

    const pinPropio = pin('#D96C4A', 'pets');
    const pinExterno = pin('#57534e', 'home');

    async function cargarRefugios() {
        const cont = $('ref-lista');
        try {
            const { data } = await getRefugiosMapa();
            if (!data.length) {
                cont.innerHTML = '<p class="text-sm text-stone-500">Todavía no hay refugios verificados.</p>';
                return;
            }

            cont.innerHTML = data.map(r => `
                <div class="bg-white rounded-xl border border-stone-100 p-4 ${r.lat != null ? 'cursor-pointer hover:border-[#D96C4A]/50' : ''} transition-colors" data-refugio="${r.id}">
                    <div class="flex items-center gap-3">
                        ${r.avatar_url
                            ? `<img src="${esc(r.avatar_url)}" alt="" class="w-11 h-11 rounded-xl object-cover bg-stone-100 shrink-0"/>`
                            : `<div class="w-11 h-11 rounded-xl bg-[#D96C4A]/10 text-[#D96C4A] flex items-center justify-center shrink-0"><span class="material-symbols-outlined">pets</span></div>`}
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-stone-800 text-sm truncate">${esc(r.name)}
                                <span class="material-symbols-outlined text-[14px] text-green-600 align-middle" title="Refugio verificado">verified</span>
                            </p>
                            <p class="text-xs text-stone-500 truncate">
                                <span class="material-symbols-outlined text-[13px] align-middle">location_on</span>
                                ${esc(r.city) || 'Sin zona'}${r.lat == null ? ' · <span class="text-amber-600">sin ubicación en el mapa</span>' : ''}
                            </p>
                        </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-stone-600">
                        <span><strong class="text-stone-800">${r.en_adopcion}</strong> en adopción</span>
                        <span><strong class="text-stone-800">${r.adoptadas}</strong> adoptadas</span>
                        ${r.en_transito ? `<span><strong class="text-stone-800">${r.en_transito}</strong> en tránsito</span>` : ''}
                    </div>
                    <div class="flex gap-2 mt-3">
                        <a href="#adoptar" class="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200">Ver mascotas</a>
                        <a href="#donaciones" class="flex-1 text-center text-xs font-semibold px-3 py-2 rounded-lg bg-[#D96C4A] text-white">Donar</a>
                    </div>
                </div>`).join('');

            capaPropios.clearLayers();
            const puntos = [];
            data.forEach(r => {
                if (r.lat == null || r.lng == null) return;
                const m = L.marker([r.lat, r.lng], { icon: pinPropio }).bindPopup(`
                    <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:180px">
                        <p style="font-weight:700;margin:0 0 2px">${esc(r.name)}</p>
                        <p style="margin:0;color:#78716c;font-size:12px">${esc(r.city)}</p>
                        <p style="margin:6px 0 0;font-size:12px"><b>${r.en_adopcion}</b> en adopción · <b>${r.adoptadas}</b> adoptadas</p>
                        <a href="#donaciones" style="display:inline-block;margin-top:8px;font-size:12px;font-weight:700;color:#D96C4A">Donar a este refugio →</a>
                    </div>`);
                capaPropios.addLayer(m);
                marcadores[r.id] = m;
                puntos.push([r.lat, r.lng]);
            });

            // Sin zona propia, el mapa encuadra todos los refugios registrados.
            if (yo?.lat == null && puntos.length) {
                mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 12 });
            }

            cont.querySelectorAll('[data-refugio]').forEach(card =>
                card.addEventListener('click', (e) => {
                    if (e.target.closest('a')) return;
                    const m = marcadores[card.dataset.refugio];
                    if (!m) return;
                    mapa.flyTo(m.getLatLng(), 13, { duration: 0.8 });
                    m.openPopup();
                    $('ref-mapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }));
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600">${esc(err.message)}</p>`;
        }
    }

    // Geocodificación del buscador con Nominatim (OpenStreetMap): gratis y sin clave.
    $('ref-buscar-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = $('ref-buscar').value.trim();
        if (!q) return;
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
                headers: { 'Accept-Language': 'es' }
            });
            const [lugar] = await resp.json();
            if (!lugar) { aviso('No encontramos ese lugar', 'error'); return; }
            mapa.flyTo([Number(lugar.lat), Number(lugar.lon)], 12, { duration: 0.8 });
            mapa.once('moveend', buscarEnZona);
        } catch (err) {
            aviso('No se pudo buscar el lugar', 'error');
        }
    });

    async function buscarEnZona() {
        const btn = $('ref-buscar-zona');
        const bloque = $('ref-externos-bloque');
        const cont = $('ref-externos');
        const c = mapa.getCenter();
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Buscando...';
        try {
            const { data } = await buscarRefugiosCercanos(c.lat.toFixed(5), c.lng.toFixed(5), 15000);
            bloque.classList.remove('hidden');
            $('ref-proveedor').textContent = data.proveedor === 'google'
                ? 'Refugios de la zona provistos por Google Places.'
                : 'Refugios de la zona provistos por OpenStreetMap (sin clave de Google configurada).';
            $('ref-externos-sub').textContent = data.lugares.length
                ? `${data.lugares.length} refugio(s) a menos de 15 km del centro del mapa. No están registrados en PataMatch.`
                : 'No encontramos refugios en esta zona. Probá moviendo el mapa o buscando otra ciudad.';

            capaExternos.clearLayers();
            cont.innerHTML = data.lugares.map(l => `
                <div class="bg-white rounded-xl border border-stone-100 p-3 cursor-pointer hover:border-stone-300 transition-colors" data-externo="${esc(l.id)}">
                    <p class="font-semibold text-stone-800 text-sm">${esc(l.name)}</p>
                    <p class="text-xs text-stone-500">${esc(l.address) || 'Dirección no disponible'}</p>
                    <div class="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-stone-500">
                        ${l.rating != null ? `<span class="inline-flex items-center gap-0.5"><span class="material-symbols-outlined text-[13px] text-amber-500" style="font-variation-settings:'FILL' 1">star</span>${l.rating} (${l.reviews || 0})</span>` : ''}
                        ${l.phone ? `<a href="tel:${esc(l.phone)}" class="inline-flex items-center gap-0.5 hover:text-[#D96C4A]"><span class="material-symbols-outlined text-[13px]">call</span>${esc(l.phone)}</a>` : ''}
                        ${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 hover:text-[#D96C4A]"><span class="material-symbols-outlined text-[13px]">open_in_new</span>Ver ficha</a>` : ''}
                    </div>
                </div>`).join('');

            const externos = {};
            data.lugares.forEach(l => {
                const m = L.marker([l.lat, l.lng], { icon: pinExterno }).bindPopup(`
                    <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:160px">
                        <p style="font-weight:700;margin:0 0 2px">${esc(l.name)}</p>
                        <p style="margin:0;color:#78716c;font-size:12px">${esc(l.address)}</p>
                        ${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#D96C4A">Ver ficha →</a>` : ''}
                    </div>`);
                capaExternos.addLayer(m);
                externos[l.id] = m;
            });

            cont.querySelectorAll('[data-externo]').forEach(card =>
                card.addEventListener('click', (e) => {
                    if (e.target.closest('a')) return;
                    const m = externos[card.dataset.externo];
                    mapa.flyTo(m.getLatLng(), 14, { duration: 0.8 });
                    m.openPopup();
                    $('ref-mapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }));
        } catch (err) {
            aviso(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-symbols-outlined text-[18px]">travel_explore</span>Buscar refugios en esta zona';
        }
    }

    $('ref-buscar-zona').addEventListener('click', buscarEnZona);

    cargarRefugios();
}
