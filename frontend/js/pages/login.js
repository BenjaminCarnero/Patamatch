import * as api from '../api.js?v=4';

export function render() {
  // Login is a full-page layout — signal the router to hide nav/footer
  window.PataMatch = window.PataMatch || {};
  window.PataMatch.isFullPage = true;

  return `
<main class="min-h-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden">
  <!-- Image Side (Desktop) — Dynamic rotating backgrounds -->
  <div class="hidden md:block relative h-full w-full overflow-hidden" id="login-image-side">
    <div class="absolute inset-0 bg-primary/10 mix-blend-multiply z-10"></div>
    <!-- Image carousel -->
    <img id="login-carousel-img" alt="Mascotas adoptadas felices en su nuevo hogar" class="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000" src="https://images.unsplash.com/photo-1537204696486-967f1b7198c8?w=1200&q=80&auto=format&fit=crop"/>
    <div class="absolute bottom-12 left-12 z-20 max-w-md">
      <div class="flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-on-primary bg-primary p-2 rounded-full" style="font-variation-settings: 'FILL' 1;">pets</span>
        <h1 class="font-headline-lg text-white drop-shadow-md">PataMatch</h1>
      </div>
      <p id="login-carousel-text" class="font-headline-md text-white drop-shadow-md transition-opacity duration-500">
        "¡Ellos ya iniciaron sesión en su nuevo hogar!"
      </p>
    </div>
  </div>
  <!-- Form Side -->
  <div class="flex flex-col justify-center items-center px-6 py-12 md:px-12 lg:px-24 bg-surface">
    <!-- Mobile Brand Header -->
    <div class="md:hidden flex items-center gap-2 mb-10">
      <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">pets</span>
      <span class="font-headline-md text-primary tracking-tight">PataMatch</span>
    </div>
    <div class="w-full max-w-[400px]">
      <header class="mb-10">
        <h2 class="font-headline-xl text-on-surface mb-2">¡Hola de nuevo!</h2>
        <p class="font-body-md text-on-surface-variant">Bienvenido a la comunidad que conecta corazones con patitas.</p>
      </header>
      <form id="login-form" class="space-y-6" novalidate>
        <div class="space-y-1.5">
          <label class="font-label-lg text-on-surface-variant flex items-center gap-2" for="login-email">
            <span class="material-symbols-outlined text-[18px]">mail</span>
            Correo electrónico
          </label>
          <input class="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/50" id="login-email" placeholder="nombre@ejemplo.com" type="email" required/>
          <p class="text-xs mt-1.5 hidden transition-all" id="login-email-error">
            <span class="flex items-center gap-1 text-error">
              <span class="material-symbols-outlined text-[14px]">error</span>
              Por favor ingresa un correo válido (ej: nombre@ejemplo.com)
            </span>
          </p>
        </div>
        <div class="space-y-1.5">
          <div class="flex justify-between items-center">
            <label class="font-label-lg text-on-surface-variant flex items-center gap-2" for="login-password">
              <span class="material-symbols-outlined text-[18px]">lock</span>
              Contraseña
            </label>
            <a class="font-label-sm text-primary hover:underline transition-all" href="#">¿Olvidaste tu contraseña?</a>
          </div>
          <div class="relative">
            <input class="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all placeholder:text-outline/50" id="login-password" placeholder="••••••••" type="password" required/>
            <button class="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors" type="button" id="toggle-password">
              <span class="material-symbols-outlined">visibility</span>
            </button>
          </div>
          <p class="text-error text-xs hidden" id="login-password-error">La contraseña es requerida</p>
        </div>
        <button class="w-full py-4 bg-primary text-on-primary font-label-lg rounded-lg shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 active:scale-[0.98]" type="submit">
          Iniciar Sesión
        </button>
      </form>
      <div class="relative my-8">
        <div class="absolute inset-0 flex items-center">
          <div class="w-full border-t border-surface-variant"></div>
        </div>
        <div class="relative flex justify-center">
          <span class="bg-surface px-4 font-label-sm text-on-surface-variant">o continúa con</span>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <button class="flex items-center justify-center gap-3 py-3 px-4 border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container-low transition-colors active:scale-[0.98]">
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"></path>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"></path>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"></path>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"></path>
          </svg>
          <span class="font-label-lg text-on-surface">Google</span>
        </button>
        <button class="flex items-center justify-center gap-3 py-3 px-4 border border-outline-variant rounded-lg bg-surface-container-lowest hover:bg-surface-container-low transition-colors active:scale-[0.98]">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.81-3.12 1.87-2.39 5.98.53 7.21-.6 1.48-1.46 2.91-2.58 3.99zM12.03 7.25c-.02-2.23 1.76-4.07 3.9-4.25.26 2.38-1.92 4.41-3.9 4.25z"></path>
          </svg>
          <span class="font-label-lg text-on-surface">Apple</span>
        </button>
      </div>
      <footer class="mt-12 text-center">
        <p class="font-body-md text-on-surface-variant">
          ¿No tienes una cuenta? 
          <a class="text-primary font-label-lg hover:underline transition-all cursor-pointer" data-navigate="registro">Regístrate gratis</a>
        </p>
      </footer>
    </div>
  </div>
</main>
<!-- Decorative elements -->
<div class="fixed top-8 right-8 pointer-events-none hidden lg:block opacity-20">
  <span class="material-symbols-outlined text-[120px] text-primary" style="font-variation-settings: 'FILL' 1;">favorite</span>
</div>
<div class="fixed bottom-8 right-1/2 translate-x-1/2 md:translate-x-0 md:left-8 pointer-events-none opacity-20">
  <span class="material-symbols-outlined text-[80px] text-primary">volunteer_activism</span>
</div>
  `;
}

export function init() {
  window.PataMatch = window.PataMatch || {};

  // Password visibility toggle
  const toggleBtn = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('login-password');

  if (toggleBtn && passwordInput) {
    toggleBtn.addEventListener('click', () => {
      const icon = toggleBtn.querySelector('.material-symbols-outlined');
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        passwordInput.type = 'password';
        icon.textContent = 'visibility';
      }
    });
  }

  // Form validation and submission
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let isValid = true;

      const emailInput = document.getElementById('login-email');
      const emailError = document.getElementById('login-email-error');
      const passwordError = document.getElementById('login-password-error');

      // Validate email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailInput.value || !emailRegex.test(emailInput.value)) {
        emailError.classList.remove('hidden');
        emailInput.classList.add('border-error');
        isValid = false;
      } else {
        emailError.classList.add('hidden');
        emailInput.classList.remove('border-error');
      }

      // Validate password
      if (!passwordInput.value) {
        passwordError.classList.remove('hidden');
        passwordInput.classList.add('border-error');
        isValid = false;
      } else {
        passwordError.classList.add('hidden');
        passwordInput.classList.remove('border-error');
      }

      if (isValid) {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Iniciando...';
        
        try {
          const res = await api.login(emailInput.value, passwordInput.value);
          if (res.success) {
            window.PataMatch.user = res.data.user;
            window.PataMatch.isFullPage = false;
            window.PataMatch.toast('¡Bienvenido de vuelta!', 'success');
            window.location.hash = '#home';
          }
        } catch (err) {
          window.PataMatch.toast(err.message || 'Credenciales inválidas', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Iniciar Sesión';
        }
      }
    });

    // Clear errors on input
    const inputs = form.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('border-error');
        const errorEl = input.parentElement.querySelector('.text-error') || 
                        input.closest('.space-y-1\\.5')?.querySelector('[id$="-error"]');
        if (errorEl) errorEl.classList.add('hidden');
      });
    });

    // Real-time email validation
    const emailInput = document.getElementById('login-email');
    const emailError = document.getElementById('login-email-error');
    const emailRegexRT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    function validateEmailRealtime() {
      if (!emailInput.value) {
        emailError.classList.add('hidden');
        emailInput.classList.remove('border-error', 'border-primary/50');
        return;
      }
      if (!emailRegexRT.test(emailInput.value)) {
        emailError.classList.remove('hidden');
        emailInput.classList.add('border-error');
        emailInput.classList.remove('border-primary/50');
      } else {
        emailError.classList.add('hidden');
        emailInput.classList.remove('border-error');
        emailInput.classList.add('border-primary/50');
      }
    }

    emailInput?.addEventListener('blur', validateEmailRealtime);
    emailInput?.addEventListener('input', () => {
      // Only validate on input if already showing error
      if (!emailError.classList.contains('hidden')) {
        validateEmailRealtime();
      }
    });
  }

  // Rotating carousel for login images
  const carouselImg = document.getElementById('login-carousel-img');
  const carouselText = document.getElementById('login-carousel-text');

  if (carouselImg) {
    const slides = [
      {
        img: 'https://images.unsplash.com/photo-1537204696486-967f1b7198c8?w=1200&q=80&auto=format&fit=crop',
        text: '¡Ellos ya iniciaron sesión en su nuevo hogar!'
      },
      {
        img: 'https://images.unsplash.com/photo-1655410037334-6155adce8241?w=1200&q=80&auto=format&fit=crop',
        text: 'Cada adopción es un nuevo comienzo lleno de amor.'
      },
      {
        img: 'https://images.unsplash.com/photo-1718885433034-908d5bca08cf?w=1200&q=80&auto=format&fit=crop',
        text: 'Más de 2,000 familias ya encontraron a su compañero ideal.'
      }
    ];

    let slideIndex = 0;
    const loginCarouselInterval = setInterval(() => {
      slideIndex = (slideIndex + 1) % slides.length;
      carouselImg.style.opacity = '0';
      carouselText.style.opacity = '0';

      setTimeout(() => {
        carouselImg.src = slides[slideIndex].img;
        carouselText.textContent = `"${slides[slideIndex].text}"`;
        carouselImg.style.opacity = '1';
        carouselText.style.opacity = '1';
      }, 500);
    }, 5000);

    // Cleanup on navigation
    window.addEventListener('hashchange', () => clearInterval(loginCarouselInterval), { once: true });
  }
}
