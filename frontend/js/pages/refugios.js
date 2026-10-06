import { getRefugiosMapa, buscarRefugiosCercanos, getRefugiosComunidad, sugerirRefugio } from '../api.js';

// Directorio de refugios con mapa. Muestra tres capas:
//   - los refugios registrados y verificados en PataMatch (pin terracota),
//   - los que aportó la comunidad y aprobó un admin (pin verde): los refugios
//     chicos no figuran en ninguna base de mapas, solo los conoce quien vive cerca,
//   - los que existen en la zona según Google Places / OpenStreetMap (pin gris),
// para que quien busca dónde adoptar, donar o llevar un animal vea también los
// refugios que todavía no están en la plataforma.

const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Con el mapa más alejado que esto el área visible abarca cientos de km y la
// búsqueda devolvería un recorte arbitrario: se pide acercar el mapa.
const ZOOM_MIN_BUSQUEDA = 10;

// Los datos externos (OSM) son colaborativos: solo se enlazan URLs http(s).
const urlHttp = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

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
            <div class="flex flex-col items-start md:items-end gap-3">
                <button type="button" data-sugerir class="inline-flex items-center gap-1.5 bg-white border border-stone-200 hover:border-[#466641] text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition-colors">
                    <span class="material-symbols-outlined text-[18px] text-[#466641]">add_location_alt</span>Sumá un refugio
                </button>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
                    <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-[#D96C4A]"></span>Refugio en PataMatch</span>
                    <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-[#466641]"></span>Aportado por la comunidad</span>
                    <span class="inline-flex items-center gap-1.5"><span class="w-3 h-3 rounded-full bg-stone-500"></span>Encontrado en la zona</span>
                </div>
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
                <section id="ref-comunidad-bloque">
                    <h2 class="font-bold text-lg text-stone-800 mb-1">Aportados por la comunidad</h2>
                    <p class="text-xs text-stone-500 mb-3">Refugios chicos que sumaron vecinos y revisó el equipo de PataMatch.</p>
                    <div id="ref-comunidad" class="space-y-2"><p class="text-sm text-stone-400">Cargando...</p></div>
                </section>
                <section id="ref-externos-bloque">
                    <h2 class="font-bold text-lg text-stone-800 mb-1">Encontrados en la zona</h2>
                    <p class="text-xs text-stone-500 mb-3" id="ref-externos-sub">Buscando refugios en la zona del mapa...</p>
                    <div id="ref-externos" class="space-y-2 max-h-[480px] overflow-y-auto custom-scrollbar pr-1"></div>
                </section>
            </div>
        </div>
    </div>

    <!-- Sumá un refugio -->
    <div id="ref-sug-modal" class="fixed inset-0 z-[200] hidden items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="ref-sug-titulo">
        <div id="ref-sug-overlay" class="absolute inset-0 bg-black/50 backdrop-blur-sm"></div>
        <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 sm:p-8 z-10 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-start mb-1">
                <h2 id="ref-sug-titulo" class="font-bold text-xl text-stone-800">Sumá un refugio</h2>
                <button type="button" id="ref-sug-cerrar" class="p-1.5 -mr-1.5 rounded-full hover:bg-stone-100" aria-label="Cerrar">
                    <span class="material-symbols-outlined text-stone-500">close</span>
                </button>
            </div>
            <p class="text-sm text-stone-500 mb-5">
                ¿Conocés un refugio o grupo de rescate que no está en el mapa? Cargalo y lo revisamos antes de publicarlo.
            </p>
            <form id="ref-sug-form" class="space-y-4" novalidate>
                <div>
                    <label for="ref-sug-nombre" class="block text-sm font-semibold text-stone-700 mb-1">Nombre del refugio</label>
                    <input id="ref-sug-nombre" maxlength="80" required placeholder="Ej: Patitas del Pueblo"
                        class="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white outline-none focus:ring-2 focus:ring-[#466641]/30"/>
                </div>
                <div>
                    <label for="ref-sug-localidad" class="block text-sm font-semibold text-stone-700 mb-1">Localidad</label>
                    <div class="flex gap-2">
                        <input id="ref-sug-localidad" maxlength="80" required placeholder="Ej: Villa del Rosario, Córdoba"
                            class="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white outline-none focus:ring-2 focus:ring-[#466641]/30"/>
                        <button type="button" id="ref-sug-ubicar" class="px-3 py-2.5 rounded-xl bg-stone-800 text-white text-sm font-semibold inline-flex items-center gap-1 shrink-0">
                            <span class="material-symbols-outlined text-[18px]">search</span>Ubicar
                        </button>
                    </div>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-stone-700 mb-1">Dónde queda</label>
                    <p class="text-xs text-stone-500 mb-2">Tocá el mapa para marcar el punto. Si es una casa, marcá una zona cercana y no la puerta.</p>
                    <div id="ref-sug-mapa" class="w-full h-56 rounded-xl border border-stone-200 overflow-hidden bg-stone-100"></div>
                    <div class="flex flex-wrap items-center justify-between gap-2 mt-2">
                        <p id="ref-sug-estado" class="text-xs text-amber-700">Todavía no marcaste el punto en el mapa.</p>
                        <button type="button" id="ref-sug-gps" class="text-xs font-semibold text-[#466641] hover:underline inline-flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">my_location</span>Usar mi ubicación actual
                        </button>
                    </div>
                    <label class="flex items-start gap-2 mt-3 text-xs text-stone-600 cursor-pointer">
                        <input id="ref-sug-aprox" type="checkbox" checked class="mt-0.5 rounded border-stone-300 text-[#466641] focus:ring-[#466641]"/>
                        <span>Es una ubicación aproximada: en el mapa público se muestra redondeada, sin el punto exacto.</span>
                    </label>
                </div>
                <div>
                    <label for="ref-sug-referencia" class="block text-sm font-semibold text-stone-700 mb-1">Referencia <span class="font-normal text-stone-400">(opcional)</span></label>
                    <input id="ref-sug-referencia" maxlength="160" placeholder="Ej: Barrio Centro, cerca de la plaza"
                        class="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white outline-none focus:ring-2 focus:ring-[#466641]/30"/>
                </div>
                <div>
                    <label for="ref-sug-link" class="block text-sm font-semibold text-stone-700 mb-1">Link de su perfil o web</label>
                    <input id="ref-sug-link" maxlength="300" required placeholder="https://instagram.com/usuario"
                        class="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white outline-none focus:ring-2 focus:ring-[#466641]/30"/>
                    <p class="text-xs text-stone-500 mt-1">Instagram, Facebook o web. Lo usamos para verificarlo y para que la gente pueda contactarlos.</p>
                </div>
                <div>
                    <label for="ref-sug-notas" class="block text-sm font-semibold text-stone-700 mb-1">Observaciones <span class="font-normal text-stone-400">(opcional)</span></label>
                    <textarea id="ref-sug-notas" rows="2" maxlength="300" placeholder="Ej: Perros y gatos. Reciben donaciones de alimento."
                        class="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm bg-stone-50 focus:bg-white outline-none focus:ring-2 focus:ring-[#466641]/30 resize-none"></textarea>
                </div>
                <button type="submit" id="ref-sug-enviar" class="w-full bg-[#466641] text-white py-3 rounded-xl font-bold hover:brightness-110 active:scale-[0.98] transition-all shadow-sm">
                    Enviar para revisión
                </button>
            </form>
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
    const capaComunidad = L.layerGroup().addTo(mapa);
    const capaExternos = L.layerGroup().addTo(mapa);
    const marcadores = {};
    const marcadoresComunidad = {};

    const pinPropio = pin('#D96C4A', 'pets');
    const pinComunidad = pin('#466641', 'volunteer_activism');
    const pinExterno = pin('#57534e', 'home');

    // Devuelve los puntos que dibujó, para encuadrar el mapa con todas las capas.
    async function cargarRefugios() {
        const cont = $('ref-lista');
        try {
            const { data } = await getRefugiosMapa();
            if (!data.length) {
                cont.innerHTML = '<p class="text-sm text-stone-500">Todavía no hay refugios verificados.</p>';
                return [];
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

            cont.querySelectorAll('[data-refugio]').forEach(card =>
                card.addEventListener('click', (e) => {
                    if (e.target.closest('a')) return;
                    const m = marcadores[card.dataset.refugio];
                    if (!m) return;
                    mapa.flyTo(m.getLatLng(), 13, { duration: 0.8 });
                    m.openPopup();
                    $('ref-mapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }));
            return puntos;
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600">${esc(err.message)}</p>`;
            return [];
        }
    }

    // Refugios que sumó la comunidad y aprobó un admin. Devuelve sus puntos.
    async function cargarComunidad() {
        const cont = $('ref-comunidad');
        try {
            const { data } = await getRefugiosComunidad();
            capaComunidad.clearLayers();
            Object.keys(marcadoresComunidad).forEach(k => delete marcadoresComunidad[k]);

            if (!data.length) {
                cont.innerHTML = `<p class="text-sm text-stone-500">Todavía nadie sumó un refugio.
                    ¿Conocés alguno? <button type="button" data-sugerir class="text-[#466641] font-semibold underline">Sumalo</button>.</p>`;
                cont.querySelector('[data-sugerir]').addEventListener('click', abrirSugerir);
                return [];
            }

            cont.innerHTML = data.map(s => `
                <div class="bg-white rounded-xl border border-stone-100 p-3 cursor-pointer hover:border-[#466641]/50 transition-colors" data-comunidad="${s.id}">
                    <p class="font-semibold text-stone-800 text-sm">${esc(s.name)}</p>
                    <p class="text-xs text-stone-500">${esc(s.city)}${s.address ? ' · ' + esc(s.address) : ''}</p>
                    ${s.notes ? `<p class="text-xs text-stone-600 mt-1">${esc(s.notes)}</p>` : ''}
                    <div class="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-stone-500">
                        ${s.approximate ? '<span class="inline-flex items-center gap-0.5"><span class="material-symbols-outlined text-[13px]">near_me</span>Ubicación aproximada</span>' : ''}
                        ${urlHttp(s.url) ? `<a href="${esc(urlHttp(s.url))}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-0.5 hover:text-[#466641]"><span class="material-symbols-outlined text-[13px]">open_in_new</span>Ver perfil</a>` : ''}
                    </div>
                </div>`).join('');

            const puntos = [];
            data.forEach(s => {
                const m = L.marker([s.lat, s.lng], { icon: pinComunidad }).bindPopup(`
                    <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:170px">
                        <p style="font-weight:700;margin:0 0 2px">${esc(s.name)}</p>
                        <p style="margin:0;color:#78716c;font-size:12px">${esc(s.city)}${s.approximate ? ' · ubicación aproximada' : ''}</p>
                        ${s.notes ? `<p style="margin:6px 0 0;font-size:12px">${esc(s.notes)}</p>` : ''}
                        ${urlHttp(s.url) ? `<a href="${esc(urlHttp(s.url))}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#466641">Ver perfil →</a>` : ''}
                    </div>`);
                capaComunidad.addLayer(m);
                marcadoresComunidad[s.id] = m;
                puntos.push([s.lat, s.lng]);
            });

            cont.querySelectorAll('[data-comunidad]').forEach(card =>
                card.addEventListener('click', (e) => {
                    if (e.target.closest('a')) return;
                    const m = marcadoresComunidad[card.dataset.comunidad];
                    if (!m) return;
                    mapa.flyTo(m.getLatLng(), 14, { duration: 0.8 });
                    m.openPopup();
                    $('ref-mapa').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }));
            return puntos;
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600">${esc(err.message)}</p>`;
            return [];
        }
    }

    // ===== Sumá un refugio =====
    const modal = $('ref-sug-modal');
    let mapaSug = null;
    let marcaSug = null;
    let sugLat = null;
    let sugLng = null;

    const TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';

    function fijarSug(lat, lng) {
        sugLat = lat;
        sugLng = lng;
        if (marcaSug) marcaSug.setLatLng([lat, lng]);
        else marcaSug = L.marker([lat, lng]).addTo(mapaSug);
        $('ref-sug-estado').textContent = `Punto marcado (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
        $('ref-sug-estado').className = 'text-xs text-stone-600';
    }

    function limpiarSug() {
        $('ref-sug-form').reset();
        if (marcaSug) { mapaSug.removeLayer(marcaSug); marcaSug = null; }
        sugLat = sugLng = null;
        $('ref-sug-estado').textContent = 'Todavía no marcaste el punto en el mapa.';
        $('ref-sug-estado').className = 'text-xs text-amber-700';
    }

    function abrirSugerir() {
        if (!window.PataMatch.user) {
            aviso('Iniciá sesión para sumar un refugio', 'info');
            window.location.hash = 'login';
            return;
        }
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        if (!mapaSug) {
            // El mapa del modal arranca donde está mirando el mapa principal.
            const zoom = mapa.getZoom() >= ZOOM_MIN_BUSQUEDA ? mapa.getZoom() : 5;
            mapaSug = L.map('ref-sug-mapa').setView(mapa.getCenter(), zoom);
            L.tileLayer(TILES, { attribution: 'Tiles &copy; Esri', maxZoom: 18 }).addTo(mapaSug);
            mapaSug.on('click', (e) => fijarSug(e.latlng.lat, e.latlng.lng));
        }
        // El mapa se creó con el modal oculto: hay que recalcular su tamaño.
        setTimeout(() => { mapaSug.invalidateSize(); $('ref-sug-nombre').focus(); }, 60);
    }

    function cerrarSugerir() {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    document.querySelectorAll('[data-sugerir]').forEach(b => b.addEventListener('click', abrirSugerir));
    $('ref-sug-cerrar').addEventListener('click', cerrarSugerir);
    $('ref-sug-overlay').addEventListener('click', cerrarSugerir);
    modal.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarSugerir(); });

    $('ref-sug-ubicar').addEventListener('click', async () => {
        const q = $('ref-sug-localidad').value.trim();
        if (!q) { aviso('Escribí primero la localidad', 'info'); return; }
        try {
            const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
                headers: { 'Accept-Language': 'es' }
            });
            const [lugar] = await resp.json();
            if (!lugar) { aviso('No encontramos esa localidad: marcá el punto a mano en el mapa', 'error'); return; }
            mapaSug.flyTo([Number(lugar.lat), Number(lugar.lon)], 14, { duration: 0.8 });
        } catch (err) {
            aviso('No se pudo buscar la localidad', 'error');
        }
    });

    $('ref-sug-gps').addEventListener('click', () => {
        if (!navigator.geolocation) { aviso('Tu navegador no soporta geolocalización', 'error'); return; }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                fijarSug(pos.coords.latitude, pos.coords.longitude);
                mapaSug.flyTo([pos.coords.latitude, pos.coords.longitude], 15, { duration: 0.8 });
            },
            () => aviso('No se pudo obtener tu ubicación', 'error')
        );
    });

    $('ref-sug-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (sugLat == null) { aviso('Marcá el punto del refugio en el mapa', 'error'); return; }

        const btn = $('ref-sug-enviar');
        btn.disabled = true;
        btn.textContent = 'Enviando...';
        try {
            const { data } = await sugerirRefugio({
                name: $('ref-sug-nombre').value,
                city: $('ref-sug-localidad').value,
                address: $('ref-sug-referencia').value,
                url: $('ref-sug-link').value,
                notes: $('ref-sug-notas').value,
                lat: sugLat,
                lng: sugLng,
                approximate: $('ref-sug-aprox').checked
            });
            // Un admin publica directo; el resto queda esperando revisión.
            aviso(data.status === 'aprobado' ? 'Refugio publicado en el mapa' : '¡Gracias! Lo revisamos antes de publicarlo', 'success');
            limpiarSug();
            cerrarSugerir();
            if (data.status === 'aprobado') cargarComunidad();
        } catch (err) {
            aviso(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Enviar para revisión';
        }
    });

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
            mapa.once('moveend', () => buscarEnZona());
        } catch (err) {
            aviso('No se pudo buscar el lugar', 'error');
        }
    });

    const BTN_BUSCAR = '<span class="material-symbols-outlined text-[18px]">travel_explore</span>Buscar refugios en esta zona';
    let busquedaActual = 0;

    // Busca los refugios del área visible del mapa. `silenciosa` es la búsqueda
    // automática al abrir la página: no muestra avisos emergentes.
    async function buscarEnZona({ silenciosa = false } = {}) {
        const btn = $('ref-buscar-zona');
        const sub = $('ref-externos-sub');
        const cont = $('ref-externos');

        if (mapa.getZoom() < ZOOM_MIN_BUSQUEDA) {
            sub.textContent = 'Acercá el mapa a una ciudad (o buscala arriba) para ver los refugios de esa zona.';
            if (!silenciosa) aviso('Acercá el mapa para buscar refugios en la zona', 'info');
            return;
        }

        const id = ++busquedaActual;
        const b = mapa.getBounds();
        btn.disabled = true;
        btn.innerHTML = '<span class="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>Buscando...';
        sub.textContent = 'Buscando refugios en la zona del mapa...';
        try {
            const { data } = await buscarRefugiosCercanos({
                s: b.getSouth().toFixed(4), w: b.getWest().toFixed(4),
                n: b.getNorth().toFixed(4), e: b.getEast().toFixed(4)
            });
            if (id !== busquedaActual) return; // llegó una búsqueda más nueva

            $('ref-proveedor').textContent = data.proveedor === 'google'
                ? 'Refugios de la zona provistos por Google Places.'
                : data.degradado
                    ? 'Google Places no respondió: se muestran los refugios cargados en OpenStreetMap, que pueden ser pocos.'
                    : 'Refugios de la zona de OpenStreetMap, una base colaborativa: puede que no estén todos los de tu zona.';
            sub.textContent = data.lugares.length
                ? `${data.lugares.length} refugio(s) en esta zona. No están registrados en PataMatch.`
                : 'No encontramos refugios en esta zona. Probá moviendo el mapa o buscando otra ciudad.';

            capaExternos.clearLayers();
            cont.innerHTML = data.lugares.map(l => `
                <div class="bg-white rounded-xl border border-stone-100 p-3 cursor-pointer hover:border-stone-300 transition-colors" data-externo="${esc(l.id)}">
                    <p class="font-semibold text-stone-800 text-sm">${esc(l.name)}</p>
                    <p class="text-xs text-stone-500">${esc(l.address) || 'Dirección no disponible'}</p>
                    <div class="flex flex-wrap items-center gap-3 mt-1.5 text-[11px] text-stone-500">
                        ${l.rating != null ? `<span class="inline-flex items-center gap-0.5"><span class="material-symbols-outlined text-[13px] text-amber-500" style="font-variation-settings:'FILL' 1">star</span>${l.rating} (${l.reviews || 0})</span>` : ''}
                        ${l.phone ? `<a href="tel:${esc(l.phone)}" class="inline-flex items-center gap-0.5 hover:text-[#D96C4A]"><span class="material-symbols-outlined text-[13px]">call</span>${esc(l.phone)}</a>` : ''}
                        ${urlHttp(l.url) ? `<a href="${esc(urlHttp(l.url))}" target="_blank" rel="noopener" class="inline-flex items-center gap-0.5 hover:text-[#D96C4A]"><span class="material-symbols-outlined text-[13px]">open_in_new</span>Ver ficha</a>` : ''}
                    </div>
                </div>`).join('');

            const externos = {};
            data.lugares.forEach(l => {
                const m = L.marker([l.lat, l.lng], { icon: pinExterno }).bindPopup(`
                    <div style="font-family:'Plus Jakarta Sans',sans-serif;min-width:160px">
                        <p style="font-weight:700;margin:0 0 2px">${esc(l.name)}</p>
                        <p style="margin:0;color:#78716c;font-size:12px">${esc(l.address)}</p>
                        ${urlHttp(l.url) ? `<a href="${esc(urlHttp(l.url))}" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:12px;font-weight:700;color:#D96C4A">Ver ficha →</a>` : ''}
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
            if (id !== busquedaActual) return;
            sub.textContent = 'No se pudieron cargar los refugios de la zona.';
            if (!silenciosa) aviso(err.message, 'error');
        } finally {
            if (id === busquedaActual) {
                btn.disabled = false;
                btn.innerHTML = BTN_BUSCAR;
            }
        }
    }

    $('ref-buscar-zona').addEventListener('click', () => buscarEnZona());

    // Al abrir: primero los refugios registrados y los de la comunidad (el mapa se
    // encuadra con todos si el usuario no fijó su zona) y después los de la zona,
    // sin esperar a que el usuario toque el botón.
    Promise.all([cargarRefugios(), cargarComunidad()]).then(([propios, comunidad]) => {
        const puntos = [...propios, ...comunidad];
        if (yo?.lat == null && puntos.length) {
            mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 12, animate: false });
        }
        return buscarEnZona({ silenciosa: true });
    });
}
