import * as api from '../api.js?v=4';

const extendedStories = {
  'Luna': `Después de 400 días en el refugio, Luna finalmente encontró a su familia ideal con los Miller. Su transformación de una perrita callejera tímida a una compañera juguetona es nada menos que milagrosa.
  
  Al principio, Luna pasaba la mayor parte del tiempo escondida debajo de la mesa del comedor, temerosa de cualquier ruido o movimiento brusco. Su nueva familia, con paciencia infinita y mucho cariño, le dio el espacio y el tiempo que necesitaba para sanar. Empezaron ofreciéndole pequeños bocadillos desde lejos, hasta que un día, Luna decidió dar el primer paso y comer directamente de la mano de Sarah Miller.
  
  Hoy en día, Luna es la reina indiscutible del hogar. Le encanta correr por el jardín persiguiendo mariposas, dar paseos matutinos por el parque y acurrucarse en el sofá todas las noches para ver la televisión con su familia. Su historia nos recuerda que, con suficiente paciencia y amor, cualquier mascota puede superar su pasado y brillar con luz propia.`,

  'Oliver': `Oliver fue ignorado durante meses debido a su timidez. Hoy, es el rey de un apartamento tranquilo en la ciudad, brindando consuelo infinito a su nueva dueña, Sarah Johnson.
  
  Oliver es un hermoso Beagle que solía temblar cada vez que alguien se acercaba a su jaula en el refugio. Su timidez hacía que las familias que buscaban cachorros enérgicos pasaran de largo sin notar sus profundos y expresivos ojos marrones. Sin embargo, cuando Sarah entró al refugio buscando un compañero tranquilo y leal para su apartamento, la conexión fue instantánea.
  
  La primera noche en casa, Oliver durmió al lado de la cama de Sarah, como si supiera que finalmente estaba seguro. Con el paso de las semanas, su timidez dio paso a una personalidad dulce y curiosa. Le encanta asomarse por la ventana para ver pasar a la gente y apoyar su cabeza en el regazo de Sarah mientras ella trabaja desde casa. Oliver no solo encontró un hogar, sino que se convirtió en el apoyo emocional perfecto para Sarah, demostrando que a veces, los lazos más fuertes se forjan en el silencio y la tranquilidad.`,

  'Rex': `Rex era un perro de mucha energía que necesitaba un compañero activo. Cuando conoció al corredor de maratones Jake Thompson, fue una combinación perfecta.
  
  Rex, un cruce de Border Collie y Pastor con una vitalidad inagotable, había sido devuelto al refugio dos veces porque sus dueños anteriores no podían seguirle el ritmo. Necesitaba correr kilómetros todos los días, jugar a buscar la pelota durante horas y tener retos mentales constantes. Su destino cambió por completo cuando Jake, un apasionado corredor de largas distancias, llegó a PataMatch buscando un compañero de entrenamiento.
  
  Desde el primer día, Jake y Rex se volvieron inseparables. Ahora corren juntos todas las mañanas al amanecer, recorriendo senderos de montaña y playas. Rex tiene una resistencia increíble y una felicidad radiante cada vez que ve sus arneses de correr. Por las tardes, después de un día de intensa actividad, Rex descansa plácidamente a los pies de Jake, completamente satisfecho y en paz. Esta historia es el ejemplo perfecto de cómo emparejar a la mascota adecuada con el estilo de vida adecuado crea una armonía perfecta y duradera.`
};

function openStoryModal(story) {
  let modal = document.getElementById('story-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'story-detail-modal';
    modal.className = 'fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 transition-all duration-300 opacity-0 pointer-events-none';
    document.body.appendChild(modal);
  }

  const nameKey = story.pet_name;
  const fullText = extendedStories[nameKey] || story.body;
  const paragraphs = fullText.split('\n\n').map(p => `<p class="mb-4 text-stone-600 leading-relaxed text-base">${p}</p>`).join('');

  modal.innerHTML = `
    <div class="bg-white rounded-[2rem] max-w-2xl w-full overflow-hidden shadow-2xl border border-stone-100 transition-all duration-300 scale-95 opacity-0 flex flex-col max-h-[85vh]" id="story-modal-panel">
      <div class="h-64 md:h-80 overflow-hidden relative flex-shrink-0">
        <img alt="${story.title}" class="w-full h-full object-cover" src="${story.image_url || 'https://via.placeholder.com/600x400'}"/>
        <div class="absolute inset-0 bg-gradient-to-t from-stone-900/70 to-transparent"></div>
        <button class="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/20 hover:bg-white/40 text-white transition-colors flex items-center justify-center backdrop-blur-md border border-white/10" id="close-modal-btn">
          <span class="material-symbols-outlined text-[20px]">close</span>
        </button>
        <div class="absolute bottom-6 left-6 pr-6">
          <span class="inline-block bg-primary text-on-primary px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">${story.badge || 'Final Feliz'}</span>
          <h2 class="font-headline-xl text-white mt-3 text-2xl md:text-3xl leading-tight shadow-sm">${story.title}</h2>
        </div>
      </div>
      <div class="p-8 overflow-y-auto custom-scroll flex-grow">
        <div class="flex items-center gap-3 mb-6 pb-4 border-b border-stone-100">
          <div class="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-primary border border-orange-100">
            <span class="material-symbols-outlined text-[20px]">person</span>
          </div>
          <div>
            <p class="text-xs text-stone-400 font-bold uppercase tracking-widest">Escrita por</p>
            <p class="font-semibold text-stone-700">${story.author_name}</p>
          </div>
        </div>
        <div class="prose max-w-none">
          ${paragraphs}
          ${!extendedStories[nameKey] ? `
            <div class="mt-8 pt-6 border-t border-dashed border-stone-200">
              <p class="text-stone-500 italic text-sm text-center">¡Cada historia de éxito nos llena de alegría! En PataMatch seguimos conectando mascotas con hogares llenos de amor. Si tú también quieres cambiar una vida, visita nuestra sección de adopción.</p>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;

  requestAnimationFrame(() => {
    modal.classList.remove('pointer-events-none', 'opacity-0');
    modal.classList.add('opacity-100');
    const panel = document.getElementById('story-modal-panel');
    panel.classList.remove('scale-95', 'opacity-0');
    panel.classList.add('scale-100', 'opacity-100');
  });

  const closeModal = () => {
    modal.classList.remove('opacity-100');
    modal.classList.add('opacity-0', 'pointer-events-none');
    const panel = document.getElementById('story-modal-panel');
    panel.classList.remove('scale-100', 'opacity-100');
    panel.classList.add('scale-95', 'opacity-0');
  };

  modal.onclick = (e) => {
    if (e.target === modal) closeModal();
  };

  document.getElementById('close-modal-btn').onclick = closeModal;
}

function buildStoryCard(story, index) {
  return `
    <article class="group bg-surface-container-lowest rounded-[1rem] overflow-hidden story-card-shadow border border-surface-variant transition-all hover:-translate-y-1" style="animation: fadeIn 0.5s ease-out both; animation-delay: ${index * 0.15}s;">
      <div class="h-64 overflow-hidden relative">
        <img alt="${story.title}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" src="${story.image_url || 'https://via.placeholder.com/400x300'}"/>
        <div class="absolute top-4 right-4 bg-secondary-container/90 backdrop-blur px-3 py-1 rounded-full flex items-center gap-1">
          <span class="material-symbols-outlined text-[16px] text-on-secondary-container" style="font-variation-settings: 'FILL' 1;">favorite</span>
          <span class="text-label-sm text-on-secondary-container">Final Feliz</span>
        </div>
      </div>
      <div class="p-6 flex flex-col h-[calc(100%-16rem)]">
        <h3 class="font-headline-md text-on-surface mb-3">${story.title}</h3>
        <p class="text-on-surface-variant mb-6 line-clamp-3 flex-grow">${story.body}</p>
        <div class="flex justify-between items-center mt-auto">
          <p class="text-label-sm text-tertiary">Por: ${story.author_name}</p>
          <a class="read-more-btn inline-flex items-center gap-2 text-primary font-label-lg hover:underline transition-all cursor-pointer" data-id="${story.id}">
            Leer Más
            <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
          </a>
        </div>
      </div>
    </article>`;
}

export function render() {
  return `
<main class="max-w-7xl mx-auto px-6 pt-28">
  <!-- Hero Section -->
  <header class="relative overflow-hidden rounded-[2rem] mb-16 bg-surface-container-low min-h-[400px] flex items-center">
    <div class="absolute inset-0 z-0">
      <img alt="Hero background" class="w-full h-full object-cover opacity-20" src="https://images.unsplash.com/photo-1623387641168-d9803ddd3f35?w=1200&q=80&auto=format&fit=crop"/>
    </div>
    <div class="relative z-10 px-8 md:px-16 max-w-2xl">
      <span class="inline-block bg-secondary-container text-on-secondary-container px-4 py-1.5 rounded-full text-label-sm mb-6">Latido de la Comunidad</span>
      <h1 class="font-headline-xl text-on-surface mb-6 leading-tight">Cada Mascota Merece una Segunda Oportunidad</h1>
      <p class="text-body-lg text-on-surface-variant mb-8">Descubre los viajes inspiradores de animales que encontraron sus familias permanentes y las personas cuyas vidas cambiaron para siempre.</p>
      <div class="flex gap-4">
        <button class="bg-primary text-on-primary px-8 py-3 rounded-lg font-label-lg shadow-lg active:scale-95 transition-transform" onclick="document.getElementById('stories-grid').scrollIntoView({behavior: 'smooth'})">Ver Historias</button>
      </div>
    </div>
  </header>

  <!-- Stories Grid -->
  <section class="mb-20">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-10">
      <div>
        <h2 class="font-headline-lg text-on-surface mb-2">Casos de Éxito</h2>
        <p class="text-on-surface-variant">Relatos reales de resiliencia, amor y nuevos comienzos.</p>
      </div>
    </div>
    
    <!-- Filters -->
    <div class="flex flex-wrap gap-3 mb-8" id="story-filters">
      <button class="story-filter-btn px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold transition-all active:scale-95" data-filter-species="all">Todas</button>
      <button class="story-filter-btn px-4 py-2 rounded-full border border-outline-variant text-on-surface-variant text-sm font-semibold hover:border-primary hover:text-primary transition-all active:scale-95" data-filter-species="Perro">
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">sound_detection_dog_barking</span> Perros</span>
      </button>
      <button class="story-filter-btn px-4 py-2 rounded-full border border-outline-variant text-on-surface-variant text-sm font-semibold hover:border-primary hover:text-primary transition-all active:scale-95" data-filter-species="Gato">
        <span class="inline-flex items-center gap-1"><span class="material-symbols-outlined text-[16px]">pets</span> Gatos</span>
      </button>
      <div class="h-8 w-px bg-outline-variant mx-1 hidden md:block"></div>
      <div class="relative">
        <span class="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">location_on</span>
        <input id="story-filter-region" type="text" class="pl-9 pr-4 py-2 rounded-full border border-outline-variant text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all bg-surface w-40" placeholder="Ciudad o región..." />
      </div>
    </div>
    
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter" id="stories-grid">
      <div class="col-span-full text-center py-10 text-on-surface-variant border border-dashed rounded-xl border-outline-variant">Cargando historias...</div>
    </div>
    
    <div class="text-center mt-12">
      <button id="load-more-stories" class="hidden px-8 py-3 rounded-lg border-2 border-primary text-primary font-label-lg hover:bg-primary hover:text-on-primary transition-all active:scale-95">Cargar Más Historias</button>
    </div>
  </section>

  <!-- Share Your Story -->
  <section class="bg-surface-container rounded-[2rem] p-8 md:p-16 mb-20 relative overflow-hidden">
    <div class="absolute right-0 top-0 w-1/3 h-full opacity-10 pointer-events-none hidden lg:block">
      <span class="material-symbols-outlined text-[300px] text-primary rotate-12">pets</span>
    </div>
    <div class="relative z-10 max-w-2xl">
      <h2 class="font-headline-lg text-on-surface mb-4">Comparte tu Historia</h2>
      <p class="text-body-lg text-on-surface-variant mb-8">¿Encontraste a tu mejor amigo a través de PataMatch? Tu viaje podría inspirar a otros a abrir sus corazones y hogares.</p>
      
      <form id="story-form" class="space-y-6">
        <div class="grid grid-cols-1 gap-6">
          <div class="space-y-2">
            <label class="font-label-lg block text-on-surface-variant">Título de tu Historia</label>
            <input id="story-title" class="w-full bg-surface-container-low border-outline rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Ej: La Aventura de Max" type="text" required/>
          </div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="font-label-lg block text-on-surface-variant">Nombre de la Mascota</label>
            <input id="story-pet" class="w-full bg-surface-container-low border-outline rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="Ej: Bella" type="text" required/>
          </div>
          <div class="space-y-2 flex flex-col">
            <label class="font-label-lg block text-on-surface-variant">Foto de la Mascota</label>
            <div id="story-img-container" class="relative group border-2 border-dashed border-outline-variant hover:border-primary rounded-xl p-4 transition-all bg-surface-container-low flex flex-col items-center justify-center cursor-pointer min-h-[96px]">
              <input id="story-img-file" type="file" accept="image/*" class="absolute inset-0 opacity-0 cursor-pointer z-10" required />
              <div id="story-img-placeholder" class="text-center flex flex-col items-center gap-1">
                <span class="material-symbols-outlined text-stone-400 text-2xl group-hover:text-primary transition-colors">cloud_upload</span>
                <p class="text-[11px] text-stone-500 font-semibold">Subir foto desde la PC</p>
                <p class="text-[9px] text-stone-400">JPG, PNG, WEBP (Máx. 5MB)</p>
              </div>
              <div id="story-img-preview-container" class="hidden absolute inset-0 w-full h-full rounded-xl overflow-hidden bg-stone-900 z-20">
                <img id="story-img-preview" class="w-full h-full object-cover opacity-80" />
                <button type="button" id="remove-story-img-btn" class="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors flex items-center justify-center z-30">
                  <span class="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="space-y-2">
          <label class="font-label-lg block text-on-surface-variant">Cuéntanos tu historia</label>
          <textarea id="story-body" class="w-full bg-surface-container-low border-outline rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all" placeholder="¿Cómo se conocieron? ¿Qué es lo que más le gusta hacer? ¿Cómo ha cambiado tu vida desde que llegó a casa? ¿Qué consejo darías a quienes están pensando en adoptar?" rows="4" required></textarea>
        </div>
        <div class="flex flex-col md:flex-row gap-4 items-center">
          <button class="w-full md:w-auto bg-primary text-on-primary px-10 py-3 rounded-lg font-label-lg shadow-md active:scale-95 transition-transform" type="submit">Enviar Historia</button>
        </div>
      </form>

    </div>
  </section>
</main>
<style>
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>`;
}

export async function init() {
  const grid = document.getElementById('stories-grid');
  const loadBtn = document.getElementById('load-more-stories');
  
  let currentOffset = 0;
  const limit = 6;
  let allStories = [];

  async function loadStories() {
    try {
      const res = await api.getStories(limit, currentOffset);
      if (res.success) {
        const stories = res.data;
        if (currentOffset === 0) {
          grid.innerHTML = '';
        }

        if (stories.length === 0 && currentOffset === 0) {
          grid.innerHTML = '<div class="col-span-full text-center py-10 text-on-surface-variant border border-dashed rounded-xl border-outline-variant">Aún no hay historias publicadas.</div>';
          loadBtn.classList.add('hidden');
        } else {
          allStories = [...allStories, ...stories];
          const newHtml = stories.map((s, i) => buildStoryCard(s, i)).join('');
          grid.insertAdjacentHTML('beforeend', newHtml);
          
          if (stories.length < limit) {
            loadBtn.classList.add('hidden');
          } else {
            loadBtn.classList.remove('hidden');
          }
        }
      }
    } catch (err) {
      if (currentOffset === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-10 text-error">Error al cargar historias.</div>';
      }
    }
  }

  loadBtn?.addEventListener('click', () => {
    currentOffset += limit;
    loadStories();
  });

  // Initial load
  loadStories();

  // Handle click on "Leer Más"
  grid?.addEventListener('click', (e) => {
    const btn = e.target.closest('.read-more-btn');
    if (btn) {
      e.preventDefault();
      const storyId = parseInt(btn.getAttribute('data-id'), 10);
      const story = allStories.find(s => s.id === storyId);
      if (story) {
        openStoryModal(story);
      }
    }
  });

  // Species & region filters
  let filterSpecies = 'all';
  let filterRegion = '';

  document.querySelectorAll('.story-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.story-filter-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-on-primary');
        b.classList.add('border', 'border-outline-variant', 'text-on-surface-variant');
      });
      btn.classList.add('bg-primary', 'text-on-primary');
      btn.classList.remove('border', 'border-outline-variant', 'text-on-surface-variant');
      filterSpecies = btn.getAttribute('data-filter-species');
      applyFilters();
    });
  });

  document.getElementById('story-filter-region')?.addEventListener('input', (e) => {
    filterRegion = e.target.value.toLowerCase().trim();
    applyFilters();
  });

  function applyFilters() {
    const cards = grid.querySelectorAll('article');
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      const speciesMatch = filterSpecies === 'all' || text.includes(filterSpecies.toLowerCase());
      const regionMatch = !filterRegion || text.includes(filterRegion);
      card.style.display = speciesMatch && regionMatch ? '' : 'none';
    });
  }

  // --- Local Image Upload & Preview ---
  let storyImageBase64 = '';
  const fileInput = document.getElementById('story-img-file');
  const previewContainer = document.getElementById('story-img-preview-container');
  const previewImg = document.getElementById('story-img-preview');
  const placeholder = document.getElementById('story-img-placeholder');
  const removeBtn = document.getElementById('remove-story-img-btn');

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
        storyImageBase64 = event.target.result;
        previewImg.src = storyImageBase64;
        previewContainer.classList.remove('hidden');
        placeholder.classList.add('hidden');
      };
      reader.readAsDataURL(file);
    }
  });

  removeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    storyImageBase64 = '';
    fileInput.value = '';
    previewImg.src = '';
    previewContainer.classList.add('hidden');
    placeholder.classList.remove('hidden');
  });

  // Drag & Drop support
  const dropZone = document.getElementById('story-img-container');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(evName => {
      dropZone.addEventListener(evName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('border-primary', 'bg-primary-fixed/10');
        dropZone.classList.remove('border-outline-variant');
      });
    });

    ['dragleave', 'drop'].forEach(evName => {
      dropZone.addEventListener(evName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-primary', 'bg-primary-fixed/10');
        dropZone.classList.add('border-outline-variant');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith('image/')) {
        if (file.size > 5 * 1024 * 1024) {
          window.PataMatch.toast('La imagen no debe superar los 5MB', 'error');
          return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
          storyImageBase64 = event.target.result;
          previewImg.src = storyImageBase64;
          previewContainer.classList.remove('hidden');
          placeholder.classList.add('hidden');
        };
        reader.readAsDataURL(file);
      } else {
        window.PataMatch.toast('Solo se permiten archivos de imagen', 'error');
      }
    });
  }

  // Story Form Submission
  const form = document.getElementById('story-form');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!api.isLoggedIn()) {
      window.PataMatch.toast('Debes iniciar sesión para compartir tu historia', 'error');
      return;
    }

    if (!storyImageBase64) {
      window.PataMatch.toast('Por favor, selecciona una foto de tu mascota', 'error');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Enviando...';

    const user = api.getUser();

    const data = {
      title: document.getElementById('story-title').value,
      pet_name: document.getElementById('story-pet').value,
      image_url: storyImageBase64,
      body: document.getElementById('story-body').value,
      author_name: user?.name || 'Anónimo'
    };

    try {
      const res = await api.submitStory(data);
      if (res.success) {
        window.PataMatch.toast('¡Historia enviada! Será revisada y publicada pronto.', 'success');
        form.reset();
        // Reset preview
        storyImageBase64 = '';
        previewImg.src = '';
        previewContainer.classList.add('hidden');
        placeholder.classList.remove('hidden');
      }
    } catch (err) {
      window.PataMatch.toast(err.message || 'Error al enviar historia', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Enviar Historia';
    }
  });
}
