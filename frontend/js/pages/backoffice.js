import { getResumen, getMisMascotas, getSolicitudes, resolverSolicitud, editarMascota, eliminarMascota,
         getDonacionesRecibidas, cambiarEstadoDonacion } from '../api.js';

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
    <div class="max-w-5xl mx-auto px-6 py-12">
        <div class="mb-8">
            <h1 class="font-headline-lg text-stone-800 mb-2">Panel de gestión</h1>
            <p class="text-stone-600" id="bo-alcance">Cargando...</p>
        </div>

        <div id="bo-resumen" class="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10"></div>

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
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button data-editar="${p.id}" class="bg-white border border-stone-200 text-stone-600 text-xs font-semibold px-3 py-2 rounded-lg">Editar</button>
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
                        <div class="sm:col-span-2 flex justify-end">
                            <button type="submit" class="bg-[#D96C4A] text-white text-xs font-semibold px-5 py-2 rounded-lg">Guardar cambios</button>
                        </div>
                    </form>
                </div>`).join('');

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

    function refrescar() {
        cargarResumen();
        cargarSolicitudes();
        cargarMascotas();
        cargarDonaciones();
    }

    refrescar();
}
