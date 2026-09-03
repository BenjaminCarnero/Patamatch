import * as api from '../api.js?v=4';

function buildSidebarCard(pet) {
  const badgeHtml = pet.badge
    ? `<span class="bg-error-container text-error px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">${pet.badge}</span>`
    : '';

  return `
    <div class="lost-pet-card bg-surface rounded-2xl p-3 border border-outline-variant shadow-sm hover:shadow-md transition-shadow cursor-pointer group" data-pet-id="${pet.id}">
      <div class="flex gap-4">
        <img class="w-24 h-24 rounded-xl object-cover" src="${pet.image_url || 'https://via.placeholder.com/150'}" alt="${pet.name}" />
        <div class="flex-1">
          <div class="flex justify-between items-start">
            <h3 class="font-label-lg text-on-surface">${pet.name}</h3>
            ${badgeHtml}
          </div>
          <p class="text-label-sm text-outline mb-2">${pet.breed}</p>
          <div class="flex items-center gap-1 text-label-sm text-secondary">
            <span class="material-symbols-outlined text-sm">location_on</span>
            <span>${pet.location}</span>
          </div>
          <p class="text-[11px] text-outline mt-2 italic">${pet.last_seen || 'Reportado recientemente'}</p>
        </div>
      </div>
    </div>`;
}

function buildMarkerHtml(pet) {
  // Determine urgency colors based on badge
  const isUrgent = pet.badge === 'Urgente';
  const size = isUrgent ? 'w-14 h-14' : 'w-12 h-12';
  // Urgency-based border: Red = lost today/urgent, Yellow = seen days ago, Default = neutral
  let borderColor = 'border-stone-300'; // default
  let ringClass = '';
  if (isUrgent) {
    borderColor = 'border-red-500';
    ringClass = 'ring-4 ring-red-500/20';
  } else if (pet.last_seen && (pet.last_seen.includes('hoy') || pet.last_seen.includes('hora'))) {
    borderColor = 'border-red-400';
    ringClass = 'ring-2 ring-red-400/20';
  } else {
    borderColor = 'border-amber-400';
    ringClass = 'ring-2 ring-amber-400/20';
  }

  const markerImg = pet.marker_image || pet.image_url || 'https://via.placeholder.com/150';
  const markerLabel = `${pet.name} • ${pet.breed}`;

  // Species icon overlay
  const speciesIcon = (pet.breed || '').toLowerCase().includes('gato') || (pet.species || '').toLowerCase() === 'gato'
    ? 'pets' : 'sound_detection_dog_barking';

  return `
    <div class="map-marker group cursor-pointer relative" data-marker-id="${pet.id}">
      <div class="relative">
        <div class="${size} rounded-full border-[3px] ${borderColor} shadow-xl overflow-hidden ${ringClass} bg-white">
          <img class="w-full h-full object-cover" src="${markerImg}" alt="${pet.name}" />
        </div>
        <div class="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-md border ${borderColor}">
          <span class="material-symbols-outlined text-[12px] ${isUrgent ? 'text-red-500' : 'text-amber-500'}" style="font-variation-settings: 'FILL' 1;">${speciesIcon}</span>
        </div>
      </div>
      <div class="absolute top-full left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface px-3 py-1 rounded-lg shadow-xl whitespace-nowrap border border-outline-variant z-50">
        <p class="font-label-lg">${markerLabel}</p>
      </div>
    </div>`;
}

export function render() {
  return `
<!-- Report Modal -->
<div id="report-modal" class="fixed inset-0 z-[200] hidden items-center justify-center">
  <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" id="report-modal-overlay"></div>
  <div class="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-8 z-10 max-h-[90vh] overflow-y-auto">
    <div class="flex justify-between items-center mb-6">
      <h2 class="font-headline-md text-on-surface">Reportar Mascota Perdida</h2>
      <button id="report-modal-close" class="p-2 rounded-full hover:bg-surface-container-high transition-colors">
        <span class="material-symbols-outlined text-on-surface-variant">close</span>
      </button>
    </div>
    <form id="report-form" class="space-y-4">
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Nombre de la mascota</label>
        <input id="report-name" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" placeholder="Ej: Max" required />
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Raza / Especie</label>
        <input id="report-breed" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" placeholder="Ej: Golden Retriever" required />
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Última ubicación conocida</label>
        <div class="flex gap-2">
          <input id="report-location" class="flex-1 px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all" type="text" placeholder="Ej: Parque Central, Zona 10" required />
          <button id="select-map-btn" class="bg-surface-variant text-on-surface p-3 rounded-xl hover:bg-surface-container-low transition-colors border border-outline-variant flex items-center justify-center" title="Seleccionar en el mapa">
            <span class="material-symbols-outlined">map</span>
          </button>
        </div>
      </div>
      <div class="flex flex-col">
        <label class="block font-label-sm text-on-surface-variant mb-1">Foto de la Mascota</label>
        <div id="report-img-container" class="relative group border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-4 transition-all bg-surface-container-lowest flex flex-col items-center justify-center cursor-pointer min-h-[96px]">
          <input id="report-img-file" type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" required />
          <div id="report-img-placeholder" class="text-center flex flex-col items-center gap-1">
            <span class="material-symbols-outlined text-stone-400 text-2xl group-hover:text-primary transition-colors">cloud_upload</span>
            <p class="text-[11px] text-stone-500 font-semibold">Subir foto desde la PC</p>
            <p class="text-[9px] text-stone-400">JPG, PNG, WEBP (Máx. 5MB)</p>
          </div>
          <div id="report-img-preview-container" class="hidden absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-stone-900 z-20">
            <img id="report-img-preview" class="w-full h-full object-cover opacity-80" />
            <button type="button" id="remove-report-img-btn" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors flex items-center justify-center z-30">
              <span class="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        </div>
      </div>
      <div>
        <label class="block font-label-sm text-on-surface-variant mb-1">Descripción</label>
        <textarea id="report-desc" class="w-full px-4 py-3 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary transition-all resize-none" rows="3" placeholder="Color, tamaño, collar, chip, etc."></textarea>
      </div>
      <button type="submit" class="w-full bg-primary text-white py-4 rounded-xl font-label-lg flex items-center justify-center gap-2 shadow-md hover:scale-[0.98] active:scale-95 transition-all">
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1, 'wght' 400;">add_circle</span>
        Publicar Reporte
      </button>
    </form>
    <!-- Success message (hidden by default) -->
    <div id="report-success" class="hidden text-center py-8">
      <span class="material-symbols-outlined text-5xl text-secondary mb-4" style="font-variation-settings: 'FILL' 1, 'wght' 400;">check_circle</span>
      <h3 class="font-headline-md text-on-surface mb-2">¡Reporte enviado!</h3>
      <p class="font-body-md text-on-surface-variant">Tu reporte ha sido publicado. Te notificaremos si alguien tiene información.</p>
    </div>
  </div>
</div>

<style>
  .map-gradient-overlay {
    background: linear-gradient(to bottom, rgba(255, 248, 244, 0.9) 0%, rgba(255, 248, 244, 0) 20%);
  }
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #ddc0b8; border-radius: 10px; }
  .lost-pet-card.active { border-color: #9c3e20; box-shadow: 0 0 0 2px rgba(156, 62, 32, 0.2); }
  .map-marker.active .ring-primary\\/20 { box-shadow: 0 0 0 8px rgba(156, 62, 32, 0.3); }
  .map-marker.active > div > div:first-child { border-color: #9c3e20; }
</style>

<main class="h-[calc(100vh-80px)] flex flex-col md:flex-row overflow-hidden">
  <!-- Sidebar -->
  <aside class="w-full md:w-96 bg-surface-container-low border-r border-outline-variant flex flex-col z-10">
    <div class="p-6 space-y-4 shadow-sm bg-surface">
      <div class="flex justify-between items-center">
        <h1 class="font-headline-md text-on-surface">Reportes Activos</h1>
        <span id="active-reports-badge" class="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-label-sm">0 Encontrados</span>
      </div>
      <div class="relative">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline">search</span>
        <input id="lost-pet-search" class="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant bg-surface focus:border-primary focus:ring-2 focus:ring-primary-fixed-dim transition-all outline-none text-body-md" placeholder="Buscar por raza o zona..." type="text" />
      </div>
      <button id="report-btn" class="w-full bg-primary text-white py-4 rounded-xl font-label-lg flex items-center justify-center gap-2 shadow-md hover:scale-[0.98] active:scale-95 transition-all">
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1, 'wght' 400;">add_circle</span>
        Reportar Mascota Perdida
      </button>
    </div>
    <div id="lost-pet-list" class="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
      <div class="text-center py-10 text-on-surface-variant">Cargando reportes...</div>
    </div>
  </aside>

  <!-- Map Section -->
  <section class="flex-1 relative bg-surface-container-highest overflow-hidden">
    <!-- Leaflet map container -->
    <div id="leaflet-map-container" class="absolute inset-0 z-0"></div>
    <div class="absolute inset-0 map-gradient-overlay pointer-events-none z-10"></div>

    <!-- Live update banner -->
    <div class="absolute top-6 left-1/2 -translate-x-1/2 flex gap-2 z-20 pointer-events-none">
      <div class="bg-surface/90 backdrop-blur-md px-4 py-2 rounded-full border border-outline-variant shadow-lg flex items-center gap-2">
        <span class="w-3 h-3 rounded-full bg-primary animate-pulse"></span>
        <span id="live-update-text" class="text-label-sm text-on-surface">Actualizaciones en vivo...</span>
      </div>
    </div>

    <!-- Instructions banner -->
    <div id="map-instructions" class="hidden absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
      <div class="bg-primary text-white px-6 py-3 rounded-full shadow-lg font-label-lg flex items-center gap-2">
        <span class="material-symbols-outlined">touch_app</span> Haz clic en el mapa para ubicar a la mascota
      </div>
    </div>

    <!-- Mobile report button -->
    <div class="absolute bottom-10 left-1/2 -translate-x-1/2 md:hidden z-20">
      <button id="report-btn-mobile" class="bg-primary text-white px-8 py-4 rounded-full font-label-lg shadow-2xl flex items-center gap-2 animate-bounce">
        <span class="material-symbols-outlined">report_gmailerrorred</span>
        Reportar Mascota Perdida
      </button>
    </div>
  </section>
</main>
`;
}

export async function init() {
  const petList = document.getElementById('lost-pet-list');
  const badge = document.getElementById('active-reports-badge');
  const updateText = document.getElementById('live-update-text');
  const mapInstructions = document.getElementById('map-instructions');

  // Dynamically load Leaflet and MarkerCluster if not present
  if (!window.L) {
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

  // Load MarkerCluster plugin
  if (!window.L.MarkerClusterGroup) {
    await new Promise((resolve) => {
      const mcCSS = document.createElement('link');
      mcCSS.rel = 'stylesheet';
      mcCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
      document.head.appendChild(mcCSS);

      const mcDefaultCSS = document.createElement('link');
      mcDefaultCSS.rel = 'stylesheet';
      mcDefaultCSS.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css';
      document.head.appendChild(mcDefaultCSS);

      // Custom cluster styles
      const clusterStyle = document.createElement('style');
      clusterStyle.textContent = `
        .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
          background: rgba(156, 62, 32, 0.15) !important;
        }
        .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
          background: #9c3e20 !important;
          color: white !important;
          font-weight: 700 !important;
          font-family: 'Plus Jakarta Sans', sans-serif !important;
        }
      `;
      document.head.appendChild(clusterStyle);

      const mcScript = document.createElement('script');
      mcScript.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
      mcScript.onload = resolve;
      document.head.appendChild(mcScript);
    });
  }

  let leafletMap = null;
  let leafletMarkers = {};
  let markerClusterGroup = null;
  let tempMarker = null;
  let selectedLat = null;
  let selectedLng = null;
  let activeId = null;

  // Initialize Leaflet Map
  leafletMap = L.map('leaflet-map-container', { zoomControl: false }).setView([19.4326, -99.1332], 13);
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom'
  }).addTo(leafletMap);
  L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

  // Create cluster group
  markerClusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    zoomToBoundsOnClick: true
  });
  leafletMap.addLayer(markerClusterGroup);

  // Fix for SPA: invalidate size after the container has been rendered to the screen
  setTimeout(() => {
    leafletMap.invalidateSize();
  }, 100);

  async function loadLostPets() {
    try {
      const res = await api.getLostPets();
      if (res.success) {
        const pets = res.data;
        badge.textContent = `${pets.length} Encontrados`;
        updateText.textContent = `${pets.length} reportes activos en tu zona`;
        
        petList.innerHTML = pets.map(p => buildSidebarCard(p)).join('');
        
        // Clear existing markers
        markerClusterGroup.clearLayers();
        leafletMarkers = {};

        pets.forEach(pet => {
          let lat = parseFloat(pet.marker_top);
          let lng = parseFloat(pet.marker_left);
          if (isNaN(lat) || isNaN(lng)) {
            lat = 19.4326 + (Math.random() - 0.5) * 0.05;
            lng = -99.1332 + (Math.random() - 0.5) * 0.05;
          }

          const icon = L.divIcon({
            className: 'custom-leaflet-icon',
            html: buildMarkerHtml(pet),
            iconSize: [48, 48],
            iconAnchor: [24, 24]
          });

          const m = L.marker([lat, lng], { icon });
          m.on('click', () => setActivePet(pet.id.toString()));
          markerClusterGroup.addLayer(m);
          leafletMarkers[pet.id] = m;
        });
        
        attachEvents();
      }
    } catch (err) {
      petList.innerHTML = '<div class="text-center py-10 text-error">Error al cargar reportes.</div>';
    }
  }

  function setActivePet(petId) {
    document.querySelectorAll('.lost-pet-card').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.map-marker').forEach(m => m.classList.remove('active'));

    if (activeId === petId) {
      activeId = null;
      return;
    }
    activeId = petId;

    const card = document.querySelector(`.lost-pet-card[data-pet-id="${petId}"]`);
    if (card) {
      card.classList.add('active');
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const marker = leafletMarkers[petId];
    if (marker) {
      leafletMap.setView(marker.getLatLng(), 15, { animate: true });
      const el = marker.getElement().querySelector('.map-marker');
      if (el) {
        el.classList.add('active');
        const tooltip = el.querySelector('div > div:last-child');
        if (tooltip) {
          tooltip.classList.remove('opacity-0');
          tooltip.classList.add('opacity-100');
          setTimeout(() => {
            tooltip.classList.remove('opacity-100');
            tooltip.classList.add('opacity-0');
          }, 3000);
        }
      }
    }
  }

  function attachEvents() {
    petList.addEventListener('click', (e) => {
      const card = e.target.closest('.lost-pet-card');
      if (card) {
        setActivePet(card.getAttribute('data-pet-id'));
      }
    });
  }

  // Handle map click for reporting
  leafletMap.on('click', (e) => {
    if (document.getElementById('report-modal').classList.contains('hidden') && mapInstructions.classList.contains('hidden')) {
      return; // Do nothing if not in "select location" mode
    }

    selectedLat = e.latlng.lat;
    selectedLng = e.latlng.lng;
    
    if (tempMarker) leafletMap.removeLayer(tempMarker);
    
    tempMarker = L.marker([selectedLat, selectedLng], {
      icon: L.divIcon({
        className: 'custom-leaflet-icon',
        html: `<div class="w-10 h-10 rounded-full border-4 border-white bg-primary shadow-xl flex items-center justify-center text-white"><span class="material-symbols-outlined text-[20px]">pets</span></div>`,
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      })
    }).addTo(leafletMap);

    if (!mapInstructions.classList.contains('hidden')) {
      mapInstructions.classList.add('hidden');
      document.getElementById('report-modal').classList.remove('hidden');
      document.getElementById('report-modal').classList.add('flex');
    }
  });

  // --- Search filter ---
  const searchInput = document.getElementById('lost-pet-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const query = searchInput.value.toLowerCase().trim();
      const cards = petList.querySelectorAll('.lost-pet-card');
      cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  document.getElementById('select-map-btn')?.addEventListener('click', (e) => {
    e.preventDefault();
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    mapInstructions.classList.remove('hidden');
  });

  // --- Report Modal ---
  const modal = document.getElementById('report-modal');
  const reportForm = document.getElementById('report-form');
  const reportSuccess = document.getElementById('report-success');

  function openModal() {
    if (!api.isLoggedIn()) {
      window.PataMatch.toast('Debes iniciar sesión para reportar una mascota', 'error');
      return;
    }
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    reportForm.classList.remove('hidden');
    reportSuccess.classList.add('hidden');
  }

  // --- Local Image Upload & Preview ---
  let reportImageBase64 = '';
  const fileInput = document.getElementById('report-img-file');
  const previewContainer = document.getElementById('report-img-preview-container');
  const previewImg = document.getElementById('report-img-preview');
  const placeholder = document.getElementById('report-img-placeholder');
  const removeBtn = document.getElementById('remove-report-img-btn');

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
        reportImageBase64 = event.target.result;
        previewImg.src = reportImageBase64;
        previewContainer.classList.remove('hidden');
        placeholder.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    reportImageBase64 = '';
    fileInput.value = '';
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  });

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    reportForm.reset();
    reportImageBase64 = '';
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  }

  document.getElementById('report-btn')?.addEventListener('click', openModal);
  document.getElementById('report-btn-mobile')?.addEventListener('click', openModal);
  document.getElementById('report-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('report-modal-overlay')?.addEventListener('click', closeModal);

  // Form submission via API
  reportForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!reportImageBase64) {
      window.PataMatch.toast('Por favor, selecciona una foto de la mascota', 'error');
      return;
    }

    const submitBtn = reportForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Enviando...';

    const data = {
      name: document.getElementById('report-name').value,
      breed: document.getElementById('report-breed').value,
      location: document.getElementById('report-location').value,
      image_url: reportImageBase64,
      description: document.getElementById('report-desc').value,
      lat: selectedLat ? selectedLat.toString() : leafletMap.getCenter().lat.toString(),
      lng: selectedLng ? selectedLng.toString() : leafletMap.getCenter().lng.toString()
    };

    try {
      const res = await api.reportLostPet(data);
      if (res.success) {
        reportForm.classList.add('hidden');
        reportSuccess.classList.remove('hidden');
        loadLostPets(); // Refresh the list
        setTimeout(closeModal, 2500);
      }
    } catch (err) {
      window.PataMatch.toast(err.message || 'Error al enviar reporte', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span class="material-symbols-outlined">add_circle</span> Publicar Reporte';
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
      closeModal();
    }
  });

  // Load data on init
  loadLostPets();
}
