// RF-16 — Asistente de adopción: ventana flotante que arma el perfil del hogar
// con preguntas de un toque y devuelve mascotas reales del catálogo.
//
// Las preguntas son fijas y viven acá, no las genera el modelo. Eso hace que la
// entrada al modelo sea siempre la misma estructura: no hay texto libre del
// usuario que pueda desviar la conversación. La IA se usa donde aporta —
// razonar el encaje y explicarlo — y no para algo que un formulario ya resuelve.
const PREGUNTAS = [
    {
        clave: 'vivienda', texto: '¿Dónde vivís?',
        opciones: [{ label: 'En casa', valor: 'casa' }, { label: 'En departamento', valor: 'departamento' }]
    },
    {
        clave: 'patio', texto: '¿Tenés patio o balcón grande?',
        opciones: [{ label: 'Sí', valor: true }, { label: 'No', valor: false }]
    },
    {
        clave: 'ninos', texto: '¿Hay chicos en casa?',
        opciones: [{ label: 'Sí', valor: true }, { label: 'No', valor: false }]
    },
    {
        clave: 'otras_mascotas', texto: '¿Ya tenés otras mascotas?',
        opciones: [{ label: 'Sí', valor: true }, { label: 'No', valor: false }]
    },
    {
        clave: 'tiempo', texto: '¿Cuánto tiempo por día le podrías dedicar?',
        opciones: [
            { label: 'Menos de 1 hora', valor: 'poco' },
            { label: '1 a 3 horas', valor: 'medio' },
            { label: 'Más de 3 horas', valor: 'mucho' }
        ]
    },
    {
        clave: 'experiencia', texto: '¿Tuviste mascotas antes?',
        opciones: [{ label: 'Sí', valor: true }, { label: 'No, sería la primera', valor: false }]
    },
    {
        clave: 'preferencia', texto: '¿Tenés preferencia?',
        opciones: [
            { label: 'Perro', valor: 'perro' },
            { label: 'Gato', valor: 'gato' },
            { label: 'Me da igual', valor: 'indistinto' }
        ]
    }
];

let perfil = {};
let paso = 0;
let abierto = false;

function el(id) { return document.getElementById(id); }

function burbujaBot(html) {
    return `<div class="flex gap-2 mb-3">
        <div class="w-7 h-7 rounded-full bg-[#D96C4A] text-white flex items-center justify-center shrink-0 text-[13px]">
            <span class="material-symbols-outlined text-[16px]">pets</span>
        </div>
        <div class="bg-white border border-stone-100 rounded-2xl rounded-tl-sm px-3 py-2 text-sm text-stone-700 max-w-[85%]">${html}</div>
    </div>`;
}

function burbujaUsuario(texto) {
    return `<div class="flex justify-end mb-3">
        <div class="bg-[#D96C4A] text-white rounded-2xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">${texto}</div>
    </div>`;
}

function alFinal() {
    const cuerpo = el('asis-cuerpo');
    cuerpo.scrollTop = cuerpo.scrollHeight;
}

function mostrarPregunta() {
    const p = PREGUNTAS[paso];
    el('asis-cuerpo').insertAdjacentHTML('beforeend', burbujaBot(p.texto));
    el('asis-opciones').innerHTML = p.opciones.map((o, i) =>
        `<button data-op="${i}" class="px-3 py-1.5 rounded-full border border-[#D96C4A]/40 text-[#D96C4A] text-xs font-semibold hover:bg-[#D96C4A]/10 transition-colors">${o.label}</button>`
    ).join('');

    el('asis-opciones').querySelectorAll('[data-op]').forEach(btn => {
        btn.addEventListener('click', () => responder(p, p.opciones[Number(btn.dataset.op)]));
    });
    alFinal();
}

function responder(pregunta, opcion) {
    perfil[pregunta.clave] = opcion.valor;
    el('asis-cuerpo').insertAdjacentHTML('beforeend', burbujaUsuario(opcion.label));
    el('asis-opciones').innerHTML = '';
    paso++;

    if (paso < PREGUNTAS.length) {
        setTimeout(mostrarPregunta, 300);
    } else {
        buscarRecomendaciones();
    }
}

async function buscarRecomendaciones() {
    el('asis-cuerpo').insertAdjacentHTML('beforeend',
        burbujaBot('<span class="text-stone-400">Buscando en el catálogo...</span>'));
    alFinal();

    try {
        const r = await fetch('/api/ai/recomendar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ perfil })
        });
        const j = await r.json();

        // Se saca la burbuja de "buscando".
        el('asis-cuerpo').lastElementChild?.remove();

        if (!j.success) {
            el('asis-cuerpo').insertAdjacentHTML('beforeend', burbujaBot(j.error));
            mostrarReinicio();
            return;
        }

        el('asis-cuerpo').insertAdjacentHTML('beforeend', burbujaBot(j.data.mensaje));

        j.data.recomendaciones.forEach(m => {
            el('asis-cuerpo').insertAdjacentHTML('beforeend', `
                <a href="#adoptar" class="block bg-white border border-stone-100 rounded-xl p-3 mb-2 hover:border-[#D96C4A]/40 transition-colors">
                    <div class="flex gap-3">
                        <img src="${m.image_url || ''}" alt="${m.name}" class="w-14 h-14 rounded-lg object-cover bg-stone-100 shrink-0"/>
                        <div class="min-w-0">
                            <p class="font-bold text-stone-800 text-sm">${m.name}</p>
                            <p class="text-[11px] text-stone-500 mb-1">${m.species} · ${m.breed || ''} · ${m.size || ''}</p>
                            <p class="text-xs text-stone-600 leading-snug">${m.razon}</p>
                        </div>
                    </div>
                </a>`);
        });

        if (j.data.sugerir_transito) {
            el('asis-cuerpo').insertAdjacentHTML('beforeend', burbujaBot(
                `Si por ahora ninguna te convence, también podés ayudar siendo
                 <a href="#voluntariado" class="text-[#D96C4A] font-semibold underline">hogar de tránsito</a>:
                 alojás a un animal un tiempo hasta que encuentre familia.`
            ));
        }

        mostrarReinicio();
    } catch (err) {
        el('asis-cuerpo').lastElementChild?.remove();
        el('asis-cuerpo').insertAdjacentHTML('beforeend', burbujaBot('No pude conectarme. Probá de nuevo en un momento.'));
        mostrarReinicio();
    }
    alFinal();
}

function mostrarReinicio() {
    el('asis-opciones').innerHTML =
        `<button id="asis-reiniciar" class="px-3 py-1.5 rounded-full border border-stone-300 text-stone-600 text-xs font-semibold hover:bg-stone-50">Empezar de nuevo</button>`;
    el('asis-reiniciar').addEventListener('click', reiniciar);
    alFinal();
}

function reiniciar() {
    perfil = {};
    paso = 0;
    el('asis-cuerpo').innerHTML = burbujaBot(
        '¡Hola! Te hago unas preguntas cortas sobre tu casa y tu día a día, y te propongo las mascotas del catálogo que mejor encajen.'
    );
    mostrarPregunta();
}

function alternar() {
    abierto = !abierto;
    el('asis-panel').classList.toggle('hidden', !abierto);
    el('asis-icono').textContent = abierto ? 'close' : 'chat';
    if (abierto && paso === 0 && Object.keys(perfil).length === 0) reiniciar();
}

export function montarAsistente() {
    if (el('asis-boton')) return;

    document.body.insertAdjacentHTML('beforeend', `
        <div id="asis-panel" class="hidden fixed bottom-24 right-6 z-[60] w-[min(92vw,360px)] h-[min(70vh,520px)] bg-[#FFFBF7] rounded-2xl shadow-2xl border border-stone-200 flex flex-col overflow-hidden">
            <div class="bg-[#D96C4A] text-white px-4 py-3 shrink-0">
                <p class="font-bold text-sm">Asistente de adopción</p>
                <p class="text-[11px] opacity-90">Te ayudo a encontrar tu mascota ideal</p>
            </div>
            <div id="asis-cuerpo" class="flex-1 overflow-y-auto p-3"></div>
            <div id="asis-opciones" class="shrink-0 p-3 pt-0 flex flex-wrap gap-2"></div>
        </div>

        <button id="asis-boton" aria-label="Abrir asistente de adopción"
            class="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-[#D96C4A] text-white shadow-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
            <span id="asis-icono" class="material-symbols-outlined">chat</span>
        </button>
    `);

    el('asis-boton').addEventListener('click', alternar);
}
