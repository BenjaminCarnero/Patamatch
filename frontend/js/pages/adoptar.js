import * as api from '../api.js?v=4';
import { ESTADOS_SALUD, buildCartelEstado, abrirCarnetMascota } from '../carnet-mascota.js?v=1';

function buildPetCard(pet) {
  const badgeHtml = pet.badge
    ? `<div class="absolute top-4 left-4 bg-${pet.badge_color === 'secondary' ? 'secondary' : 'primary'}/90 text-on-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">${pet.badge}</div>`
    : '';

  const favFilled = pet.isFavorite; 
  const favClass = favFilled ? 'text-primary' : 'text-on-surface-variant';

  return `
    <div class="pet-card group bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden hover:shadow-md transition-shadow duration-300" data-species="${pet.species}" data-id="${pet.id}">
      <div class="relative h-64 overflow-hidden">
        <img class="pet-photo w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-pointer" src="${pet.image_url || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${pet.name}" title="Tocá la foto para ver el carnet digital de ${pet.name}" data-pet-id="${pet.id}" />
        ${badgeHtml}
        ${buildCartelEstado(pet)}
        <button class="fav-btn absolute top-4 right-4 bg-white/80 backdrop-blur-md p-2 rounded-full ${favClass} hover:bg-primary hover:text-on-primary transition-all shadow-sm" data-pet-id="${pet.id}" data-favorited="${favFilled}">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${favFilled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24;">favorite</span>
        </button>
      </div>
      <div class="p-6">
        <div class="flex justify-between items-start mb-1">
          <h3 class="font-headline-md text-on-surface">${pet.name}</h3>
          <span class="px-2 py-1 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded uppercase">${pet.species}</span>
        </div>
        <p class="text-sm text-on-surface-variant italic mb-3 line-clamp-1">${pet.description || (pet.species === 'Gato' ? 'Independiente y cariñoso' : 'Juguetón y muy cariñoso')}</p>
        <div class="flex flex-wrap gap-2 mb-4">
          <span class="px-3 py-1 bg-surface-container-high rounded-full text-xs font-medium text-on-surface-variant flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">event</span> ${pet.age}
          </span>
          <span class="px-3 py-1 bg-surface-container-high rounded-full text-xs font-medium text-on-surface-variant flex items-center gap-1">
            <span class="material-symbols-outlined text-sm">straighten</span> ${pet.size}
          </span>
        </div>
        <div class="flex items-center gap-1 text-on-surface-variant text-sm mb-6">
          <span class="material-symbols-outlined text-base">location_on</span>
          ${pet.location}
        </div>
        <button class="adopt-btn w-full py-3 bg-primary text-on-primary font-label-lg rounded-xl hover:bg-primary-container transition-all shadow-sm flex items-center justify-center gap-2" data-pet-id="${pet.id}" data-pet-name="${pet.name}">
          <span class="material-symbols-outlined text-[18px]">pets</span>
          Conoce a ${pet.name}
        </button>
      </div>
    </div>`;
}

export function render() {
  return `
<!-- Modal for Publishing Pet -->
<div id="publish-pet-modal" class="fixed inset-0 z-[200] hidden items-center justify-center">
  <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="publish-modal-overlay"></div>
  <div class="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 z-10 max-h-[90vh] overflow-y-auto">
    <div class="flex justify-between items-center mb-6">
      <h2 class="font-headline-md text-on-surface">Publicar Mascota</h2>
      <button id="publish-modal-close" class="p-2 rounded-full hover:bg-surface-container-high transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant">close</span>
      </button>
    </div>
    <form id="publish-pet-form" class="space-y-4">
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Nombre</label>
        <input id="pub-name" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" required />
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block font-label-sm text-on-surface-variant mb-1">Especie</label>
          <select id="pub-species" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" required>
            <option value="Perro">Perro</option>
            <option value="Gato">Gato</option>
            <option value="Otro">Otro</option>
          </select>
        </div>
        <div>
          <label class="block font-label-sm text-on-surface-variant mb-1">Raza</label>
          <input id="pub-breed" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" />
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block font-label-sm text-on-surface-variant mb-1">Edad</label>
          <input id="pub-age" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" placeholder="Ej: 2 Años" required />
        </div>
        <div>
          <label class="block font-label-sm text-on-surface-variant mb-1">Tamaño</label>
          <select id="pub-size" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" required>
            <option value="Pequeño">Pequeño</option>
            <option value="Mediano">Mediano</option>
            <option value="Grande">Grande</option>
            <option value="Extra Grande">Extra Grande</option>
          </select>
        </div>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Ubicación</label>
        <input id="pub-location" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" required />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label class="block font-label-sm text-on-surface-variant mb-1">Estado de salud</label>
          <select id="pub-health" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all">
            ${Object.entries(ESTADOS_SALUD).map(([v, e]) => `<option value="${v}">${e.label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="block font-label-sm text-on-surface-variant mb-1">Nota (opcional)</label>
          <input id="pub-health-note" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" placeholder="Ej: castrado el 15/9, reposo 2 semanas" />
        </div>
      </div>
      <div class="flex flex-col">
        <label class="block font-label-sm text-on-surface-variant mb-1">Foto de la Mascota</label>
        <div id="pub-img-container" class="relative group border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-4 transition-all bg-surface-container-lowest flex flex-col items-center justify-center cursor-pointer min-h-[96px]">
          <input id="pub-img-file" type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" required />
          <div id="pub-img-placeholder" class="text-center flex flex-col items-center gap-1">
            <span class="material-symbols-outlined text-stone-400 text-2xl group-hover:text-primary transition-colors">cloud_upload</span>
            <p class="text-[11px] text-stone-500 font-semibold">Subir foto desde la PC</p>
            <p class="text-[9px] text-stone-400">JPG, PNG, WEBP (Máx. 5MB)</p>
          </div>
          <div id="pub-img-preview-container" class="hidden absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-stone-900 z-20">
            <img id="pub-img-preview" class="w-full h-full object-cover opacity-80" />
            <button type="button" id="remove-pub-img-btn" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors flex items-center justify-center z-30">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Descripción</label>
        <textarea id="pub-desc" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none" rows="3"></textarea>
      </div>
      <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-label-lg flex items-center justify-center gap-2 shadow-md hover:scale-[0.98] active:scale-95 transition-all">
        <span class="material-symbols-outlined">add_circle</span>
        Publicar
      </button>
    </form>
  </div>
</div>

<main class="pt-32 pb-20 px-6 md:px-12 max-w-7xl mx-auto">
  <!-- Hero Section & CTA -->
  <header class="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
    <div class="max-w-2xl">
      <h1 class="font-headline-xl text-on-surface mb-4">Encuentra a tu nuevo <span class="text-primary">mejor amigo</span> hoy.</h1>
      <p class="font-body-lg text-on-surface-variant">Explora cientos de mascotas que buscan un hogar amoroso. Usa nuestros filtros para encontrar el compañero perfecto para tu estilo de vida.</p>
    </div>
    <button id="btn-publish-pet" class="flex items-center gap-2 px-6 py-4 bg-primary text-on-primary font-label-lg rounded-xl shadow-lg hover:scale-[0.98] transition-transform duration-150 group">
      <span class="material-symbols-outlined">add_circle</span>
      Publicar mascota en adopción
    </button>
  </header>

  <!-- Search & Filters Container -->
  <section class="bg-surface-container-low rounded-2xl p-6 mb-12 shadow-sm border border-outline-variant/30">
    <div class="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
      <div class="md:col-span-1 lg:col-span-1">
        <label class="block font-label-sm text-on-surface-variant mb-2">Ubicación</label>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">location_on</span>
          <input id="filter-location" class="w-full pl-10 pr-4 py-3 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all" placeholder="Ciudad o Código Postal" type="text" />
        </div>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-2">Especie</label>
        <select id="filter-species" class="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer">
          <option value="">Todas las especies</option>
          <option value="Perro">Perro</option>
          <option value="Gato">Gato</option>
          <option value="Otro">Otro</option>
        </select>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-2">Edad</label>
        <select id="filter-age" class="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer">
          <option value="">Cualquier edad</option>
          <option value="Cachorro">Cachorro</option>
          <option value="Joven">Joven</option>
          <option value="Adulto">Adulto</option>
          <option value="Senior">Senior</option>
        </select>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-2">Tamaño</label>
        <select id="filter-size" class="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer">
          <option value="">Cualquier tamaño</option>
          <option value="Pequeño">Pequeño</option>
          <option value="Mediano">Mediano</option>
          <option value="Grande">Grande</option>
          <option value="Extra Grande">Extra Grande</option>
        </select>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-2">Estado</label>
        <select id="filter-health" class="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer">
          <option value="">Cualquier estado</option>
          ${Object.entries(ESTADOS_SALUD).map(([v, e]) => `<option value="${v}">${e.label}</option>`).join('')}
        </select>
      </div>
      <div class="flex items-end">
        <button id="filter-search-btn" class="w-full py-3 bg-secondary-container text-on-secondary-container font-label-lg rounded-xl hover:bg-secondary hover:text-on-secondary transition-all flex items-center justify-center gap-2">
          <span class="material-symbols-outlined">filter_list</span>
          Buscar Mascotas
        </button>
      </div>
    </div>
  </section>

  <!-- Advanced Filters (collapsible) -->
  <section id="advanced-filters-section" class="mb-8 overflow-hidden transition-all duration-300" style="max-height: 0;">
    <div class="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/30 shadow-sm">
      <h4 class="font-label-lg text-on-surface-variant mb-4 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary text-[18px]">tune</span>
        Filtros de comportamiento
      </h4>
      <div class="flex flex-wrap gap-3">
        <label class="adv-filter-chip flex items-center gap-2 px-4 py-2.5 rounded-full border border-outline-variant bg-surface cursor-pointer hover:border-primary hover:bg-primary-fixed/30 transition-all text-sm font-medium text-on-surface-variant has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:checked]:border-primary">
          <input type="checkbox" class="hidden" data-adv-filter="apartment" />
          <span class="material-symbols-outlined text-[16px]">apartment</span>
          Apto para departamentos
        </label>
        <label class="adv-filter-chip flex items-center gap-2 px-4 py-2.5 rounded-full border border-outline-variant bg-surface cursor-pointer hover:border-primary hover:bg-primary-fixed/30 transition-all text-sm font-medium text-on-surface-variant has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:checked]:border-primary">
          <input type="checkbox" class="hidden" data-adv-filter="kids" />
          <span class="material-symbols-outlined text-[16px]">child_care</span>
          Se lleva bien con niños
        </label>
        <label class="adv-filter-chip flex items-center gap-2 px-4 py-2.5 rounded-full border border-outline-variant bg-surface cursor-pointer hover:border-primary hover:bg-primary-fixed/30 transition-all text-sm font-medium text-on-surface-variant has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:checked]:border-primary">
          <input type="checkbox" class="hidden" data-adv-filter="energy-low" />
          <span class="material-symbols-outlined text-[16px]">self_improvement</span>
          Energía Baja
        </label>
        <label class="adv-filter-chip flex items-center gap-2 px-4 py-2.5 rounded-full border border-outline-variant bg-surface cursor-pointer hover:border-primary hover:bg-primary-fixed/30 transition-all text-sm font-medium text-on-surface-variant has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:checked]:border-primary">
          <input type="checkbox" class="hidden" data-adv-filter="energy-mid" />
          <span class="material-symbols-outlined text-[16px]">directions_walk</span>
          Energía Media
        </label>
        <label class="adv-filter-chip flex items-center gap-2 px-4 py-2.5 rounded-full border border-outline-variant bg-surface cursor-pointer hover:border-primary hover:bg-primary-fixed/30 transition-all text-sm font-medium text-on-surface-variant has-[:checked]:bg-primary has-[:checked]:text-on-primary has-[:checked]:border-primary">
          <input type="checkbox" class="hidden" data-adv-filter="energy-high" />
          <span class="material-symbols-outlined text-[16px]">directions_run</span>
          Energía Alta
        </label>
      </div>
    </div>
  </section>

  <div class="flex justify-end mb-4">
    <button id="toggle-adv-filters" class="flex items-center gap-2 text-sm font-semibold text-primary hover:text-primary-container transition-colors">
      <span class="material-symbols-outlined text-[18px]">tune</span>
      <span id="toggle-adv-text">Mostrar filtros avanzados</span>
      <span class="material-symbols-outlined text-[18px] transition-transform" id="toggle-adv-icon">expand_more</span>
    </button>
  </div>

  <!-- Pet Grid -->
  <div id="pet-grid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
    <!-- Carga de datos desde API... -->
    <div class="col-span-full text-center py-10 text-on-surface-variant">Cargando mascotas...</div>
  </div>

  <!-- No results message -->
  <div id="no-results" class="hidden text-center py-20">
    <span class="material-symbols-outlined text-6xl text-outline-variant mb-4">search_off</span>
    <h3 class="font-headline-md text-on-surface-variant mb-2">No se encontraron mascotas</h3>
    <p class="font-body-md text-outline">Intenta cambiar los filtros de búsqueda.</p>
  </div>
</main>
`;
}

export async function init() {
  const petGrid = document.getElementById('pet-grid');
  const noResults = document.getElementById('no-results');
  
  // Load pets from API
  async function loadPets() {
    try {
      const species = document.getElementById('filter-species').value;
      const size = document.getElementById('filter-size').value;
      // const age = document.getElementById('filter-age').value; // if implemented in backend

      const health = document.getElementById('filter-health').value;

      const filters = { is_adopted: 0 };
      if (species) filters.species = species;
      if (health) filters.health_status = health;
      if (size && size !== '') {
        // extract first word for size mapping if necessary, or just send it
        filters.size = size.split(' ')[0]; 
      }

      const res = await api.getPets(filters);
      if (res.success) {
        const pets = res.data;
        if (pets.length === 0) {
          petGrid.innerHTML = '';
          noResults.classList.remove('hidden');
        } else {
          noResults.classList.add('hidden');
          petGrid.innerHTML = pets.map(p => buildPetCard(p)).join('');
          attachCardEvents();
        }
      }
    } catch (err) {
      petGrid.innerHTML = '<div class="col-span-full text-center py-10 text-error">Error al cargar mascotas.</div>';
    }
  }

  function attachCardEvents() {
    // Favorite buttons
    petGrid.querySelectorAll('.fav-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!api.isLoggedIn()) {
          window.PataMatch.toast('Inicia sesión para guardar favoritos', 'error');
          return;
        }
        const petId = btn.getAttribute('data-pet-id');
        try {
          const res = await api.toggleFavorite(petId);
          if (res.success) {
            const isFav = res.data.is_favorite;
            btn.setAttribute('data-favorited', String(isFav));
            const icon = btn.querySelector('.material-symbols-outlined');
            icon.style.fontVariationSettings = `'FILL' ${isFav ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24`;
            
            if (isFav) {
              btn.classList.remove('text-on-surface-variant');
              btn.classList.add('text-primary');
            } else {
              btn.classList.remove('text-primary');
              btn.classList.add('text-on-surface-variant');
            }
          }
        } catch (err) {
          window.PataMatch.toast('Error al actualizar favorito', 'error');
        }
      });
    });

    // La foto del animal abre su carnet digital — público, no pide sesión
    petGrid.querySelectorAll('.pet-photo').forEach(img => {
      img.addEventListener('click', () => abrirCarnetMascota(img.getAttribute('data-pet-id')));
    });

    // Adopt buttons
    petGrid.querySelectorAll('.adopt-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!api.isLoggedIn()) {
          window.PataMatch.toast('Inicia sesión para adoptar', 'error');
          return;
        }
        const petId = btn.getAttribute('data-pet-id');
        const petName = btn.getAttribute('data-pet-name');
        try {
          await api.adoptPet(petId);
          window.PataMatch.toast(`¡Solicitud enviada para ${petName}!`, 'success');
        } catch (err) {
          window.PataMatch.toast('Error al enviar solicitud', 'error');
        }
      });
    });
  }

  // Filters
  document.getElementById('filter-search-btn')?.addEventListener('click', loadPets);
  document.getElementById('filter-species')?.addEventListener('change', loadPets);
  document.getElementById('filter-size')?.addEventListener('change', loadPets);
  document.getElementById('filter-health')?.addEventListener('change', loadPets);

  // Advanced filters toggle
  const advSection = document.getElementById('advanced-filters-section');
  const advToggle = document.getElementById('toggle-adv-filters');
  const advText = document.getElementById('toggle-adv-text');
  const advIcon = document.getElementById('toggle-adv-icon');
  let advOpen = false;

  advToggle?.addEventListener('click', () => {
    advOpen = !advOpen;
    if (advOpen) {
      advSection.style.maxHeight = advSection.scrollHeight + 'px';
      advText.textContent = 'Ocultar filtros avanzados';
      advIcon.style.transform = 'rotate(180deg)';
    } else {
      advSection.style.maxHeight = '0';
      advText.textContent = 'Mostrar filtros avanzados';
      advIcon.style.transform = 'rotate(0)';
    }
  });

  // Publish Modal
  const publishBtn = document.getElementById('btn-publish-pet');
  const modal = document.getElementById('publish-pet-modal');
  const closeBtn = document.getElementById('publish-modal-close');
  const overlay = document.getElementById('publish-modal-overlay');
  const form = document.getElementById('publish-pet-form');

  function openModal() {
    if (!api.isLoggedIn()) {
      window.PataMatch.toast('Debes iniciar sesión para publicar', 'error');
      return;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  // --- Local Image Upload & Preview ---
  let pubImageBase64 = '';
  const fileInput = document.getElementById('pub-img-file');
  const previewContainer = document.getElementById('pub-img-preview-container');
  const previewImg = document.getElementById('pub-img-preview');
  const placeholder = document.getElementById('pub-img-placeholder');
  const removeBtn = document.getElementById('remove-pub-img-btn');

  fileInput?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        window.PataMatch.toast('La imagen no debe superar los 5MB', 'error');
        fileInput.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        pubImageBase64 = event.target.result;
        previewImg.src = pubImageBase64;
        previewContainer.classList.remove('hidden');
        placeholder.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    pubImageBase64 = '';
    fileInput.value = '';
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  });

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    form.reset();
    pubImageBase64 = '';
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }

  publishBtn?.addEventListener('click', openModal);
  closeBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', closeModal);

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!pubImageBase64) {
      window.PataMatch.toast('Por favor, selecciona una foto de la mascota', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';

    const petData = {
      name: document.getElementById('pub-name').value,
      species: document.getElementById('pub-species').value,
      breed: document.getElementById('pub-breed').value,
      age: document.getElementById('pub-age').value,
      size: document.getElementById('pub-size').value,
      location: document.getElementById('pub-location').value,
      image_url: pubImageBase64,
      description: document.getElementById('pub-desc').value,
      health_status: document.getElementById('pub-health').value,
      health_note: document.getElementById('pub-health-note').value,
      badge: 'Nuevo',
      badge_color: 'secondary'
    };

    try {
      const res = await api.createPet(petData);
      if (res.success) {
        window.PataMatch.toast('¡Mascota publicada exitosamente!', 'success');
        closeModal();
        loadPets(); // reload grid
        // El carnet se carga desde el panel; se le avisa para que no quede sin datos médicos.
        setTimeout(() => window.PataMatch.toast('Cargá su carnet digital desde tu Panel de Gestión', 'info'), 1200);
      }
    } catch (err) {
      window.PataMatch.toast(err.message || 'Error al publicar mascota', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Publicar';
    }
  });

  // Initial load
  loadPets();
}
