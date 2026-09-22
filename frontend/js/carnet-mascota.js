// Carnet digital y estado de salud de las mascotas del catálogo.
// Lo comparten el catálogo (cartel + modal de solo lectura) y el backoffice
// (formulario de carga). Es distinto de pages/carnet.js, que es el carnet de la
// mascota propia del usuario.
import * as api from './api.js?v=4';

// Cartel que se ve en el catálogo. Las clases van completas (no armadas por
// string) para que Tailwind las incluya en el build.
export const ESTADOS_SALUD = {
  disponible: {
    label: 'Disponible',
    icon: 'check_circle',
    ayuda: 'Se puede adoptar ahora mismo',
    cartel: 'bg-green-600/90 text-white',
    chip: 'bg-green-100 text-green-700 border-green-200'
  },
  con_cuidado: {
    label: 'Con cuidados',
    icon: 'healing',
    ayuda: 'Salió hace poco de una operación: se adopta con indicaciones',
    cartel: 'bg-amber-500/90 text-white',
    chip: 'bg-amber-100 text-amber-700 border-amber-200'
  },
  en_reposo: {
    label: 'En reposo',
    icon: 'bed',
    ayuda: 'Recién operado: todavía no puede irse a un hogar',
    cartel: 'bg-sky-600/90 text-white',
    chip: 'bg-sky-100 text-sky-700 border-sky-200'
  },
  cirugia_programada: {
    label: 'Cirugía en camino',
    icon: 'medical_services',
    ayuda: 'Tiene una operación programada antes de poder entregarse',
    cartel: 'bg-rose-600/90 text-white',
    chip: 'bg-rose-100 text-rose-700 border-rose-200'
  }
};

// Los datos del carnet los escribe el refugio; se escapan al renderizar.
export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

export function estadoDe(pet) {
  return ESTADOS_SALUD[pet.health_status] || ESTADOS_SALUD.disponible;
}

// Franja informativa sobre la foto de la tarjeta del catálogo. No es clickeable:
// el carnet se abre tocando la foto del animal. pointer-events-none deja pasar
// el click a la imagen que tiene debajo.
export function buildCartelEstado(pet) {
  const e = estadoDe(pet);
  const nota = pet.health_note ? ` title="${esc(pet.health_note)}"` : '';
  return `
    <div class="absolute bottom-0 inset-x-0 ${e.cartel} backdrop-blur-sm px-4 py-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider pointer-events-none"${nota}>
      <span class="material-symbols-outlined text-[16px]" style="font-variation-settings: 'FILL' 1;">${e.icon}</span>
      ${e.label}
    </div>`;
}

// Chip chico (backoffice, cabecera del carnet).
export function buildChipEstado(pet) {
  const e = estadoDe(pet);
  return `<span class="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border ${e.chip}">
    <span class="material-symbols-outlined text-[14px]" style="font-variation-settings: 'FILL' 1;">${e.icon}</span>${e.label}
  </span>`;
}

// ---------- Modal de solo lectura (catálogo) ----------

const ESTADO_VACUNA = {
  updated: ['Al día', 'bg-green-100 text-green-700'],
  expiring: ['Vence pronto', 'bg-yellow-100 text-yellow-700'],
  expired: ['Vencida / pendiente', 'bg-red-100 text-red-700']
};

const ESTADO_ENFERMEDAD = {
  activa: ['Activa', 'bg-red-100 text-red-700'],
  en_tratamiento: ['En tratamiento', 'bg-amber-100 text-amber-700'],
  cronica: ['Crónica (controlada)', 'bg-sky-100 text-sky-700'],
  curada: ['Curada', 'bg-green-100 text-green-700']
};

function dato(label, valor) {
  return `
    <div>
      <p class="text-[10px] font-bold uppercase tracking-widest text-stone-400 mb-0.5">${label}</p>
      <p class="text-sm font-semibold text-stone-800">${esc(valor) || '<span class="text-stone-300 font-normal">—</span>'}</p>
    </div>`;
}

function seccion(icono, titulo, cuerpo) {
  return `
    <section class="bg-white rounded-2xl border border-stone-100 p-5">
      <h4 class="flex items-center gap-2 text-sm font-bold text-stone-800 mb-3">
        <span class="material-symbols-outlined text-[#D96C4A] text-[20px]">${icono}</span>${titulo}
      </h4>
      ${cuerpo}
    </section>`;
}

function vacio(texto) {
  return `<p class="text-sm text-stone-400">${texto}</p>`;
}

export function buildCarnetHTML(pet) {
  const c = pet.carnet;
  const e = estadoDe(pet);

  const cabecera = `
    <div class="flex flex-col sm:flex-row gap-5">
      <img src="${esc(pet.image_url) || 'https://via.placeholder.com/300'}" alt="${esc(pet.name)}"
           class="w-full sm:w-40 h-40 rounded-2xl object-cover bg-stone-100 shrink-0"/>
      <div class="flex-1 min-w-0">
        <p class="text-[11px] font-bold uppercase tracking-widest text-[#D96C4A] mb-1">Carnet digital · PataMatch</p>
        <h3 class="text-2xl font-black text-stone-900 leading-tight">${esc(pet.name)}</h3>
        <p class="text-sm text-stone-500 mb-3">
          ${esc(pet.species)}${pet.breed ? ' · ' + esc(pet.breed) : ''}${c?.gender ? ' · ' + esc(c.gender) : ''}
        </p>
        <div class="flex flex-wrap gap-2 mb-3">
          ${pet.age ? `<span class="px-2.5 py-1 bg-stone-100 rounded-full text-xs font-medium text-stone-600">${esc(pet.age)}</span>` : ''}
          ${pet.size ? `<span class="px-2.5 py-1 bg-stone-100 rounded-full text-xs font-medium text-stone-600">${esc(pet.size)}</span>` : ''}
          ${pet.location ? `<span class="px-2.5 py-1 bg-stone-100 rounded-full text-xs font-medium text-stone-600">${esc(pet.location)}</span>` : ''}
        </div>
        <div class="rounded-xl border ${e.chip} px-4 py-3">
          <p class="flex items-center gap-1.5 text-sm font-bold">
            <span class="material-symbols-outlined text-[18px]" style="font-variation-settings: 'FILL' 1;">${e.icon}</span>${e.label}
          </p>
          <p class="text-xs mt-0.5 opacity-90">${esc(pet.health_note) || e.ayuda}</p>
        </div>
      </div>
    </div>`;

  if (!c) {
    // El dueño de la publicación (o un admin) lo carga desde el panel; a
    // cualquier otro visitante se le sugiere pedirlo por chat.
    const yo = window.PataMatch?.user;
    const esDuenio = yo && (yo.id === pet.user_id || yo.role === 'admin');
    return cabecera + `
      <div class="mt-5 text-center py-10 border border-dashed border-stone-200 rounded-2xl">
        <span class="material-symbols-outlined text-4xl text-stone-300 mb-2">id_card</span>
        <p class="font-semibold text-stone-700">Este animal todavía no tiene su carnet cargado</p>
        ${esDuenio ? `
          <p class="text-sm text-stone-400 mt-1">Es tu publicación: cargá vacunas, enfermedades y datos médicos desde tu panel.</p>
          <a href="#backoffice" data-cerrar class="inline-flex items-center gap-2 mt-4 px-5 py-3 rounded-xl bg-[#D96C4A] text-white text-sm font-semibold shadow-md">
            <span class="material-symbols-outlined text-[18px]">edit_document</span>Cargar carnet
          </a>` : `
          <p class="text-sm text-stone-400 mt-1">Podés pedirle al refugio los datos de salud y vacunas por el chat.</p>`}
      </div>`;
  }

  const vacunas = c.vaccinations.length
    ? `<div class="overflow-x-auto -mx-2"><table class="w-full text-left text-sm">
        <thead><tr class="text-[10px] uppercase tracking-widest text-stone-400">
          <th class="px-2 pb-2 font-bold">Vacuna</th><th class="px-2 pb-2 font-bold">Última</th>
          <th class="px-2 pb-2 font-bold">Próxima</th><th class="px-2 pb-2 font-bold">Estado</th>
        </tr></thead>
        <tbody class="divide-y divide-stone-100">
          ${c.vaccinations.map(v => {
            const [txt, cls] = ESTADO_VACUNA[v.status] || ESTADO_VACUNA.updated;
            return `<tr>
              <td class="px-2 py-2.5 font-semibold text-stone-800">${esc(v.name)}</td>
              <td class="px-2 py-2.5 text-stone-500">${esc(v.last_dose) || '—'}</td>
              <td class="px-2 py-2.5 text-stone-500">${esc(v.next_dose) || '—'}</td>
              <td class="px-2 py-2.5"><span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${cls}">${txt}</span></td>
            </tr>`;
          }).join('')}
        </tbody></table></div>`
    : vacio('Sin vacunas registradas.');

  const enfermedades = c.diseases.length
    ? `<ul class="space-y-2">${c.diseases.map(d => {
        const [txt, cls] = ESTADO_ENFERMEDAD[d.status] || ESTADO_ENFERMEDAD.activa;
        return `<li class="flex flex-wrap items-start gap-2">
          <span class="px-2 py-1 rounded-md text-[10px] font-bold uppercase ${cls} shrink-0">${txt}</span>
          <div class="flex-1 min-w-[140px]">
            <p class="text-sm font-semibold text-stone-800">${esc(d.name)}</p>
            ${d.notes ? `<p class="text-xs text-stone-500">${esc(d.notes)}</p>` : ''}
          </div>
        </li>`;
      }).join('')}</ul>`
    : `<p class="text-sm text-green-700 flex items-center gap-1"><span class="material-symbols-outlined text-[18px]">check_circle</span>Sin enfermedades conocidas.</p>`;

  const historial = c.medical_history.length
    ? `<ol class="relative border-l border-stone-200 ml-2 space-y-4">${c.medical_history.map(h => `
        <li class="pl-4">
          <span class="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-[#D96C4A]"></span>
          <p class="text-[10px] font-bold uppercase tracking-widest text-stone-400">${esc(h.date)}</p>
          <p class="text-sm font-semibold text-stone-800">${esc(h.title)}</p>
          ${h.description ? `<p class="text-xs text-stone-500">${esc(h.description)}</p>` : ''}
        </li>`).join('')}</ol>`
    : vacio('Sin consultas registradas.');

  const vet = c.vet_name || c.vet_clinic
    ? `<p class="text-sm font-semibold text-stone-800">${esc(c.vet_name)}</p>
       <p class="text-xs text-stone-500">${esc(c.vet_clinic)}</p>
       ${c.vet_phone ? `<a href="tel:${esc(c.vet_phone)}" class="inline-flex items-center gap-1 mt-2 text-sm font-semibold text-[#D96C4A]">
          <span class="material-symbols-outlined text-[18px]">call</span>${esc(c.vet_phone)}</a>` : ''}`
    : vacio('Sin veterinario asignado.');

  return cabecera + `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 bg-stone-50 rounded-2xl p-5">
      ${dato('Nacimiento', c.birth_date)}
      ${dato('Peso', c.weight_kg != null && c.weight_kg !== '' ? `${c.weight_kg} kg` : '')}
      ${dato('Esterilizado', c.spayed_neutered ? 'Sí' : 'No')}
      ${dato('Color / señas', c.color_markings)}
      ${dato('Microchip', c.microchip_id)}
      ${dato('Alergias', c.allergies)}
    </div>
    <div class="grid md:grid-cols-2 gap-4 mt-4">
      <div class="md:col-span-2">${seccion('vaccines', 'Vacunas', vacunas)}</div>
      ${seccion('coronavirus', 'Enfermedades', enfermedades)}
      ${seccion('medication', 'Tratamiento actual', c.treatments ? `<p class="text-sm text-stone-700">${esc(c.treatments)}</p>` : vacio('Sin tratamiento en curso.'))}
      ${seccion('history_edu', 'Historial médico', historial)}
      ${seccion('local_hospital', 'Veterinario', vet)}
    </div>`;
}

function asegurarModal() {
  let modal = document.getElementById('carnet-mascota-modal');
  if (modal) return modal;
  modal = document.createElement('div');
  modal.id = 'carnet-mascota-modal';
  modal.className = 'fixed inset-0 z-[210] hidden items-center justify-center p-4';
  modal.innerHTML = `
    <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" data-cerrar></div>
    <div class="relative bg-[#FAF8F5] rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto z-10">
      <button data-cerrar class="absolute top-4 right-4 p-2 rounded-full bg-white/80 hover:bg-white shadow-sm z-20" aria-label="Cerrar">
        <span class="material-symbols-outlined text-stone-600">close</span>
      </button>
      <div id="carnet-mascota-body" class="p-6 md:p-8"></div>
    </div>`;
  document.body.appendChild(modal);
  // Delegado: el cuerpo del modal se vuelve a renderizar en cada apertura y
  // puede traer sus propios [data-cerrar] (ej. el botón "Cargar carnet").
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-cerrar]')) cerrarCarnetMascota();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarCarnetMascota(); });
  return modal;
}

export function cerrarCarnetMascota() {
  const modal = document.getElementById('carnet-mascota-modal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}

export async function abrirCarnetMascota(petId) {
  const modal = asegurarModal();
  const body = modal.querySelector('#carnet-mascota-body');
  body.innerHTML = '<p class="text-center py-16 text-stone-400">Cargando carnet...</p>';
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  try {
    const { data } = await api.getCarnetMascota(petId);
    body.innerHTML = buildCarnetHTML(data);
  } catch (err) {
    body.innerHTML = `<p class="text-center py-16 text-red-600">${esc(err.message || 'No se pudo cargar el carnet')}</p>`;
  }
}

// ---------- Formulario de carga (backoffice) ----------

const INPUT = 'px-3 py-2 rounded-lg border border-stone-200 text-sm bg-white w-full';

function campo(name, label, valor, extra = '') {
  return `<label class="block">
    <span class="block text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-1">${label}</span>
    <input name="${name}" value="${esc(valor)}" class="${INPUT}" ${extra}/>
  </label>`;
}

// Cada lista (vacunas, enfermedades, historial) es un bloque de filas con
// botón para agregar. La definición dice qué columnas tiene cada fila.
const LISTAS = {
  vaccinations: {
    titulo: 'Vacunas', agregar: 'Agregar vacuna',
    cols: [
      ['name', 'Vacuna', 'text'], ['last_dose', 'Última dosis', 'text'], ['next_dose', 'Próxima dosis', 'text'],
      ['status', 'Estado', 'select', [['updated', 'Al día'], ['expiring', 'Vence pronto'], ['expired', 'Vencida / pendiente']]]
    ]
  },
  diseases: {
    titulo: 'Enfermedades', agregar: 'Agregar enfermedad',
    cols: [
      ['name', 'Enfermedad', 'text'],
      ['status', 'Estado', 'select', [['activa', 'Activa'], ['en_tratamiento', 'En tratamiento'], ['cronica', 'Crónica (controlada)'], ['curada', 'Curada']]],
      ['notes', 'Notas', 'text']
    ]
  },
  medical_history: {
    titulo: 'Historial médico', agregar: 'Agregar consulta',
    cols: [['date', 'Fecha', 'text'], ['title', 'Motivo', 'text'], ['description', 'Detalle', 'text']]
  }
};

function filaLista(lista, item = {}) {
  const { cols } = LISTAS[lista];
  return `<div class="grid gap-2 items-end" style="grid-template-columns: repeat(${cols.length}, minmax(0, 1fr)) auto" data-fila>
    ${cols.map(([name, label, tipo, opciones]) => tipo === 'select'
      ? `<label class="block"><span class="block text-[10px] text-stone-400 mb-0.5">${label}</span>
          <select data-col="${name}" class="${INPUT}">
            ${opciones.map(([v, t]) => `<option value="${v}" ${item[name] === v ? 'selected' : ''}>${t}</option>`).join('')}
          </select></label>`
      : `<label class="block"><span class="block text-[10px] text-stone-400 mb-0.5">${label}</span>
          <input data-col="${name}" value="${esc(item[name])}" class="${INPUT}"/></label>`
    ).join('')}
    <button type="button" data-quitar class="p-2 text-stone-400 hover:text-red-600" aria-label="Quitar">
      <span class="material-symbols-outlined text-[18px]">delete</span>
    </button>
  </div>`;
}

function bloqueLista(lista, items) {
  const def = LISTAS[lista];
  return `<fieldset class="sm:col-span-2 border border-stone-200 rounded-xl p-3" data-lista="${lista}">
    <legend class="px-1 text-[11px] font-bold uppercase tracking-wide text-stone-500">${def.titulo}</legend>
    <div class="space-y-2" data-filas>${(items || []).map(i => filaLista(lista, i)).join('')}</div>
    <button type="button" data-agregar class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#D96C4A]">
      <span class="material-symbols-outlined text-[16px]">add_circle</span>${def.agregar}
    </button>
  </fieldset>`;
}

export function buildCarnetForm(carnet) {
  const c = carnet || {};
  return `
    <div class="grid sm:grid-cols-2 gap-3">
      <label class="block">
        <span class="block text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-1">Sexo</span>
        <select name="gender" class="${INPUT}">
          <option value="">Sin especificar</option>
          ${['Macho', 'Hembra'].map(g => `<option ${c.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </label>
      ${campo('birth_date', 'Fecha de nacimiento', c.birth_date, 'type="date"')}
      ${campo('weight_kg', 'Peso (kg)', c.weight_kg ?? '', 'type="number" step="0.1" min="0"')}
      ${campo('microchip_id', 'Microchip', c.microchip_id)}
      ${campo('color_markings', 'Color / señas particulares', c.color_markings)}
      ${campo('allergies', 'Alergias', c.allergies)}
      <label class="sm:col-span-2 flex items-center gap-2 text-sm text-stone-700">
        <input type="checkbox" name="spayed_neutered" ${c.spayed_neutered ? 'checked' : ''} class="w-4 h-4 accent-[#D96C4A]"/>
        Esterilizado / castrado
      </label>
      ${bloqueLista('vaccinations', c.vaccinations)}
      ${bloqueLista('diseases', c.diseases)}
      <label class="sm:col-span-2 block">
        <span class="block text-[11px] font-bold uppercase tracking-wide text-stone-400 mb-1">Tratamiento actual</span>
        <textarea name="treatments" rows="2" class="${INPUT}">${esc(c.treatments)}</textarea>
      </label>
      ${bloqueLista('medical_history', c.medical_history)}
      ${campo('vet_name', 'Veterinario', c.vet_name)}
      ${campo('vet_clinic', 'Clínica', c.vet_clinic)}
      ${campo('vet_phone', 'Teléfono de la clínica', c.vet_phone)}
    </div>`;
}

// Enlaza los botones de agregar/quitar filas dentro de un formulario ya renderizado.
export function activarCarnetForm(form) {
  form.querySelectorAll('[data-lista]').forEach(bloque => {
    const lista = bloque.dataset.lista;
    bloque.querySelector('[data-agregar]').addEventListener('click', () => {
      bloque.querySelector('[data-filas]').insertAdjacentHTML('beforeend', filaLista(lista));
    });
  });
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-quitar]');
    if (btn) btn.closest('[data-fila]').remove();
  });
}

export function leerCarnetForm(form) {
  const datos = Object.fromEntries(new FormData(form).entries());
  datos.spayed_neutered = form.querySelector('[name="spayed_neutered"]').checked;
  for (const lista of Object.keys(LISTAS)) {
    datos[lista] = [...form.querySelectorAll(`[data-lista="${lista}"] [data-fila]`)].map(fila =>
      Object.fromEntries([...fila.querySelectorAll('[data-col]')].map(el => [el.dataset.col, el.value.trim()]))
    );
  }
  return datos;
}
