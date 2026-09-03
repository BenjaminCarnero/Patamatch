export function render() {
  return `
<!-- Hero Section -->
<section class="relative overflow-hidden bg-surface-container-low py-16 lg:py-24">
  <div class="max-w-7xl mx-auto px-6 md:px-12 grid lg:grid-cols-2 gap-12 items-center">
    <div class="relative z-10">
      <!-- PataMatch Logo & Paws Trail -->
      <div class="flex items-center gap-3 mb-4 select-none">
        <div class="flex items-center gap-1.5 text-3xl font-black text-[#D96C4A] tracking-tighter">
          <span class="material-symbols-outlined text-3xl transform -rotate-12 text-[#D96C4A]" style="font-variation-settings: 'FILL' 1;">pets</span>
          <span>PataMatch</span>
        </div>
        <!-- Little paws trail -->
        <div class="flex items-center gap-1 opacity-30">
          <span class="material-symbols-outlined text-sm transform rotate-12 text-[#D96C4A]" style="font-variation-settings: 'FILL' 1;">pets</span>
          <span class="material-symbols-outlined text-xs transform -rotate-12 text-[#D96C4A]" style="font-variation-settings: 'FILL' 1;">pets</span>
        </div>
      </div>
      <span class="inline-flex items-center gap-2 px-3 py-1 bg-secondary-container text-secondary text-label-lg rounded-full mb-6">
        <span class="material-symbols-outlined text-[18px]">favorite</span>
        Más de 2,000 mascotas adoptadas
      </span>
      <h1 class="font-headline-xl text-on-surface mb-6">Donde cada pata encuentra su hogar</h1>
      <p class="text-body-lg text-on-surface-variant mb-10 max-w-xl">
        Unimos corazones y huellas. Ya sea que estés buscando a tu nuevo mejor amigo o necesites ayuda para encontrar a un compañero perdido, nuestra comunidad está aquí para apoyarte.
      </p>
      <div class="flex flex-wrap gap-4">
        <button data-navigate="adoptar" class="bg-primary text-on-primary px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg active:scale-[0.98] transition-all hover:shadow-xl">
          <span class="material-symbols-outlined">pets</span>
          Quiero adoptar
        </button>
        <button data-navigate="mascotas-perdidas" class="bg-transparent text-primary px-8 py-4 rounded-xl font-bold border-2 border-primary/40 flex items-center gap-2 active:scale-[0.98] transition-all hover:bg-primary/5 hover:border-primary/60">
          <span class="material-symbols-outlined">notification_important</span>
          Reportar mascota perdida
        </button>
      </div>
    </div>
    <div class="relative">
      <div class="absolute -top-12 -right-12 w-64 h-64 bg-primary-fixed-dim rounded-full blur-3xl opacity-20"></div>
      <div class="absolute -bottom-12 -left-12 w-64 h-64 bg-secondary-fixed rounded-full blur-3xl opacity-20"></div>
      <div class="relative rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white">
        <img class="w-full h-[500px] object-cover" alt="Un golden retriever y un gato naranja sentados juntos en un hogar cálido" src="https://images.unsplash.com/photo-1718885433034-908d5bca08cf?w=1200&q=80&auto=format&fit=crop"/>
        <div id="hero-notification" class="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-white/20 opacity-0 translate-y-4 transition-all duration-700">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full bg-secondary-container flex items-center justify-center">
              <span class="material-symbols-outlined text-secondary">check_circle</span>
            </div>
            <div>
              <p class="text-xs font-bold text-on-surface">Luna encontró hogar</p>
              <p class="text-[10px] text-on-surface-variant">Adoptada hace 2 horas</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Lost Pet Alerts: Bento Grid Layout -->
<section class="py-xl bg-stone-100/60 border-y border-stone-200/40">
  <div class="max-w-7xl mx-auto px-6 md:px-12">
  <div class="flex items-end justify-between mb-10">
    <div>
      <h2 class="font-headline-lg text-on-surface">Alertas Recientes</h2>
      <p class="text-body-md text-on-surface-variant">Ayúdanos a traerlos de vuelta a casa</p>
    </div>
    <button data-navigate="mascotas-perdidas" class="text-primary font-bold flex items-center gap-1 hover:gap-2 transition-all">
      Ver todos <span class="material-symbols-outlined">arrow_forward</span>
    </button>
  </div>
  <div class="grid grid-cols-1 md:grid-cols-4 gap-gutter h-auto md:h-[600px]">
    <!-- Large Card -->
    <div class="md:col-span-2 md:row-span-2 relative group overflow-hidden rounded-2xl shadow-md bg-white border border-stone-100">
      <img class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Caniche marrón en un parque" src="https://images.unsplash.com/photo-1765739001803-9bc520b5b7ba?w=800&q=80&auto=format&fit=crop"/>
      <div class="absolute top-4 left-4 bg-error text-white px-3 py-1 rounded-full text-label-sm font-bold flex items-center gap-1 shadow-lg">
        <span class="material-symbols-outlined text-sm">emergency</span> URGENTE
      </div>
      <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
      <div class="absolute bottom-0 left-0 p-8 w-full text-white">
        <h3 class="text-2xl font-bold mb-2">Max (Caniche)</h3>
        <p class="flex items-center gap-2 opacity-90 mb-4">
          <span class="material-symbols-outlined">location_on</span>
          Visto por última vez en Condesa, CDMX
        </p>
        <button class="bg-white text-on-background px-6 py-2 rounded-lg font-bold text-sm">Contactar Dueño</button>
      </div>
    </div>
    <!-- Secondary Cards -->
    <div class="md:col-span-1 relative group overflow-hidden rounded-2xl shadow-md bg-white border border-stone-100">
      <img class="w-full h-48 object-cover" alt="Gato tuxedo blanco y negro" src="https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=800&q=80&auto=format&fit=crop"/>
      <div class="p-4">
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-bold text-on-surface">Mimi</h4>
          <span class="text-[10px] uppercase tracking-widest text-primary font-black">Perdido</span>
        </div>
        <p class="text-xs text-on-surface-variant flex items-center gap-1 mb-4">
          <span class="material-symbols-outlined text-sm">schedule</span> Hace 5 horas
        </p>
        <button class="w-full border border-outline-variant py-2 rounded-lg text-xs font-bold hover:bg-stone-50 transition-colors">Detalles</button>
      </div>
    </div>
    <div class="md:col-span-1 relative group overflow-hidden rounded-2xl shadow-md bg-white border border-stone-100">
      <img class="w-full h-48 object-cover" alt="Pequeño cachorro beagle" src="https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=800&q=80&auto=format&fit=crop"/>
      <div class="p-4">
        <div class="flex justify-between items-start mb-2">
          <h4 class="font-bold text-on-surface">Toby</h4>
          <span class="text-[10px] uppercase tracking-widest text-primary font-black">Perdido</span>
        </div>
        <p class="text-xs text-on-surface-variant flex items-center gap-1 mb-4">
          <span class="material-symbols-outlined text-sm">schedule</span> Hace 1 día
        </p>
        <button class="w-full border border-outline-variant py-2 rounded-lg text-xs font-bold hover:bg-stone-50 transition-colors">Detalles</button>
      </div>
    </div>
    <!-- Green CTA Card -->
    <div class="md:col-span-2 bg-secondary-container/30 border border-secondary-container rounded-2xl p-6 flex flex-col justify-center">
      <div class="flex items-center gap-4 mb-4">
        <div class="bg-secondary p-3 rounded-full">
          <span class="material-symbols-outlined text-white">volunteer_activism</span>
        </div>
        <div>
          <h4 class="font-headline-md text-secondary">¿Encontraste a alguien?</h4>
          <p class="text-body-md text-on-secondary-fixed-variant">Reportar es el primer paso para un reencuentro.</p>
        </div>
      </div>
      <button data-navigate="mascotas-perdidas" class="bg-secondary text-on-secondary w-fit px-8 py-3 rounded-xl font-bold shadow-md">Publicar Alerta</button>
    </div>
  </div>
  </div>
</section>

<!-- Recent Adoptions: Happy Endings -->
<section class="bg-surface-container py-xl">
  <div class="max-w-7xl mx-auto px-6 md:px-12">
    <div class="text-center mb-16">
      <h2 class="font-headline-lg text-on-surface mb-4">Finales Felices</h2>
      <p class="text-body-lg text-on-surface-variant">Ellos ya encontraron a su familia perfecta</p>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
      <!-- Card 1 - Roco -->
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div class="relative">
          <img class="w-full h-56 object-cover group-hover:scale-105 transition-transform" alt="Perro mestizo alegre con pañuelo rojo" src="https://images.unsplash.com/photo-1596490634801-c536934af56e?w=800&q=80&auto=format&fit=crop"/>
          <div class="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full text-primary cursor-pointer heart-toggle" data-pet="roco">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">favorite</span>
          </div>
        </div>
        <div class="p-6">
          <h4 class="font-bold text-on-surface text-lg mb-1">Roco</h4>
          <div class="flex gap-2 mb-4">
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Vacunado</span>
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Apto Niños</span>
          </div>
          <p class="text-sm text-on-surface-variant italic">"Roco se convirtió en la alegría de nuestra casa..."</p>
        </div>
      </div>
      <!-- Card 2 - Luna -->
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div class="relative">
          <img class="w-full h-56 object-cover group-hover:scale-105 transition-transform" alt="Gato atigrado gris relajado" src="https://images.unsplash.com/photo-1559624989-7b9303bd9792?w=800&q=80&auto=format&fit=crop"/>
          <div class="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full text-primary cursor-pointer heart-toggle" data-pet="luna">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">favorite</span>
          </div>
        </div>
        <div class="p-6">
          <h4 class="font-bold text-on-surface text-lg mb-1">Luna</h4>
          <div class="flex gap-2 mb-4">
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Esterilizada</span>
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Tranquila</span>
          </div>
          <p class="text-sm text-on-surface-variant italic">"La compañera perfecta para mis tardes de lectura."</p>
        </div>
      </div>
      <!-- Card 3 - Bruno -->
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div class="relative">
          <img class="w-full h-56 object-cover group-hover:scale-105 transition-transform" alt="Golden retriever feliz corriendo" src="https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?w=800&q=80&auto=format&fit=crop"/>
          <div class="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full text-primary cursor-pointer heart-toggle" data-pet="bruno">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">favorite</span>
          </div>
        </div>
        <div class="p-6">
          <h4 class="font-bold text-on-surface text-lg mb-1">Bruno</h4>
          <div class="flex gap-2 mb-4">
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Activo</span>
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Social</span>
          </div>
          <p class="text-sm text-on-surface-variant italic">"Bruno nos motiva a salir y disfrutar la naturaleza todos los días."</p>
        </div>
      </div>
      <!-- Card 4 - Milo -->
      <div class="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 group">
        <div class="relative">
          <img class="w-full h-56 object-cover group-hover:scale-105 transition-transform" alt="Cachorro salchicha en una cama" src="https://images.unsplash.com/photo-1739016020843-25cf772f4e7b?w=800&q=80&auto=format&fit=crop"/>
          <div class="absolute top-3 right-3 bg-white/90 backdrop-blur p-2 rounded-full text-primary cursor-pointer heart-toggle" data-pet="milo">
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">favorite</span>
          </div>
        </div>
        <div class="p-6">
          <h4 class="font-bold text-on-surface text-lg mb-1">Milo</h4>
          <div class="flex gap-2 mb-4">
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Cachorro</span>
            <span class="bg-secondary-container/50 text-secondary px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Entrenado</span>
          </div>
          <p class="text-sm text-on-surface-variant italic">"El pequeño gran jefe de la casa ahora tiene su cama real."</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Map Section -->
<section class="py-xl max-w-7xl mx-auto px-6 md:px-12">
  <div class="grid lg:grid-cols-3 gap-12 items-center">
    <div class="lg:col-span-1">
      <h2 class="font-headline-lg text-on-surface mb-6">Mapa Interactivo</h2>
      <p class="text-body-md text-on-surface-variant mb-8">
        Visualiza en tiempo real los reportes de mascotas perdidas y avistamientos en tu comunidad. Activa las alertas de proximidad para estar siempre informado.
      </p>
      <ul class="space-y-4">
        <li class="flex items-start gap-4">
          <div class="bg-primary/10 p-2 rounded-lg text-primary">
            <span class="material-symbols-outlined">my_location</span>
          </div>
          <div>
            <p class="font-bold text-sm">Radio de Búsqueda</p>
            <p class="text-xs text-on-surface-variant">Filtra reportes en un radio de hasta 5km.</p>
          </div>
        </li>
        <li class="flex items-start gap-4">
          <div class="bg-secondary/10 p-2 rounded-lg text-secondary">
            <span class="material-symbols-outlined">share_location</span>
          </div>
          <div>
            <p class="font-bold text-sm">Avistamientos</p>
            <p class="text-xs text-on-surface-variant">Reporta dónde viste a una mascota perdida fácilmente.</p>
          </div>
        </li>
      </ul>
    </div>
    <div class="lg:col-span-2 relative">
      <div class="rounded-3xl overflow-hidden border-8 border-white shadow-xl h-[450px]">
        <img class="w-full h-full object-cover" alt="Mapa de vecindario urbano" src="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/export?bbox=-99.19,19.39,-99.13,19.44&bboxSR=4326&size=900,675&format=png&f=image"/>
        <!-- Map Overlays -->
        <div class="absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 group">
          <div class="relative">
            <div class="absolute inset-0 bg-primary rounded-full animate-ping opacity-25"></div>
            <div class="relative bg-primary text-white p-2 rounded-full shadow-lg border-2 border-white cursor-pointer transform hover:scale-110 transition-transform">
              <span class="material-symbols-outlined text-[16px]">pets</span>
            </div>
            <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 bg-white p-2 rounded-xl shadow-xl border border-stone-100 hidden group-hover:block">
              <p class="text-[10px] font-bold text-center">Toby visto aquí</p>
              <p class="text-[8px] text-center text-on-surface-variant">Hace 15 min</p>
            </div>
          </div>
        </div>
        <div class="absolute top-1/3 left-2/3 -translate-x-1/2 -translate-y-1/2 group">
          <div class="relative bg-secondary text-white p-2 rounded-full shadow-lg border-2 border-white cursor-pointer transform hover:scale-110 transition-transform">
            <span class="material-symbols-outlined text-[16px]">home</span>
          </div>
        </div>
        <div class="absolute bottom-6 left-6 right-6 md:right-auto md:w-80 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-white/20">
          <div class="flex items-center gap-4">
            <div class="w-12 h-12 rounded-xl overflow-hidden">
              <img class="w-full h-full object-cover" alt="Miniatura de un perro perdido" src="https://images.unsplash.com/photo-1573828260583-ec780bbe0c1a?w=800&q=80&auto=format&fit=crop"/>
            </div>
            <div class="flex-1">
              <h4 class="text-sm font-bold">Última alerta cerca de ti</h4>
              <p class="text-[10px] text-on-surface-variant">Avistamiento reportado en Calle Génova</p>
            </div>
            <span class="material-symbols-outlined text-primary">chevron_right</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA Section -->
<section class="py-xl">
  <div class="max-w-7xl mx-auto px-6 md:px-12">
    <div class="bg-primary rounded-[2.5rem] p-12 text-center relative overflow-hidden shadow-2xl">
      <!-- Abstract circles for background decoration -->
      <div class="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2"></div>
      <div class="absolute bottom-0 left-0 w-48 h-48 bg-black/5 rounded-full translate-y-1/3 -translate-x-1/3"></div>
      <h2 class="font-headline-xl text-on-primary mb-6 relative z-10">¿Listo para cambiar una vida?</h2>
      <p class="text-on-primary/80 text-body-lg max-w-2xl mx-auto mb-10 relative z-10">
        Cada adopción es un compromiso de amor. Únete a nuestra red de voluntarios y familias para hacer que el mundo sea un lugar mejor para nuestros amigos de cuatro patas.
      </p>
      <div class="flex flex-wrap justify-center gap-6 relative z-10">
        <button data-navigate="comunidad" class="bg-white text-primary px-10 py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all active:scale-[0.98]">Unirse a la Comunidad</button>
        <button data-navigate="historias" class="bg-transparent text-white border-2 border-white/30 px-10 py-4 rounded-xl font-bold text-lg hover:bg-white/10 transition-all active:scale-[0.98]">Saber más</button>
      </div>
    </div>
  </div>
</section>
  `;
}

export function init() {
  // Initialize PataMatch namespace
  window.PataMatch = window.PataMatch || {};
  window.PataMatch.favorites = window.PataMatch.favorites || {};

  // Animate hero notification card
  const notification = document.getElementById('hero-notification');
  if (notification) {
    setTimeout(() => {
      notification.classList.remove('opacity-0', 'translate-y-4');
      notification.classList.add('opacity-100', 'translate-y-0');
    }, 800);
  }

  // Heart toggle functionality
  const hearts = document.querySelectorAll('.heart-toggle');
  hearts.forEach(heart => {
    const petName = heart.dataset.pet;
    const icon = heart.querySelector('.material-symbols-outlined');

    // Initialize from saved state
    const isFav = window.PataMatch.favorites[petName];
    if (isFav === false) {
      icon.style.fontVariationSettings = "'FILL' 0";
      heart.classList.remove('text-primary');
      heart.classList.add('text-stone-400');
    }

    heart.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentFill = icon.style.fontVariationSettings;
      const isFilled = currentFill.includes("'FILL' 1");

      if (isFilled) {
        icon.style.fontVariationSettings = "'FILL' 0";
        heart.classList.remove('text-primary');
        heart.classList.add('text-stone-400');
        window.PataMatch.favorites[petName] = false;
      } else {
        icon.style.fontVariationSettings = "'FILL' 1";
        heart.classList.remove('text-stone-400');
        heart.classList.add('text-primary');
        window.PataMatch.favorites[petName] = true;
      }

      // Quick scale animation
      heart.style.transform = 'scale(1.3)';
      setTimeout(() => {
        heart.style.transform = 'scale(1)';
      }, 200);
    });
  });
}
