import { getMiHogar, ofrecerHogar, bajaHogar, getHogares, asignarTransito, cambiarEstadoTransito, getPets } from '../api.js';

const TAMANOS = [
    { valor: 'pequeno', label: 'Pequeño' },
    { valor: 'mediano', label: 'Mediano' },
    { valor: 'grande', label: 'Grande' }
];

export function render() {
    const user = window.PataMatch.user;

    if (!user) {
        return `
        <div class="max-w-2xl mx-auto px-6 py-20 text-center">
            <span class="material-symbols-outlined text-6xl text-[#D96C4A] mb-4">home_health</span>
            <h1 class="font-headline-lg text-stone-800 mb-3">Hogares de Tránsito</h1>
            <p class="text-stone-600 mb-8">
                Un hogar de tránsito aloja temporalmente a un animal rescatado hasta que
                encuentra familia. Iniciá sesión para ofrecer el tuyo.
            </p>
            <a href="#login" class="bg-[#D96C4A] text-white px-8 py-3 rounded-xl font-bold inline-block">Iniciar Sesión</a>
        </div>`;
    }

    const esGestor = user.role === 'refugio' || user.role === 'admin';

    return `
    <div class="max-w-4xl mx-auto px-6 py-12">
        <div class="mb-8">
            <h1 class="font-headline-lg text-stone-800 mb-2">Hogares de Tránsito</h1>
            <p class="text-stone-600">
                No falta gente dispuesta a adoptar: falta dónde alojar al animal mientras espera.
                Un hogar de tránsito cubre justamente ese hueco.
            </p>
        </div>

        <div id="vol-contenido" class="space-y-6">
            <div class="text-center py-12 text-stone-400">Cargando...</div>
        </div>

        ${esGestor ? `
        <div class="mt-12 pt-8 border-t border-stone-200">
            <h2 class="font-bold text-xl text-stone-800 mb-1">Panel de gestión</h2>
            <p class="text-sm text-stone-500 mb-5">Buscá un hogar con cupo para un animal concreto.</p>

            <div class="flex flex-wrap gap-3 mb-5">
                <select id="filtro-especie" class="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm">
                    <option value="">Todas las especies</option>
                    <option value="perro">Perro</option>
                    <option value="gato">Gato</option>
                </select>
                <select id="filtro-tamano" class="px-4 py-2 rounded-xl border border-stone-200 bg-white text-sm">
                    <option value="">Todos los tamaños</option>
                    ${TAMANOS.map(t => `<option value="${t.valor}">${t.label}</option>`).join('')}
                </select>
                <button id="btn-filtrar" class="bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-semibold">Buscar</button>
            </div>

            <div id="lista-hogares" class="space-y-3"></div>
        </div>` : ''}
    </div>`;
}

export function init() {
    const user = window.PataMatch.user;
    if (!user) return;

    const contenido = document.getElementById('vol-contenido');
    const esGestor = user.role === 'refugio' || user.role === 'admin';

    // ===== Mi hogar de tránsito =====
    async function cargarMiHogar() {
        try {
            const res = await getMiHogar();
            contenido.innerHTML = res.data && res.data.is_active
                ? vistaFicha(res.data)
                : vistaFormulario();
            conectarEventos(Boolean(res.data && res.data.is_active));
        } catch (err) {
            contenido.innerHTML = `<p class="text-sm text-red-600">No se pudo cargar tu ficha: ${err.message}</p>`;
        }
    }

    function vistaFicha(f) {
        const activas = f.estadias.filter(e => e.status === 'activa');
        const cerradas = f.estadias.filter(e => e.status !== 'activa');

        return `
        <div class="bg-white rounded-2xl border border-stone-100 shadow-sm p-6">
            <div class="flex items-start justify-between gap-4 mb-5">
                <div>
                    <h2 class="font-bold text-lg text-stone-800">Tu hogar de tránsito está activo</h2>
                    <p class="text-sm text-stone-500">
                        Recibís ${f.accepts_species === 'ambos' ? 'perros y gatos' : f.accepts_species + 's'}
                        de tamaño ${f.accepts_sizes.join(', ')}${f.has_yard ? ' · con patio' : ''}
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-3xl font-black ${f.cupo_libre > 0 ? 'text-green-600' : 'text-stone-400'}">${f.cupo_libre}</p>
                    <p class="text-[11px] text-stone-500 uppercase tracking-wide">cupo libre de ${f.capacity}</p>
                </div>
            </div>

            ${activas.length ? `
                <p class="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Alojando ahora</p>
                <div class="space-y-2 mb-5">
                    ${activas.map(e => `
                        <div class="flex items-center gap-3 p-3 bg-orange-50/60 rounded-xl border border-orange-100">
                            <img src="${e.image_url}" alt="${e.pet_name}" class="w-12 h-12 rounded-lg object-cover bg-stone-100"/>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-stone-800 text-sm">${e.pet_name}</p>
                                <p class="text-xs text-stone-500">Desde ${String(e.start_date).slice(0, 10)}</p>
                            </div>
                            <button data-finalizar="${e.id}" class="text-xs font-semibold text-[#D96C4A] hover:underline shrink-0">
                                Finalizar tránsito
                            </button>
                        </div>`).join('')}
                </div>` : `
                <p class="text-sm text-stone-500 mb-5">
                    Todavía no estás alojando ningún animal. Cuando un refugio te asigne uno, te avisamos.
                </p>`}

            ${cerradas.length ? `
                <p class="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">Historial</p>
                <ul class="text-sm text-stone-600 space-y-1 mb-5">
                    ${cerradas.map(e => `<li>${e.pet_name} — ${e.status}</li>`).join('')}
                </ul>` : ''}

            <div class="pt-4 border-t border-stone-100 flex justify-between items-center gap-4">
                <p class="text-xs text-stone-400">
                    ${activas.length ? 'Para darte de baja, finalizá primero los tránsitos activos.' : ''}
                </p>
                <button id="btn-baja" class="text-sm text-stone-500 hover:text-red-600 font-semibold shrink-0"
                    ${activas.length ? 'disabled' : ''}>Darme de baja</button>
            </div>
        </div>`;
    }

    function vistaFormulario() {
        return `
        <form id="form-hogar" class="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5">
            <h2 class="font-bold text-lg text-stone-800">Ofrecé tu hogar</h2>

            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">
                    ¿Cuántos animales podés alojar a la vez?
                </label>
                <input type="number" id="capacity" min="1" max="10" value="1" required
                    class="w-32 px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"/>
            </div>

            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">¿Qué podés recibir?</label>
                <select id="accepts_species" class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none">
                    <option value="ambos">Perros y gatos</option>
                    <option value="perro">Solo perros</option>
                    <option value="gato">Solo gatos</option>
                </select>
            </div>

            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">Tamaños que podés recibir</label>
                <div class="flex gap-4">
                    ${TAMANOS.map(t => `
                        <label class="flex items-center gap-2 text-sm text-stone-700">
                            <input type="checkbox" name="size" value="${t.valor}" class="accent-[#D96C4A] w-4 h-4"/>
                            ${t.label}
                        </label>`).join('')}
                </div>
            </div>

            <div class="flex flex-wrap gap-5">
                <label class="flex items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" id="has_yard" class="accent-[#D96C4A] w-4 h-4"/> Tengo patio
                </label>
                <label class="flex items-center gap-2 text-sm text-stone-700">
                    <input type="checkbox" id="has_other_pets" class="accent-[#D96C4A] w-4 h-4"/> Tengo otras mascotas
                </label>
            </div>

            <div class="grid sm:grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-semibold text-stone-700 mb-2">Teléfono de contacto</label>
                    <input type="tel" id="phone" placeholder="351-555-0100"
                        class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"/>
                </div>
                <div>
                    <label class="block text-sm font-semibold text-stone-700 mb-2">Plazo máximo (semanas)</label>
                    <input type="number" id="max_weeks" min="1" placeholder="Sin límite"
                        class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"/>
                </div>
            </div>

            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">Algo que debamos saber</label>
                <textarea id="notes" rows="2" placeholder="Ej: patio cercado, no puedo con perros muy grandes"
                    class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"></textarea>
            </div>

            <button type="submit" id="btn-ofrecer"
                class="bg-[#D96C4A] text-white px-8 py-3 rounded-xl font-bold w-full sm:w-auto">
                Ofrecer mi hogar
            </button>
        </form>`;
    }

    function conectarEventos(tieneFicha) {
        if (tieneFicha) {
            document.getElementById('btn-baja')?.addEventListener('click', async (e) => {
                if (e.currentTarget.disabled) return;
                if (!confirm('¿Seguro que querés darte de baja como hogar de tránsito?')) return;
                try {
                    await bajaHogar();
                    window.PataMatch.toast('Te diste de baja', 'success');
                    await refrescarUsuario();
                    cargarMiHogar();
                } catch (err) {
                    window.PataMatch.toast(err.message, 'error');
                }
            });

            document.querySelectorAll('[data-finalizar]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try {
                        await cambiarEstadoTransito(btn.dataset.finalizar, 'finalizada');
                        window.PataMatch.toast('Tránsito finalizado', 'success');
                        cargarMiHogar();
                    } catch (err) {
                        window.PataMatch.toast(err.message, 'error');
                    }
                });
            });
            return;
        }

        document.getElementById('form-hogar')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-ofrecer');
            const sizes = [...document.querySelectorAll('input[name="size"]:checked')].map(i => i.value);

            if (sizes.length === 0) {
                window.PataMatch.toast('Elegí al menos un tamaño', 'error');
                return;
            }

            btn.disabled = true;
            btn.innerText = 'Guardando...';
            try {
                await ofrecerHogar({
                    capacity: Number(document.getElementById('capacity').value),
                    accepts_species: document.getElementById('accepts_species').value,
                    accepts_sizes: sizes,
                    has_yard: document.getElementById('has_yard').checked,
                    has_other_pets: document.getElementById('has_other_pets').checked,
                    phone: document.getElementById('phone').value,
                    max_weeks: document.getElementById('max_weeks').value || null,
                    notes: document.getElementById('notes').value
                });
                window.PataMatch.toast('¡Gracias! Tu hogar quedó registrado', 'success');
                await refrescarUsuario();
                cargarMiHogar();
            } catch (err) {
                window.PataMatch.toast(err.message, 'error');
                btn.disabled = false;
                btn.innerText = 'Ofrecer mi hogar';
            }
        });
    }

    // El alta cambia el rol del usuario: hay que refrescarlo para que la
    // interfaz muestre lo que corresponde sin obligar a volver a loguearse.
    async function refrescarUsuario() {
        try {
            const me = await (await import('../api.js')).getMe();
            if (me.success) {
                window.PataMatch.user = me.data;
                localStorage.setItem('patamatch_user', JSON.stringify(me.data));
            }
        } catch (e) { /* no es crítico */ }
    }

    // ===== Panel de gestión (refugio / admin) =====
    async function cargarHogares() {
        const lista = document.getElementById('lista-hogares');
        if (!lista) return;

        const species = document.getElementById('filtro-especie').value;
        const size = document.getElementById('filtro-tamano').value;

        lista.innerHTML = '<p class="text-sm text-stone-400">Buscando...</p>';
        try {
            const res = await getHogares({ species, size });
            if (!res.data.length) {
                lista.innerHTML = '<p class="text-sm text-stone-500">No hay hogares con cupo para ese animal.</p>';
                return;
            }

            // Solo los animales publicados por este refugio: no puede derivar a
            // tránsito una mascota de otro usuario. El admin ve todas.
            const pets = await getPets();
            const disponibles = pets.data.filter(p =>
                !p.is_adopted && (user.role === 'admin' || p.user_id === user.id)
            );

            lista.innerHTML = res.data.map(h => `
                <div class="bg-white rounded-xl border border-stone-100 p-4">
                    <div class="flex items-center gap-4">
                        <div class="flex-1 min-w-0">
                            <p class="font-semibold text-stone-800">${h.name}</p>
                            <p class="text-xs text-stone-500">
                                ${h.city || 'Sin zona'} ·
                                ${h.accepts_species === 'ambos' ? 'perros y gatos' : h.accepts_species + 's'} ·
                                ${h.accepts_sizes.join(', ')}${h.has_yard ? ' · patio' : ''}
                            </p>
                        </div>
                        <div class="text-center shrink-0">
                            <p class="text-xl font-black ${h.cupo_libre > 0 ? 'text-green-600' : 'text-stone-300'}">${h.cupo_libre}</p>
                            <p class="text-[10px] text-stone-400 uppercase">de ${h.capacity}</p>
                        </div>
                        <button data-toggle="${h.id}"
                            class="bg-stone-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shrink-0 ${h.cupo_libre <= 0 ? 'opacity-40 cursor-not-allowed' : ''}"
                            ${h.cupo_libre <= 0 ? 'disabled' : ''}>Asignar animal</button>
                    </div>

                    <div data-panel="${h.id}" class="hidden mt-3 pt-3 border-t border-stone-100 flex flex-wrap gap-2 items-center">
                        ${disponibles.length ? `
                            <select data-select="${h.id}" class="flex-1 min-w-[180px] px-3 py-2 rounded-lg border border-stone-200 text-sm">
                                ${disponibles.map(p => `<option value="${p.id}">${p.name} — ${p.species}${p.size ? ', ' + p.size : ''}</option>`).join('')}
                            </select>
                            <button data-confirmar="${h.id}" class="bg-[#D96C4A] text-white text-xs font-semibold px-4 py-2 rounded-lg">Confirmar</button>
                        ` : `
                            <p class="text-sm text-stone-500">
                                No tenés animales publicados disponibles para derivar a tránsito.
                            </p>`}
                    </div>
                </div>`).join('');

            lista.querySelectorAll('[data-toggle]').forEach(btn => {
                btn.addEventListener('click', () => {
                    lista.querySelector(`[data-panel="${btn.dataset.toggle}"]`)?.classList.toggle('hidden');
                });
            });

            lista.querySelectorAll('[data-confirmar]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = btn.dataset.confirmar;
                    const petId = lista.querySelector(`[data-select="${id}"]`).value;
                    asignar(id, petId, btn);
                });
            });
        } catch (err) {
            lista.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
        }
    }

    async function asignar(volunteerId, petId, btn) {
        btn.disabled = true;
        btn.innerText = 'Asignando...';
        try {
            await asignarTransito({ volunteer_id: Number(volunteerId), pet_id: Number(petId) });
            window.PataMatch.toast('Animal asignado al hogar de tránsito', 'success');
            cargarHogares();
        } catch (err) {
            // El backend rechaza si no hay cupo, si el hogar no recibe esa
            // especie o si el animal ya está en otro hogar.
            window.PataMatch.toast(err.message, 'error');
            btn.disabled = false;
            btn.innerText = 'Confirmar';
        }
    }

    cargarMiHogar();
    if (esGestor) {
        document.getElementById('btn-filtrar')?.addEventListener('click', cargarHogares);
        cargarHogares();
    }
}
