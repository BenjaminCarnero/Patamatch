import * as api from '../api.js?v=4';

function buildCommentHTML(c) {
  const dateObj = new Date(c.created_at);
  const dateStr = isNaN(dateObj) ? c.created_at : dateObj.toLocaleDateString();
  return `
    <div class="flex items-start gap-2.5 text-sm p-3 bg-stone-50 rounded-xl border border-stone-100/50 animate-[fadeIn_0.2s_ease-out]">
      <div class="w-7 h-7 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-xs flex-shrink-0">
        ${c.author_name ? c.author_name[0].toUpperCase() : '?'}
      </div>
      <div class="flex-grow">
        <div class="flex items-center justify-between gap-2 mb-0.5">
          <span class="font-bold text-stone-700 text-xs">${c.author_name}</span>
          <span class="text-[10px] text-stone-400 font-medium">${dateStr}</span>
        </div>
        <p class="text-stone-600 leading-relaxed text-xs">${c.body}</p>
      </div>
    </div>
  `;
}

function buildPostCard(post) {
  // post data from API: id, author_name, category, title, body, created_at, like_count, comment_count, is_liked
  
  // Format date loosely
  const dateObj = new Date(post.created_at);
  const dateStr = isNaN(dateObj) ? post.created_at : dateObj.toLocaleDateString();

  const isLiked = post.is_liked ? 'true' : 'false';
  const likeClass = post.is_liked ? 'text-primary' : 'text-tertiary';
  const fill = post.is_liked ? '1' : '0';

  let catLabel = post.category;
  if (catLabel === 'health') catLabel = 'Salud y Nutrición';
  else if (catLabel === 'tips') catLabel = 'Consejos Generales';
  else if (catLabel === 'events') catLabel = 'Eventos Locales';
  else if (catLabel === 'search') catLabel = 'Apoyo en Búsqueda';

  return `
    <article class="bg-white rounded-xl p-md border border-surface-container-high shadow-sm hover:shadow-md transition-shadow" data-category="${post.category}">
      <div class="flex items-start justify-between mb-md">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-bold text-xl">
            ${post.author_name ? post.author_name[0].toUpperCase() : '?'}
          </div>
          <div>
            <h4 class="font-label-lg text-on-surface">${post.author_name}</h4>
            <p class="text-label-sm text-tertiary">${dateStr} • <span class="text-secondary font-semibold">${catLabel}</span></p>
          </div>
        </div>
      </div>
      <h3 class="font-headline-md text-on-surface mb-sm leading-tight">${post.title}</h3>
      <p class="text-body-md text-tertiary mb-md">${post.body}</p>
      
      <div class="flex items-center gap-6 border-t border-surface-container-low pt-md">
        <button class="like-btn flex items-center gap-1.5 text-label-lg hover:text-primary transition-colors ${likeClass}" data-post-id="${post.id}" data-liked="${isLiked}">
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' ${fill}, 'wght' 400;">thumb_up</span>
          <span class="like-count">${post.like_count || 0}</span>
        </button>
        <button class="comment-btn flex items-center gap-1.5 text-label-lg text-tertiary hover:text-primary transition-colors" data-post-id="${post.id}">
          <span class="material-symbols-outlined">chat_bubble_outline</span>
          <span><span class="comment-count">${post.comment_count || 0}</span> comentarios</span>
        </button>
      </div>

      <!-- Comments Section (hidden by default) -->
      <div class="comments-section mt-6 border-t border-stone-100 pt-6 hidden" id="comments-${post.id}">
        <div class="comments-list space-y-4 mb-6 max-h-60 overflow-y-auto custom-scroll pr-2">
          <div class="text-xs text-stone-400 italic py-2">Cargando comentarios...</div>
        </div>
        <form class="comment-form flex gap-3 mt-4" data-post-id="${post.id}">
          <input type="text" class="comment-input flex-grow px-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-body-md" placeholder="Escribe un comentario..." required />
          <button type="submit" class="px-5 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98] flex items-center gap-1">
            <span class="material-symbols-outlined text-[14px]">send</span> Comentar
          </button>
        </form>
      </div>
    </article>`;
}

export function render() {
  return `
<main class="pt-20 flex-grow max-w-7xl w-full mx-auto px-6 py-lg">
  <section class="mb-xl text-center md:text-left">
    <h1 class="font-headline-xl text-primary mb-xs">Comunidad</h1>
    <p class="text-body-lg text-tertiary max-w-2xl">Conéctate con miles de dueños de mascotas, comparte consejos y mantente al día con los eventos locales. Este es tu espacio seguro para todo lo relacionado con huellas y bigotes.</p>
  </section>
  <div class="flex flex-col lg:flex-row gap-gutter">
    <!-- Sidebar -->
    <aside class="w-full lg:w-72 flex-shrink-0 space-y-md">
      <div class="bg-surface-container-low rounded-xl p-md">
        <h3 class="font-label-lg text-on-surface-variant mb-md px-2">CATEGORÍAS</h3>
        <nav class="space-y-1" id="community-categories">
          <a class="community-cat flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary/10 text-primary font-bold cursor-pointer" data-cat="all">
            <span class="material-symbols-outlined">forum</span>
            <span class="flex-1">Todas las charlas</span>
            <span class="cat-count text-[11px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold" data-cat-count="all"></span>
          </a>
          <a class="community-cat flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary hover:bg-surface-container-high transition-colors cursor-pointer" data-cat="tips">
            <span class="material-symbols-outlined">lightbulb</span>
            <span class="flex-1">Consejos Generales</span>
            <span class="cat-count text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-bold" data-cat-count="tips"></span>
          </a>
          <a class="community-cat flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary hover:bg-surface-container-high transition-colors cursor-pointer" data-cat="health">
            <span class="material-symbols-outlined">health_and_safety</span>
            <span class="flex-1">Salud y Nutrición</span>
            <span class="cat-count text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-bold" data-cat-count="health"></span>
          </a>
          <a class="community-cat flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary hover:bg-surface-container-high transition-colors cursor-pointer" data-cat="events">
            <span class="material-symbols-outlined">event</span>
            <span class="flex-1">Eventos Locales</span>
            <span class="cat-count text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-bold" data-cat-count="events"></span>
          </a>
          <a class="community-cat flex items-center gap-3 px-3 py-2.5 rounded-lg text-tertiary hover:bg-surface-container-high transition-colors cursor-pointer" data-cat="search">
            <span class="material-symbols-outlined">support</span>
            <span class="flex-1">Apoyo en Búsqueda</span>
            <span class="cat-count text-[11px] bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full font-bold" data-cat-count="search"></span>
          </a>
        </nav>
      </div>
      <!-- Featured Event -->
      <div class="bg-secondary-container text-on-secondary-container rounded-xl p-md relative overflow-hidden group">
        <div class="relative z-10">
          <h4 class="font-headline-md mb-2">¡Fiesta de Patas!</h4>
          <p class="text-sm mb-4 opacity-90">Únete a nuestra reunión en Golden Gate Park este sábado.</p>
          <button class="bg-on-secondary-container text-white px-4 py-2 rounded-lg text-label-sm">Ver Evento</button>
        </div>
        <span class="material-symbols-outlined absolute -bottom-4 -right-4 text-8xl opacity-10 rotate-12 group-hover:scale-110 transition-transform">pets</span>
      </div>
    </aside>
    
    <!-- Main Feed -->
    <div class="flex-grow space-y-md">
      <div class="flex items-center justify-between mb-sm">
        <h2 class="font-headline-md text-on-surface">Charlas en Tendencia</h2>
        <div class="flex gap-2" id="feed-toggle">
          <button class="feed-toggle-btn px-3 py-1 rounded-full border border-outline text-label-sm hover:bg-surface-container-high" data-sort="recent">Reciente</button>
          <button class="feed-toggle-btn px-3 py-1 rounded-full bg-primary text-on-primary text-label-sm" data-sort="popular">Popular</button>
        </div>
      </div>
      
      <!-- Posts Container -->
      <div id="posts-container" class="space-y-md">
        <div class="text-center py-10 text-on-surface-variant">Cargando publicaciones...</div>
      </div>

      <!-- Quick Question Prompt -->
      <div class="bg-surface-container-highest/50 border border-outline-variant/40 rounded-xl p-6">
        <div class="flex items-center gap-3 mb-4">
          <div class="bg-white p-2.5 rounded-full shadow-sm">
            <span class="material-symbols-outlined text-xl text-primary">help_outline</span>
          </div>
          <div>
            <h3 class="font-label-lg text-on-surface">¿No encuentras lo que buscas?</h3>
            <p class="text-xs text-tertiary">Haz una pregunta rápida a la comunidad</p>
          </div>
        </div>
        <form id="quick-question-form" class="flex gap-3">
          <input type="text" id="quick-question-input" class="flex-grow px-4 py-3 text-sm bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-body-md" placeholder="Escribe tu pregunta aquí..." required />
          <button type="submit" class="px-5 py-3 bg-primary text-white text-xs font-bold rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98] flex items-center gap-1.5 whitespace-nowrap">
            <span class="material-symbols-outlined text-[16px]">send</span> Preguntar
          </button>
        </form>
      </div>
    </div>
  </div>
</main>

<!-- Mobile FAB -->
<button id="mobile-fab" class="md:hidden fixed bottom-6 right-6 bg-primary text-on-primary w-14 h-14 rounded-full shadow-2xl flex items-center justify-center active:scale-95 transition-transform z-40">
  <span class="material-symbols-outlined text-3xl">add</span>
</button>

<!-- Compose Modal -->
<div id="compose-modal" class="fixed inset-0 z-[90] hidden">
  <div class="absolute inset-0 bg-black/40 backdrop-blur-sm" id="compose-backdrop"></div>
  <div class="absolute inset-0 flex items-center justify-center p-6">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8 relative">
      <button id="close-compose" class="absolute top-4 right-4 text-tertiary hover:text-on-surface">
        <span class="material-symbols-outlined">close</span>
      </button>
      <h3 class="font-headline-md text-on-surface mb-6">Nueva Publicación</h3>
      <form id="compose-form" class="space-y-4">
        <div>
           <select id="post-category" class="w-full px-4 py-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none" required>
             <option value="" disabled selected>Selecciona una categoría...</option>
             <option value="tips">Consejos Generales</option>
             <option value="health">Salud y Nutrición</option>
             <option value="events">Eventos Locales</option>
             <option value="search">Apoyo en Búsqueda</option>
           </select>
        </div>
        <input id="post-title" class="w-full px-4 py-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none" placeholder="Título de tu publicación" type="text" required/>
        <textarea id="post-body" class="w-full px-4 py-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary focus:border-primary outline-none" rows="4" placeholder="¿Qué quieres compartir?" required></textarea>
        <div class="flex justify-end gap-3">
          <button type="button" id="cancel-compose" class="px-6 py-3 rounded-lg text-tertiary font-semibold hover:bg-surface-container-high transition-colors">Cancelar</button>
          <button type="submit" class="px-6 py-3 rounded-lg bg-primary text-on-primary font-semibold shadow-md active:scale-95 transition-transform">Publicar</button>
        </div>
      </form>
    </div>
  </div>
</div>`;
}

export async function init() {
  const postsContainer = document.getElementById('posts-container');
  let currentCategory = 'all';
  let currentSort = 'popular';

  async function loadPosts() {
    try {
      const res = await api.getPosts(currentCategory, currentSort);
      if (res.success) {
        if (res.data.length === 0) {
          postsContainer.innerHTML = '<div class="text-center py-10 text-on-surface-variant border border-dashed rounded-xl border-outline-variant">No hay publicaciones en esta categoría.</div>';
        } else {
          postsContainer.innerHTML = res.data.map(p => buildPostCard(p)).join('');
          attachPostEvents();
        }

        // Update category counters
        updateCategoryCounts(res.data);
      }
    } catch (err) {
      postsContainer.innerHTML = '<div class="text-center py-10 text-error">Error al cargar publicaciones.</div>';
    }
  }

  function updateCategoryCounts(posts) {
    if (currentCategory !== 'all') return;
    // Count posts per category from current data
    const counts = { tips: 0, health: 0, events: 0, search: 0 };
    posts.forEach(p => {
      if (counts[p.category] !== undefined) counts[p.category]++;
    });
    const total = posts.length;

    // Update badges
    const allBadge = document.querySelector('[data-cat-count="all"]');
    if (allBadge) allBadge.textContent = total > 0 ? total : '';

    Object.keys(counts).forEach(cat => {
      const badge = document.querySelector(`[data-cat-count="${cat}"]`);
      if (badge) badge.textContent = counts[cat] > 0 ? counts[cat] : '';
    });
  }

  function attachPostEvents() {
    // Like buttons
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!api.isLoggedIn()) {
          window.PataMatch.toast('Debes iniciar sesión para dar like', 'error');
          return;
        }

        const postId = btn.getAttribute('data-post-id');
        try {
          const res = await api.toggleLike(postId);
          if (res.success) {
            const { is_liked, like_count } = res.data;
            btn.setAttribute('data-liked', String(is_liked));
            btn.querySelector('.like-count').textContent = like_count;
            const icon = btn.querySelector('.material-symbols-outlined');
            icon.style.fontVariationSettings = `'FILL' ${is_liked ? 1 : 0}, 'wght' 400`;
            
            if (is_liked) {
              btn.classList.add('text-primary');
              btn.classList.remove('text-tertiary');
            } else {
              btn.classList.remove('text-primary');
              btn.classList.add('text-tertiary');
            }
          }
        } catch (err) {
          window.PataMatch.toast('Error al actualizar like', 'error');
        }
      });
    });

    // Comment toggle buttons
    document.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const postId = btn.getAttribute('data-post-id');
        const section = document.getElementById(`comments-${postId}`);
        if (!section) return;

        const isHidden = section.classList.contains('hidden');
        if (isHidden) {
          section.classList.remove('hidden');
          
          // Load comments
          const list = section.querySelector('.comments-list');
          try {
            const commentsRes = await api.getComments(postId);
            if (commentsRes.success) {
              if (commentsRes.data.length === 0) {
                list.innerHTML = '<p class="text-xs text-stone-400 italic py-2">No hay comentarios en esta publicación. ¡Sé el primero en comentar!</p>';
              } else {
                list.innerHTML = commentsRes.data.map(c => buildCommentHTML(c)).join('');
              }
            }
          } catch (err) {
            list.innerHTML = '<p class="text-xs text-error py-2">Error al cargar comentarios.</p>';
          }
        } else {
          section.classList.add('hidden');
        }
      });
    });

    // Comment submit forms
    document.querySelectorAll('.comment-form').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!api.isLoggedIn()) {
          window.PataMatch.toast('Debes iniciar sesión para comentar', 'error');
          return;
        }

        const postId = form.getAttribute('data-post-id');
        const input = form.querySelector('.comment-input');
        const body = input.value.trim();
        if (!body) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        try {
          const res = await api.addComment(postId, body);
          if (res.success) {
            input.value = '';
            
            // Reload comments list
            const list = document.querySelector(`#comments-${postId} .comments-list`);
            const commentsRes = await api.getComments(postId);
            if (commentsRes.success) {
              if (commentsRes.data.length === 0) {
                list.innerHTML = '<p class="text-xs text-stone-400 italic py-2">No hay comentarios en esta publicación. ¡Sé el primero en comentar!</p>';
              } else {
                list.innerHTML = commentsRes.data.map(c => buildCommentHTML(c)).join('');
                
                // Scroll to the bottom of comment list
                list.scrollTop = list.scrollHeight;
              }
              
              // Update comments badge
              const postCard = form.closest('article');
              const commentCountBadge = postCard.querySelector('.comment-btn .comment-count');
              if (commentCountBadge) {
                commentCountBadge.textContent = commentsRes.data.length;
              }
            }
            window.PataMatch.toast('¡Comentario publicado!', 'success');
          }
        } catch (err) {
          window.PataMatch.toast('Error al publicar comentario', 'error');
        } finally {
          submitBtn.disabled = false;
        }
      });
    });
  }

  // Category toggle
  document.querySelectorAll('.community-cat').forEach(cat => {
    cat.addEventListener('click', () => {
      document.querySelectorAll('.community-cat').forEach(c => {
        c.classList.remove('bg-primary/10', 'text-primary', 'font-bold');
        c.classList.add('text-tertiary');
      });
      cat.classList.add('bg-primary/10', 'text-primary', 'font-bold');
      cat.classList.remove('text-tertiary');
      
      currentCategory = cat.getAttribute('data-cat');
      loadPosts();
    });
  });

  // Feed toggle (Sort)
  document.querySelectorAll('.feed-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.feed-toggle-btn').forEach(b => {
        b.classList.remove('bg-primary', 'text-on-primary');
        b.classList.add('border', 'border-outline');
      });
      btn.classList.add('bg-primary', 'text-on-primary');
      btn.classList.remove('border', 'border-outline');
      
      currentSort = btn.getAttribute('data-sort');
      loadPosts();
    });
  });

  // Compose modal
  const modal = document.getElementById('compose-modal');
  const form = document.getElementById('compose-form');
  
  const openCompose = () => {
    if (!api.isLoggedIn()) {
      window.PataMatch.toast('Debes iniciar sesión para publicar', 'error');
      return;
    }
    modal?.classList.remove('hidden');
  };
  
  const closeCompose = () => {
    modal?.classList.add('hidden');
    form?.reset();
  };

  document.getElementById('start-chat-btn')?.addEventListener('click', openCompose);
  document.getElementById('mobile-fab')?.addEventListener('click', openCompose);
  document.getElementById('close-compose')?.addEventListener('click', closeCompose);
  document.getElementById('cancel-compose')?.addEventListener('click', closeCompose);
  document.getElementById('compose-backdrop')?.addEventListener('click', closeCompose);

  // Quick question form
  document.getElementById('quick-question-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!api.isLoggedIn()) {
      window.PataMatch.toast('Debes iniciar sesión para preguntar', 'error');
      return;
    }
    const input = document.getElementById('quick-question-input');
    const question = input.value.trim();
    if (!question) return;

    // Pre-fill the compose modal with the question
    openCompose();
    const titleInput = document.getElementById('post-title');
    if (titleInput) titleInput.value = question;
    input.value = '';
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Publicando...';

    const data = {
      title: document.getElementById('post-title').value,
      body: document.getElementById('post-body').value,
      category: document.getElementById('post-category').value
    };

    try {
      const res = await api.createPost(data);
      if (res.success) {
        window.PataMatch.toast('¡Publicación creada exitosamente!', 'success');
        closeCompose();
        
        // Switch to the category they just posted in and 'recent' to see it
        document.querySelector(`.community-cat[data-cat="${data.category}"]`)?.click();
        document.querySelector('.feed-toggle-btn[data-sort="recent"]')?.click();
      }
    } catch (err) {
      window.PataMatch.toast(err.message || 'Error al publicar', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Publicar';
    }
  });

  // Initial load
  loadPosts();
}
