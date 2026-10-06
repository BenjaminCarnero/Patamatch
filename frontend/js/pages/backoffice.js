import { getResumen, getMisMascotas, getSolicitudes, resolverSolicitud, editarMascota, eliminarMascota,
         getDonacionesRecibidas, cambiarEstadoDonacion, getCarnetMascota, guardarCarnetMascota,
         getEstadisticas, cambiarEstadoTransito, getSugerenciasRefugios, resolverSugerenciaRefugio } from '../api.js';
import { ESTADOS_SALUD, buildChipEstado, buildCarnetForm, activarCarnetForm, leerCarnetForm, esc } from '../carnet-mascota.js?v=1';
import { columnasPorMes, barrasHorizontales, barraApilada, medidor, tarjeta, activarTooltips } from '../graficos.js?v=1';

// Colores de los gráficos. Validados con el chequeo de daltonismo del método
// de visualización: los estados de salud van en este orden fijo (verde,
// celeste, ámbar, rosa) porque así todos los pares vecinos se distinguen.
const COLOR = {
    marca: '#D96C4A',
    azul: '#2a78d6',
    verde: '#16a34a',
    salud: { disponible: '#16a34a', en_reposo: '#0284c7', con_cuidado: '#d97706', cirugia_programada: '#e11d48' },
    solicitud: { pendiente: '#d97706', aprobada: '#16a34a', rechazada: '#a8a29e' }
};

// Panel de gestión. Lo ve cualquier usuario logueado: en PataMatch cualquiera
// puede dar una mascota en adopción, así que cualquiera necesita gestionar sus
// publicaciones. El rol solo cambia el alcance (un admin ve todo el sistema).

export function render() {
    const user = window.PataMatch.user;

    if (!user) {
        return `
        <div class="max-w-2xl mx-auto px-6 py-20 text-center">
            <span class="material-symbols-outlined text-6xl text-[#D96C4A] mb-4">dashboard</span>
            <h1 class="font-headline-lg text-stone-800 mb-3">Panel de gestión</h1>
            <p class="text-stone-600 mb-8">Iniciá sesión para administrar tus publicaciones y solicitudes.</p>
            <a href="#login" class="bg-[#D96C4A] text-white px-8 py-3 rounded-xl font-bold inline-block">Iniciar Sesión</a>
        </div>`;
    }

    return `
    <div class="max-w-6xl mx-auto px-6 py-12">
        <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="font-headline-lg text-stone-800 mb-2">Panel de gestión</h1>
                <p class="text-stone-600" id="bo-alcance">Cargando...</p>
            </div>
            <div class="flex gap-2">
                <a href="#adoptar" class="inline-flex items-center gap-1.5 bg-[#D96C4A] text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm">
                    <span class="material-symbols-outlined text-[18px]">add_circle</span>Publicar mascota
                </a>
                <a href="#voluntariado" class="inline-flex items-center gap-1.5 bg-white border border-stone-200 text-stone-700 text-sm font-semibold px-4 py-2.5 rounded-xl">
                    <span class="material-symbols-outlined text-[18px]">home</span>Hogares de tránsito
                </a>
            </div>
        </div>

        <div id="bo-resumen" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"></div>

        <div id="bo-graficos" class="grid md:grid-cols-2 gap-4 mb-10">
            <p class="text-sm text-stone-400 md:col-span-2">Cargando gráficos...</p>
        </div>

        <!-- Solo para admins: revisión de los refugios que sugiere la comunidad -->
        <div class="hidden mb-10" id="bo-sugerencias-bloque">
            <h2 class="font-bold text-xl text-stone-800 mb-1">Refugios sugeridos por la comunidad
                <span id="bo-sugerencias-pendientes" class="hidden ml-2 align-middle text-[11px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700"></span>
            </h2>
            <p class="text-sm text-stone-500 mb-4">Revisá el perfil de cada refugio antes de aprobarlo: recién ahí aparece en el mapa público.</p>
            <div id="bo-sugerencias" class="space-y-3"></div>
        </div>

        <div class="mb-10" id="bo-transitos-bloque">
            <h2 class="font-bold text-xl text-stone-800 mb-1">Tránsitos activos</h2>
            <p class="text-sm text-stone-500 mb-4">Mascotas tuyas alojadas hoy en un hogar de tránsito.</p>
            <div id="bo-transitos" class="space-y-3"></div>
        </div>

        <div class="mb-10">
            <h2 class="font-bold text-xl text-stone-800 mb-1">Solicitudes de adopción</h2>
            <p class="text-sm text-stone-500 mb-4">Aprobar una solicitud marca la mascota como adoptada y rechaza el resto de los pedidos por ese animal.</p>
            <div id="bo-solicitudes" class="space-y-3"></div>
        </div>

        <div class="mb-10">
            <h2 class="font-bold text-xl text-stone-800 mb-1">Mis publicaciones</h2>
            <div id="bo-mascotas" class="space-y-3 mt-4"></div>
        </div>

        <div id="bo-donaciones-bloque">
            <h2 class="font-bold text-xl text-stone-800 mb-1">Donaciones recibidas</h2>
            <p class="text-sm text-stone-500 mb-4">Los totales cuentan solo lo confirmado: una promesa todavía no es un aporte.</p>
            <div id="bo-donaciones" class="space-y-3"></div>
        </div>
    </div>`;
}

export function init() {
    if (!window.PataMatch.user) return;

    const $ = (id) => document.getElementById(id);
    const aviso = (msg, tipo) => window.PataMatch.toast(msg, tipo);

    async function cargarResumen() {
        try {
            const { data } = await getResumen();
            $('bo-alcance').textContent = data.alcance === 'todo el sistema'
                ? 'Estás viendo todo el sistema como administrador.'
                : 'Administrá tus publicaciones y las solicitudes que recibís.';

            const tarjetas = [
                { n: data.publicadas, label: 'En adopción', color: 'text-stone-800' },
                { n: data.solicitudes_pendientes, label: 'Solicitudes pendientes', color: data.solicitudes_pendientes ? 'text-[#D96C4A]' : 'text-stone-800' },
                { n: data.adoptadas, label: 'Adopciones concretadas', color: 'text-green-600' },
                { n: data.en_transito, label: 'En hogar de tránsito', color: 'text-stone-800' }
            ];

            $('bo-resumen').innerHTML = tarjetas.map(t => `
                <div class="bg-white rounded-2xl border border-stone-100 p-4">
                    <p class="text-3xl font-black ${t.color}">${t.n}</p>
                    <p class="text-[11px] text-stone-500 uppercase tracking-wide mt-1">${t.label}</p>
                </div>`).join('');
        } catch (err) {
            $('bo-alcance').textContent = 'No se pudo cargar el resumen.';
        }
    }

    async function cargarGraficos() {
        const cont = $('bo-graficos');
        try {
            const { data } = await getEstadisticas();
            const hayDonaciones = Array.isArray(data.donaciones);

            const actividad = columnasPorMes(data.meses, [
                { key: 'publicaciones', label: 'Publicaciones', color: COLOR.marca },
                { key: 'solicitudes', label: 'Solicitudes de adopción', color: COLOR.azul }
            ]);

            const salud = barraApilada(
                ['disponible', 'en_reposo', 'con_cuidado', 'cirugia_programada'].map(k => ({
                    label: ESTADOS_SALUD[k].label, icon: ESTADOS_SALUD[k].icon, n: data.salud[k] || 0, color: COLOR.salud[k]
                })),
                { vacio: 'No tenés mascotas en adopción.' }
            );

            const solicitudes = barraApilada(
                [['pendiente', 'Pendientes'], ['aprobada', 'Aprobadas'], ['rechazada', 'Rechazadas']].map(([k, label]) => ({
                    label, n: data.solicitudes[k] || 0, color: COLOR.solicitud[k]
                })),
                { vacio: 'Todavía no recibiste solicitudes.' }
            );

            const especies = barrasHorizontales(
                data.especies.map(e => ({ label: e.especie, n: e.n })), COLOR.marca,
                { vacio: 'Todavía no publicaste mascotas.' }
            );

            const carnets = medidor(data.carnets.con_carnet, data.carnets.total, COLOR.verde, { label: 'mascotas en adopción con carnet cargado' })
                + (data.carnets.total > data.carnets.con_carnet
                    ? `<p class="text-[11px] text-stone-500 mt-2">Faltan ${data.carnets.total - data.carnets.con_carnet}: un carnet completo genera más confianza en quien adopta.</p>`
                    : '<p class="text-[11px] text-green-700 mt-2">Todas tus mascotas tienen su carnet. ¡Excelente!</p>');

            cont.innerHTML =
                tarjeta('Actividad de los últimos 6 meses', 'Publicaciones nuevas y solicitudes recibidas por mes', actividad, { icono: 'insights' }) +
                tarjeta('Estado de salud del catálogo', 'Cómo están hoy las mascotas que tenés en adopción', salud, { icono: 'health_and_safety' }) +
                tarjeta('Solicitudes de adopción', 'Todas las solicitudes recibidas, por resultado', solicitudes, { icono: 'inbox' }) +
                tarjeta('Mascotas por especie', 'Incluye adoptadas y en adopción', especies, { icono: 'pets' }) +
                tarjeta('Carnets digitales', 'Cobertura del carnet en el catálogo', carnets, { icono: 'id_card' }) +
                (hayDonaciones
                    ? tarjeta('Donaciones recibidas', 'Dinero confirmado por mes (solo lo efectivamente recibido)',
                        columnasPorMes(data.donaciones, [{ key: 'dinero', label: 'Dinero', color: COLOR.verde }],
                            { formato: (v) => '$' + Number(v).toLocaleString('es-AR'), vacio: 'Todavía no confirmaste donaciones en dinero en este período.' }),
                        { icono: 'volunteer_activism' })
                    : '');

            activarTooltips(cont);
            renderTransitos(data.transitos);
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600 md:col-span-2">${esc(err.message)}</p>`;
        }
    }

    function renderTransitos(transitos) {
        const bloque = $('bo-transitos-bloque');
        const cont = $('bo-transitos');
        if (!transitos.length) {
            bloque.classList.add('hidden');
            return;
        }
        bloque.classList.remove('hidden');
        const fecha = (d) => d ? new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }) : '—';
        cont.innerHTML = transitos.map(t => `
            <div class="bg-white rounded-xl border border-stone-100 p-4 flex flex-wrap items-center gap-4">
                <img src="${esc(t.image_url) || ''}" alt="${esc(t.pet_name)}" class="w-12 h-12 rounded-lg object-cover bg-stone-100 shrink-0"/>
                <div class="flex-1 min-w-[180px]">
                    <p class="font-semibold text-stone-800 text-sm">${esc(t.pet_name)} <span class="text-stone-400 font-normal">en casa de</span> ${esc(t.volunteer_name)}</p>
                    <p class="text-xs text-stone-500">${esc(t.volunteer_city || 'Sin zona')} · desde el ${fecha(t.start_date)}${t.end_date ? ' · hasta el ' + fecha(t.end_date) : ''}${t.phone ? ' · ' + esc(t.phone) : ''}</p>
                </div>
                <button data-finalizar="${t.id}" class="bg-white border border-stone-200 text-stone-600 text-xs font-semibold px-3 py-2 rounded-lg">Finalizar tránsito</button>
            </div>`).join('');

        cont.querySelectorAll('[data-finalizar]').forEach(b =>
            b.addEventListener('click', async () => {
                if (!confirm('¿La mascota ya volvió del hogar de tránsito?')) return;
                b.disabled = true;
                try {
                    await cambiarEstadoTransito(b.dataset.finalizar, 'finalizada');
                    aviso('Tránsito finalizado', 'success');
                    refrescar();
                } catch (err) {
                    aviso(err.message, 'error');
                    b.disabled = false;
                }
            }));
    }

    async function cargarSolicitudes() {
        const cont = $('bo-solicitudes');
        try {
            const { data } = await getSolicitudes();
            if (!data.length) {
                cont.innerHTML = '<p class="text-sm text-stone-500">Todavía no recibiste solicitudes de adopción.</p>';
                return;
            }

            const etiqueta = {
                pendiente: 'bg-orange-100 text-orange-700',
                aprobada: 'bg-green-100 text-green-700',
                rechazada: 'bg-stone-100 text-stone-500'
            };

            cont.innerHTML = data.map(s => `
                <div class="bg-white rounded-xl border border-stone-100 p-4 flex flex-wrap items-center gap-4">
                    <img src="${s.image_url || ''}" alt="${s.pet_name}" class="w-12 h-12 rounded-lg object-cover bg-stone-100 shrink-0"/>
                    <div class="flex-1 min-w-[160px]">
                        <p class="font-semibold text-stone-800 text-sm">${s.adopter_name} quiere adoptar a ${s.pet_name}</p>
                        <p class="text-xs text-stone-500">${s.adopter_city || 'Sin zona'} · ${s.mensajes} mensaje(s) en el chat</p>
                    </div>
                    <span class="text-[11px] font-bold px-2 py-1 rounded-full ${etiqueta[s.status]} shrink-0">${s.status.toUpperCase()}</span>
                    ${s.status === 'pendiente' ? `
                        <div class="flex gap-2 shrink-0">
                            <button data-aprobar="${s.id}" class="bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg">Aprobar</button>
                            <button data-rechazar="${s.id}" class="bg-white border border-stone-200 text-stone-600 text-xs font-semibold px-3 py-2 rounded-lg">Rechazar</button>
                        </div>` : `
                        <a href="#chats" class="text-xs font-semibold text-[#D96C4A] hover:underline shrink-0">Ver chat</a>`}
                </div>`).join('');

            cont.querySelectorAll('[data-aprobar]').forEach(b =>
                b.addEventListener('click', () => resolver(b.dataset.aprobar, 'aprobada', b)));
            cont.querySelectorAll('[data-rechazar]').forEach(b =>
                b.addEventListener('click', () => resolver(b.dataset.rechazar, 'rechazada', b)));
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
        }
    }

    async function resolver(id, status, btn) {
        if (status === 'aprobada' && !confirm('Al aprobar, la mascota sale del catálogo y se rechazan las demás solicitudes por ella. ¿Confirmás?')) return;
        btn.disabled = true;
        try {
            await resolverSolicitud(id, status);
            aviso(status === 'aprobada' ? 'Adopción aprobada' : 'Solicitud rechazada', 'success');
            refrescar();
        } catch (err) {
            aviso(err.message, 'error');
            btn.disabled = false;
        }
    }

    async function cargarMascotas() {
        const cont = $('bo-mascotas');
        try {
            const { data } = await getMisMascotas();
            if (!data.length) {
                cont.innerHTML = `<p class="text-sm text-stone-500">
                    Todavía no publicaste ninguna mascota.
                    <a href="#adoptar" class="text-[#D96C4A] font-semibold underline">Publicá la primera</a>.
                </p>`;
                return;
            }

            cont.innerHTML = data.map(p => `
                <div class="bg-white rounded-xl border border-stone-100 p-4">
                    <div class="flex flex-wrap items-center gap-4">
                        <img src="${p.image_url || ''}" alt="${p.name}" class="w-12 h-12 rounded-lg object-cover bg-stone-100 shrink-0"/>
                        <div class="flex-1 min-w-[160px]">
                            <p class="font-semibold text-stone-800 text-sm">
                                ${p.name}
                                ${p.is_adopted ? '<span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">ADOPTADA</span>' : ''}
                                ${Number(p.en_transito) ? '<span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">EN TRÁNSITO</span>' : ''}
                            </p>
                            <p class="text-xs text-stone-500">${p.species} · ${p.breed || 's/raza'} · ${p.size || 's/tamaño'} · ${p.location || 'sin zona'}</p>
                            <div class="mt-1.5 flex flex-wrap items-center gap-2">
                                ${p.is_adopted ? '' : buildChipEstado(p)}
                                ${p.has_carnet
                                    ? '<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-500"><span class="material-symbols-outlined text-[14px]">id_card</span>Carnet cargado</span>'
                                    : '<span class="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600"><span class="material-symbols-outlined text-[14px]">warning</span>Sin carnet</span>'}
                            </div>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button data-editar="${p.id}" class="bg-white border border-stone-200 text-stone-600 text-xs font-semibold px-3 py-2 rounded-lg">Editar</button>
                            <button data-carnet="${p.id}" class="bg-white border border-stone-200 text-stone-600 text-xs font-semibold px-3 py-2 rounded-lg inline-flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px]">id_card</span>${p.has_carnet ? 'Carnet' : 'Cargar carnet'}
                            </button>
                            <button data-eliminar="${p.id}" class="bg-white border border-red-200 text-red-600 text-xs font-semibold px-3 py-2 rounded-lg">Eliminar</button>
                        </div>
                    </div>

                    <form data-form="${p.id}" class="hidden mt-3 pt-3 border-t border-stone-100 grid sm:grid-cols-2 gap-3">
                        <input name="name" value="${p.name}" placeholder="Nombre" required
                            class="px-3 py-2 rounded-lg border border-stone-200 text-sm"/>
                        <input name="breed" value="${p.breed || ''}" placeholder="Raza"
                            class="px-3 py-2 rounded-lg border border-stone-200 text-sm"/>
                        <input name="age" value="${p.age || ''}" placeholder="Edad (ej. 2 Años)"
                            class="px-3 py-2 rounded-lg border border-stone-200 text-sm"/>
                        <input name="location" value="${p.location || ''}" placeholder="Zona"
                            class="px-3 py-2 rounded-lg border border-stone-200 text-sm"/>
                        <select name="species" class="px-3 py-2 rounded-lg border border-stone-200 text-sm">
                            ${['Perro', 'Gato'].map(e => `<option ${p.species === e ? 'selected' : ''}>${e}</option>`).join('')}
                        </select>
                        <select name="size" class="px-3 py-2 rounded-lg border border-stone-200 text-sm">
                            <option value="">Sin especificar</option>
                            ${['Pequeño', 'Mediano', 'Grande'].map(t => `<option ${p.size === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        <textarea name="description" rows="2" placeholder="Descripción"
                            class="sm:col-span-2 px-3 py-2 rounded-lg border border-stone-200 text-sm">${p.description || ''}</textarea>
                        <select name="health_status" class="px-3 py-2 rounded-lg border border-stone-200 text-sm">
                            ${Object.entries(ESTADOS_SALUD).map(([v, e]) => `<option value="${v}" ${p.health_status === v ? 'selected' : ''}>${e.label}</option>`).join('')}
                        </select>
                        <input name="health_note" value="${esc(p.health_note)}" placeholder="Nota del estado (ej. reposo hasta el 2/10)"
                            class="px-3 py-2 rounded-lg border border-stone-200 text-sm"/>
                        <div class="sm:col-span-2 flex justify-end">
                            <button type="submit" class="bg-[#D96C4A] text-white text-xs font-semibold px-5 py-2 rounded-lg">Guardar cambios</button>
                        </div>
                    </form>

                    <form data-carnet-form="${p.id}" class="hidden mt-3 pt-3 border-t border-stone-100">
                        <p class="text-sm text-stone-400">Cargando carnet...</p>
                    </form>
                </div>`).join('');

            // El formulario del carnet se arma recién al abrirlo: trae los datos
            // médicos por mascota y no vale la pena pedirlos para toda la lista.
            cont.querySelectorAll('[data-carnet]').forEach(b =>
                b.addEventListener('click', () => abrirCarnetForm(cont, b.dataset.carnet)));

            cont.querySelectorAll('[data-editar]').forEach(b =>
                b.addEventListener('click', () =>
                    cont.querySelector(`[data-form="${b.dataset.editar}"]`).classList.toggle('hidden')));

            cont.querySelectorAll('[data-eliminar]').forEach(b =>
                b.addEventListener('click', () => borrar(b.dataset.eliminar, b)));

            cont.querySelectorAll('[data-form]').forEach(f =>
                f.addEventListener('submit', (e) => guardar(e, f.dataset.form)));
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
        }
    }

    async function guardar(e, id) {
        e.preventDefault();
        const datos = Object.fromEntries(new FormData(e.target).entries());
        try {
            await editarMascota(id, datos);
            aviso('Publicación actualizada', 'success');
            refrescar();
        } catch (err) {
            aviso(err.message, 'error');
        }
    }

    async function abrirCarnetForm(cont, id) {
        const form = cont.querySelector(`[data-carnet-form="${id}"]`);
        if (!form.classList.contains('hidden')) {
            form.classList.add('hidden');
            return;
        }
        form.classList.remove('hidden');
        if (form.dataset.listo) return;

        try {
            const { data } = await getCarnetMascota(id);
            form.innerHTML = buildCarnetForm(data.carnet) + `
                <div class="mt-3 flex justify-end">
                    <button type="submit" class="bg-[#D96C4A] text-white text-xs font-semibold px-5 py-2 rounded-lg inline-flex items-center gap-1">
                        <span class="material-symbols-outlined text-[16px]">save</span>Guardar carnet
                    </button>
                </div>`;
            activarCarnetForm(form);
            form.addEventListener('submit', (e) => guardarCarnet(e, id));
            form.dataset.listo = '1';
        } catch (err) {
            form.innerHTML = `<p class="text-sm text-red-600">${esc(err.message)}</p>`;
        }
    }

    async function guardarCarnet(e, id) {
        e.preventDefault();
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;
        try {
            await guardarCarnetMascota(id, leerCarnetForm(e.target));
            aviso('Carnet guardado', 'success');
            refrescar();
        } catch (err) {
            aviso(err.message, 'error');
            btn.disabled = false;
        }
    }

    async function borrar(id, btn) {
        if (!confirm('¿Seguro que querés eliminar esta publicación? No se puede deshacer.')) return;
        btn.disabled = true;
        try {
            await eliminarMascota(id);
            aviso('Publicación eliminada', 'success');
            refrescar();
        } catch (err) {
            // El backend rechaza si la mascota está en un hogar de tránsito.
            aviso(err.message, 'error');
            btn.disabled = false;
        }
    }

    async function cargarDonaciones() {
        const cont = $('bo-donaciones');
        try {
            const { data } = await getDonacionesRecibidas();

            if (!data.donaciones.length) {
                // Un usuario común sin refugio no recibe donaciones: en ese caso
                // el bloque entero sobra y se oculta.
                $('bo-donaciones-bloque').classList.add('hidden');
                return;
            }
            $('bo-donaciones-bloque').classList.remove('hidden');

            const r = data.resumen;
            const etiqueta = {
                comprometida: 'bg-orange-100 text-orange-700',
                recibida: 'bg-green-100 text-green-700',
                cancelada: 'bg-stone-100 text-stone-500'
            };

            cont.innerHTML = `
                <div class="bg-white rounded-xl border border-stone-100 p-4 mb-4 flex flex-wrap gap-6">
                    <div>
                        <p class="text-2xl font-black text-green-600">$${r.total_dinero_recibido.toLocaleString('es-AR')}</p>
                        <p class="text-[11px] text-stone-500 uppercase tracking-wide">Dinero recibido</p>
                    </div>
                    <div>
                        <p class="text-2xl font-black text-stone-800">${r.donaciones_en_especie_recibidas}</p>
                        <p class="text-[11px] text-stone-500 uppercase tracking-wide">Aportes en especie</p>
                    </div>
                    <div>
                        <p class="text-2xl font-black ${r.comprometidas_pendientes ? 'text-[#D96C4A]' : 'text-stone-800'}">${r.comprometidas_pendientes}</p>
                        <p class="text-[11px] text-stone-500 uppercase tracking-wide">Prometidas sin recibir</p>
                    </div>
                </div>
            ` + data.donaciones.map(d => `
                <div class="bg-white rounded-xl border border-stone-100 p-4 flex flex-wrap items-center gap-4">
                    <div class="flex-1 min-w-[160px]">
                        <p class="font-semibold text-stone-800 text-sm">
                            ${d.tipo === 'dinero' ? `$${Number(d.monto).toLocaleString('es-AR')}` : d.descripcion}
                        </p>
                        <p class="text-xs text-stone-500">
                            De ${d.donor_name}${d.notas ? ' · ' + d.notas : ''}
                        </p>
                    </div>
                    <span class="text-[11px] font-bold px-2 py-1 rounded-full ${etiqueta[d.estado]} shrink-0">${d.estado.toUpperCase()}</span>
                    ${d.estado === 'comprometida' ? `
                        <button data-recibida="${d.id}" class="bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg shrink-0">Confirmar recepción</button>
                    ` : ''}
                </div>`).join('');

            cont.querySelectorAll('[data-recibida]').forEach(b =>
                b.addEventListener('click', async () => {
                    b.disabled = true;
                    try {
                        await cambiarEstadoDonacion(b.dataset.recibida, 'recibida');
                        aviso('Donación confirmada', 'success');
                        cargarDonaciones();
                    } catch (err) {
                        aviso(err.message, 'error');
                        b.disabled = false;
                    }
                }));
        } catch (err) {
            $('bo-donaciones-bloque').classList.add('hidden');
        }
    }

    // Revisión de refugios sugeridos (solo admin: el backend lo exige igual).
    async function cargarSugerencias() {
        if (window.PataMatch.user?.role !== 'admin') return;
        const bloque = $('bo-sugerencias-bloque');
        const cont = $('bo-sugerencias');
        try {
            const { data } = await getSugerenciasRefugios();
            bloque.classList.remove('hidden');

            const pendientes = data.filter(s => s.status === 'pendiente').length;
            const badge = $('bo-sugerencias-pendientes');
            badge.textContent = `${pendientes} pendiente${pendientes === 1 ? '' : 's'}`;
            badge.classList.toggle('hidden', !pendientes);

            if (!data.length) {
                cont.innerHTML = '<p class="text-sm text-stone-500">Todavía nadie sugirió un refugio.</p>';
                return;
            }

            const etiqueta = {
                pendiente: 'bg-orange-100 text-orange-700',
                aprobado: 'bg-green-100 text-green-700',
                rechazado: 'bg-stone-100 text-stone-500'
            };
            const fecha = (d) => new Date(d).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            const urlHttp = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

            cont.innerHTML = data.map(s => `
                <div class="bg-white rounded-xl border border-stone-100 p-4 flex flex-wrap items-start gap-4">
                    <div class="flex-1 min-w-[220px]">
                        <p class="font-semibold text-stone-800 text-sm">${esc(s.name)}
                            <span class="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${etiqueta[s.status]}">${s.status.toUpperCase()}</span>
                        </p>
                        <p class="text-xs text-stone-500">${esc(s.city)}${s.address ? ' · ' + esc(s.address) : ''} · sugerido por ${esc(s.user_name)} el ${fecha(s.created_at)}</p>
                        ${s.notes ? `<p class="text-xs text-stone-600 mt-1">${esc(s.notes)}</p>` : ''}
                        ${s.review_note ? `<p class="text-xs text-stone-500 italic mt-1">Motivo: ${esc(s.review_note)}</p>` : ''}
                        <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs font-semibold">
                            ${urlHttp(s.url) ? `<a href="${esc(urlHttp(s.url))}" target="_blank" rel="noopener noreferrer" class="text-[#D96C4A] hover:underline inline-flex items-center gap-1"><span class="material-symbols-outlined text-[14px]">open_in_new</span>Ver perfil</a>` : ''}
                            <a href="https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lng}#map=16/${s.lat}/${s.lng}" target="_blank" rel="noopener noreferrer" class="text-[#D96C4A] hover:underline inline-flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">location_on</span>Ver ubicación${s.approximate ? ' (aprox.)' : ''}
                            </a>
                        </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        ${s.status !== 'aprobado' ? `<button data-sug-aprobar="${s.id}" class="bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded-lg">${s.status === 'rechazado' ? 'Aprobar igual' : 'Aprobar'}</button>` : ''}
                        ${s.status !== 'rechazado' ? `<button data-sug-rechazar="${s.id}" class="bg-white border border-stone-200 text-stone-600 text-xs font-semibold px-3 py-2 rounded-lg">${s.status === 'aprobado' ? 'Retirar del mapa' : 'Rechazar'}</button>` : ''}
                    </div>
                </div>`).join('');

            cont.querySelectorAll('[data-sug-aprobar]').forEach(b =>
                b.addEventListener('click', () => resolverSugerencia(b.dataset.sugAprobar, 'aprobado', b)));
            cont.querySelectorAll('[data-sug-rechazar]').forEach(b =>
                b.addEventListener('click', () => resolverSugerencia(b.dataset.sugRechazar, 'rechazado', b)));
        } catch (err) {
            bloque.classList.add('hidden');
        }
    }

    async function resolverSugerencia(id, status, btn) {
        let nota = '';
        if (status === 'rechazado') {
            // prompt devuelve null si se cancela: en ese caso no se hace nada.
            nota = prompt('Motivo (opcional). Se lo mostramos a quien lo sugirió:');
            if (nota === null) return;
        }
        btn.disabled = true;
        try {
            await resolverSugerenciaRefugio(id, status, nota);
            aviso(status === 'aprobado' ? 'Refugio aprobado: ya está en el mapa' : 'Refugio fuera del mapa', 'success');
            cargarSugerencias();
        } catch (err) {
            aviso(err.message, 'error');
            btn.disabled = false;
        }
    }

    function refrescar() {
        cargarResumen();
        cargarGraficos();
        cargarSugerencias();
        cargarSolicitudes();
        cargarMascotas();
        cargarDonaciones();
    }

    refrescar();
}
