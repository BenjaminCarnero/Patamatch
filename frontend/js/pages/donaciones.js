import { getRefugios, registrarDonacion, getMisDonaciones, cambiarEstadoDonacion } from '../api.js';

// El sistema registra donaciones y hace seguimiento; no cobra. Por eso la
// donación nace "comprometida" y el refugio confirma cuando efectivamente la
// recibe. Es importante que la interfaz sea honesta sobre eso: nadie tiene que
// creer que acá se está pagando algo.

const ETIQUETAS = {
    comprometida: 'bg-orange-100 text-orange-700',
    recibida: 'bg-green-100 text-green-700',
    cancelada: 'bg-stone-100 text-stone-500'
};

export function render() {
    const user = window.PataMatch.user;

    if (!user) {
        return `
        <div class="max-w-2xl mx-auto px-6 py-20 text-center">
            <span class="material-symbols-outlined text-6xl text-[#D96C4A] mb-4">volunteer_activism</span>
            <h1 class="font-headline-lg text-stone-800 mb-3">Donaciones</h1>
            <p class="text-stone-600 mb-8">Iniciá sesión para registrar una donación a un refugio verificado.</p>
            <a href="#login" class="bg-[#D96C4A] text-white px-8 py-3 rounded-xl font-bold inline-block">Iniciar Sesión</a>
        </div>`;
    }

    return `
    <div class="max-w-3xl mx-auto px-6 py-12">
        <div class="mb-8">
            <h1 class="font-headline-lg text-stone-800 mb-2">Donaciones</h1>
            <p class="text-stone-600">
                Los refugios se sostienen con lo que aporta la comunidad. Podés donar dinero
                o cosas concretas: alimento, mantas, medicamentos, artículos de limpieza.
            </p>
        </div>

        <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 flex gap-3">
            <span class="material-symbols-outlined text-amber-700 text-[20px] shrink-0">info</span>
            <p class="text-sm text-amber-900">
                PataMatch <strong>no procesa pagos</strong>. Acá registrás tu compromiso y coordinás
                la entrega con el refugio, que confirma cuando lo recibe. Así queda constancia
                de lo aportado sin intermediarios.
            </p>
        </div>

        <form id="don-form" class="bg-white rounded-2xl border border-stone-100 shadow-sm p-6 space-y-5 mb-10">
            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">¿A qué refugio?</label>
                <select id="don-refugio" required class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none">
                    <option value="">Cargando refugios...</option>
                </select>
            </div>

            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">¿Qué querés donar?</label>
                <div class="flex gap-3">
                    <label class="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 cursor-pointer has-[:checked]:border-[#D96C4A] has-[:checked]:bg-[#D96C4A]/5">
                        <input type="radio" name="tipo" value="especie" checked class="accent-[#D96C4A]"/>
                        <span class="text-sm font-semibold text-stone-700">Cosas</span>
                    </label>
                    <label class="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border border-stone-200 cursor-pointer has-[:checked]:border-[#D96C4A] has-[:checked]:bg-[#D96C4A]/5">
                        <input type="radio" name="tipo" value="dinero" class="accent-[#D96C4A]"/>
                        <span class="text-sm font-semibold text-stone-700">Dinero</span>
                    </label>
                </div>
            </div>

            <div id="campo-especie">
                <label class="block text-sm font-semibold text-stone-700 mb-2">¿Qué y cuánto?</label>
                <input id="don-descripcion" placeholder="Ej: 20 kg de alimento balanceado, 3 mantas"
                    class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"/>
            </div>

            <div id="campo-dinero" class="hidden">
                <label class="block text-sm font-semibold text-stone-700 mb-2">Monto (pesos)</label>
                <input id="don-monto" type="number" min="1" step="1" placeholder="5000"
                    class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"/>
            </div>

            <div>
                <label class="block text-sm font-semibold text-stone-700 mb-2">Cómo coordinás la entrega (opcional)</label>
                <textarea id="don-notas" rows="2" placeholder="Ej: lo llevo el sábado a la mañana"
                    class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white outline-none"></textarea>
            </div>

            <button type="submit" id="don-enviar"
                class="bg-[#D96C4A] text-white px-8 py-3 rounded-xl font-bold w-full sm:w-auto">
                Registrar donación
            </button>
        </form>

        <h2 class="font-bold text-xl text-stone-800 mb-4">Mis donaciones</h2>
        <div id="don-mias" class="space-y-3"></div>
    </div>`;
}

export function init() {
    if (!window.PataMatch.user) return;

    const $ = (id) => document.getElementById(id);

    // Alternar los campos según el tipo, para no pedir un monto cuando la
    // donación es un bolsón de alimento.
    document.querySelectorAll('input[name="tipo"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const esDinero = radio.value === 'dinero' && radio.checked;
            $('campo-dinero').classList.toggle('hidden', !esDinero);
            $('campo-especie').classList.toggle('hidden', esDinero);
        });
    });

    (async () => {
        try {
            const { data } = await getRefugios();
            $('don-refugio').innerHTML = data.length
                ? `<option value="">Elegí un refugio</option>` +
                  data.map(r => `<option value="${r.id}">${r.name}${r.city ? ' — ' + r.city : ''}</option>`).join('')
                : '<option value="">No hay refugios verificados todavía</option>';
        } catch (err) {
            $('don-refugio').innerHTML = '<option value="">No se pudieron cargar los refugios</option>';
        }
    })();

    async function cargarMias() {
        const cont = $('don-mias');
        try {
            const { data } = await getMisDonaciones();
            if (!data.length) {
                cont.innerHTML = '<p class="text-sm text-stone-500">Todavía no registraste ninguna donación.</p>';
                return;
            }

            cont.innerHTML = data.map(d => `
                <div class="bg-white rounded-xl border border-stone-100 p-4 flex flex-wrap items-center gap-4">
                    <div class="flex-1 min-w-[160px]">
                        <p class="font-semibold text-stone-800 text-sm">
                            ${d.tipo === 'dinero' ? `$${Number(d.monto).toLocaleString('es-AR')}` : d.descripcion}
                        </p>
                        <p class="text-xs text-stone-500">Para ${d.refugio_name}${d.refugio_city ? ' · ' + d.refugio_city : ''}</p>
                    </div>
                    <span class="text-[11px] font-bold px-2 py-1 rounded-full ${ETIQUETAS[d.estado]} shrink-0">${d.estado.toUpperCase()}</span>
                    ${d.estado === 'comprometida'
                        ? `<button data-cancelar="${d.id}" class="text-xs font-semibold text-stone-500 hover:text-red-600 shrink-0">Cancelar</button>`
                        : ''}
                </div>`).join('');

            cont.querySelectorAll('[data-cancelar]').forEach(b =>
                b.addEventListener('click', async () => {
                    if (!confirm('¿Cancelar esta donación?')) return;
                    try {
                        await cambiarEstadoDonacion(b.dataset.cancelar, 'cancelada');
                        window.PataMatch.toast('Donación cancelada', 'success');
                        cargarMias();
                    } catch (err) {
                        window.PataMatch.toast(err.message, 'error');
                    }
                }));
        } catch (err) {
            cont.innerHTML = `<p class="text-sm text-red-600">${err.message}</p>`;
        }
    }

    $('don-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = $('don-enviar');
        const tipo = document.querySelector('input[name="tipo"]:checked').value;
        const refugio_id = $('don-refugio').value;

        if (!refugio_id) {
            window.PataMatch.toast('Elegí un refugio', 'error');
            return;
        }

        btn.disabled = true;
        btn.innerText = 'Registrando...';
        try {
            await registrarDonacion({
                refugio_id: Number(refugio_id),
                tipo,
                monto: tipo === 'dinero' ? $('don-monto').value : null,
                descripcion: tipo === 'especie' ? $('don-descripcion').value : '',
                notas: $('don-notas').value
            });
            window.PataMatch.toast('¡Gracias! El refugio ya fue avisado', 'success');
            $('don-descripcion').value = '';
            $('don-monto').value = '';
            $('don-notas').value = '';
            cargarMias();
        } catch (err) {
            window.PataMatch.toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Registrar donación';
        }
    });

    cargarMias();
}
