import * as api from '../api.js?v=4';
import { cities } from '../cities.js';

export function render() {
  // Register is a full-page layout — signal the router to hide nav/footer
  window.PataMatch = window.PataMatch || {};
  window.PataMatch.isFullPage = true;

  return `
<main class="min-h-screen flex items-stretch">
  <!-- Image Side (Desktop) -->
  <div class="hidden lg:block lg:w-1/2 relative overflow-hidden">
    <div class="absolute inset-0 bg-primary opacity-10 mix-blend-multiply z-10"></div>
    <img class="absolute inset-0 w-full h-full object-cover" alt="Golden retriever y gato calico juntos en un hogar soleado" src="https://lh3.googleusercontent.com/aida-public/AB6AXuDLAWwbh2dJqSbgMgyaN5rFfW_6-bV1ea_HuGUxb81ZgWgeQEISoCGRRbWA7PDSVJbTDtKQAp61EYoUJ3arOsaClVsN3ngM_Fx-ymhpEhJDAyllDFNCf6Ehu60ev1lIqfCqKdEH401V-glzTnHHRloTifD05r2xgxDsXw3VHcsIH2ovGTFcJ5MA7t_Y0FnC-QmFJtmArw7TcdgwbN7dI_Vae2S7OSwnZK6cqtsqKxUhus2ZTOVoyT82oUi92IUcRlikzwNfqB8wDco8"/>
    <div class="absolute inset-0 flex flex-col justify-end p-xl z-20 bg-gradient-to-t from-black/60 to-transparent">
      <div class="max-w-md">
        <h1 class="font-headline-xl text-white mb-md">Únete a la comunidad de PataMatch</h1>
        <p class="font-body-lg text-white/90">Miles de mascotas esperan un hogar lleno de amor. Tu nueva mejor compañía está a solo unos clics de distancia.</p>
      </div>
    </div>
  </div>
  <!-- Form Side -->
  <div class="w-full lg:w-1/2 flex items-center justify-center p-md md:p-lg lg:p-xl bg-surface-container-low">
    <div class="w-full max-w-md bg-white rounded-xl shadow-sm p-lg border border-surface-variant">
      <!-- Mobile Brand Header -->
      <div class="lg:hidden flex items-center gap-2 mb-6">
        <span class="material-symbols-outlined text-primary text-3xl" style="font-variation-settings: 'FILL' 1;">pets</span>
        <span class="font-headline-md text-primary tracking-tight">PataMatch</span>
      </div>
      <div class="mb-lg">
        <h2 class="font-headline-lg text-primary mb-xs">Bienvenido</h2>
        <p class="font-body-md text-on-surface-variant">Completa tus datos para crear una cuenta.</p>
      </div>
      <form id="register-form" class="space-y-md" novalidate>
        <div class="space-y-xs">
          <label class="font-label-lg text-on-surface-variant block ml-xs" for="reg-name">Nombre Completo</label>
          <div class="relative flex items-center">
            <span class="material-symbols-outlined absolute left-4 text-outline">person</span>
            <input class="w-full pl-12 pr-4 py-3 rounded-lg border border-outline-variant focus:border-primary focus:ring-0 outline-none transition-all bg-surface-bright placeholder:text-outline" id="reg-name" placeholder="Ej. Juan Pérez" type="text" required/>
          </div>
          <p class="text-error text-xs hidden" id="reg-name-error">El nombre es requerido</p>
        </div>
        <div class="space-y-xs">
          <label class="font-label-lg text-on-surface-variant block ml-xs" for="reg-email">Correo Electrónico</label>
          <div class="relative flex items-center">
            <span class="material-symbols-outlined absolute left-4 text-outline">mail</span>
            <input class="w-full pl-12 pr-4 py-3 rounded-lg border border-outline-variant focus:border-primary focus:ring-0 outline-none transition-all bg-surface-bright placeholder:text-outline" id="reg-email" placeholder="tu@email.com" type="email" required/>
          </div>
          <p class="text-error text-xs hidden" id="reg-email-error">Por favor ingresa un correo válido</p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div class="space-y-xs">
            <label class="font-label-lg text-on-surface-variant block ml-xs" for="reg-password">Contraseña</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-4 text-outline">lock</span>
              <input class="w-full pl-12 pr-10 py-3 rounded-lg border border-outline-variant focus:border-primary focus:ring-0 outline-none transition-all bg-surface-bright placeholder:text-outline" id="reg-password" placeholder="********" type="password" required/>
              <button class="absolute right-3 top-1/2 -translate-y-1/2 text-outline-variant hover:text-primary transition-colors" type="button" id="toggle-reg-password">
                <span class="material-symbols-outlined text-[20px]">visibility</span>
              </button>
            </div>
            <p class="text-error text-xs hidden" id="reg-password-error">Mínimo 8 caracteres</p>
            <!-- Password strength indicator -->
            <div id="password-strength-container" class="hidden mt-2">
              <div class="flex gap-1 mb-1.5">
                <div class="h-1 flex-1 rounded-full bg-stone-200 overflow-hidden">
                  <div id="strength-bar-1" class="h-full w-0 rounded-full transition-all duration-300"></div>
                </div>
                <div class="h-1 flex-1 rounded-full bg-stone-200 overflow-hidden">
                  <div id="strength-bar-2" class="h-full w-0 rounded-full transition-all duration-300"></div>
                </div>
                <div class="h-1 flex-1 rounded-full bg-stone-200 overflow-hidden">
                  <div id="strength-bar-3" class="h-full w-0 rounded-full transition-all duration-300"></div>
                </div>
              </div>
              <p id="strength-text" class="text-[11px] font-semibold text-stone-400 flex items-center gap-1"></p>
              <div class="mt-1 space-y-0.5">
                <p class="text-[10px] text-stone-400" id="req-length">&#x2022; Mínimo 8 caracteres</p>
                <p class="text-[10px] text-stone-400" id="req-number">&#x2022; Al menos 1 número</p>
                <p class="text-[10px] text-stone-400" id="req-upper">&#x2022; Al menos 1 mayúscula</p>
              </div>
            </div>
          </div>
          <div class="space-y-xs">
            <label class="font-label-lg text-on-surface-variant block ml-xs" for="reg-city">Ciudad</label>
            <div class="relative flex items-center">
              <span class="material-symbols-outlined absolute left-4 text-outline">location_on</span>
              <input class="w-full pl-12 pr-4 py-3 rounded-lg border border-outline-variant focus:border-primary focus:ring-0 outline-none transition-all bg-surface-bright placeholder:text-outline" id="reg-city" placeholder="Escribe tu ciudad..." type="text" required autocomplete="off" />
              <!-- City suggestions dropdown -->
              <div id="city-suggestions" class="hidden absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border border-stone-100 max-h-48 overflow-y-auto z-50 custom-scroll">
              </div>
            </div>
            <p class="text-error text-xs hidden" id="reg-city-error">La ciudad es requerida</p>
          </div>
        </div>
        <div class="flex items-start gap-sm pt-xs">
          <input class="mt-1 rounded border-outline-variant text-primary focus:ring-primary focus:ring-offset-0" id="terms" type="checkbox"/>
          <label class="font-label-sm text-on-surface-variant" for="terms">
            Acepto los <a class="text-primary font-semibold hover:underline" href="#">términos y condiciones</a> y la política de privacidad de PataMatch.
          </label>
        </div>
        <p class="text-error text-xs hidden" id="reg-terms-error">Debes aceptar los términos y condiciones</p>
        <button class="w-full bg-primary hover:bg-surface-tint text-on-primary font-label-lg py-4 rounded-lg shadow-md transition-all flex justify-center items-center gap-sm active:scale-[0.98]" type="submit">
          Crear Cuenta
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">pets</span>
        </button>
      </form>
      <div class="mt-lg pt-md border-t border-outline-variant text-center">
        <p class="font-body-md text-on-surface-variant">
          ¿Ya tienes una cuenta? 
          <a class="text-primary font-bold hover:underline ml-xs cursor-pointer" data-navigate="login">Inicia Sesión</a>
        </p>
      </div>
    </div>
  </div>
</main>
  `;
}

export function init() {
  window.PataMatch = window.PataMatch || {};

  // Password visibility toggle
  const toggleBtn = document.getElementById('toggle-reg-password');
  const passwordInput = document.getElementById('reg-password');

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
  const form = document.getElementById('register-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      let isValid = true;

      const nameInput = document.getElementById('reg-name');
      const emailInput = document.getElementById('reg-email');
      const cityInput = document.getElementById('reg-city');
      const termsCheckbox = document.getElementById('terms');

      const nameError = document.getElementById('reg-name-error');
      const emailError = document.getElementById('reg-email-error');
      const passwordError = document.getElementById('reg-password-error');
      const cityError = document.getElementById('reg-city-error');
      const termsError = document.getElementById('reg-terms-error');

      // Validate name
      if (!nameInput.value.trim()) {
        nameError.classList.remove('hidden');
        nameInput.closest('.relative').querySelector('input').classList.add('border-error');
        isValid = false;
      } else {
        nameError.classList.add('hidden');
        nameInput.classList.remove('border-error');
      }

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
      if (!passwordInput.value || passwordInput.value.length < 6) {
        passwordError.classList.remove('hidden');
        passwordInput.classList.add('border-error');
        isValid = false;
      } else {
        passwordError.classList.add('hidden');
        passwordInput.classList.remove('border-error');
      }

      // Validate city
      if (!cityInput.value.trim()) {
        cityError.classList.remove('hidden');
        cityInput.classList.add('border-error');
        isValid = false;
      } else {
        cityError.classList.add('hidden');
        cityInput.classList.remove('border-error');
      }

      // Validate terms
      if (!termsCheckbox.checked) {
        termsError.classList.remove('hidden');
        isValid = false;
      } else {
        termsError.classList.add('hidden');
      }

      if (isValid) {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Creando...';
        
        try {
          const res = await api.register(nameInput.value.trim(), emailInput.value, passwordInput.value, cityInput.value.trim());
          if (res.success) {
            window.PataMatch.user = res.data.user;
            window.PataMatch.isFullPage = false;
            window.PataMatch.toast('¡Cuenta creada exitosamente!', 'success');
            window.location.hash = '#home';
          }
        } catch (err) {
          window.PataMatch.toast(err.message || 'Error al crear la cuenta', 'error');
          submitBtn.disabled = false;
          submitBtn.innerHTML = 'Crear Cuenta <span class="material-symbols-outlined" style="font-variation-settings: \'FILL\' 1;">pets</span>';
        }
      }
    });

    // Clear errors on input
    const inputs = form.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
    inputs.forEach(input => {
      input.addEventListener('input', () => {
        input.classList.remove('border-error');
        // Find the closest error message
        const container = input.closest('.space-y-xs');
        if (container) {
          const errorEl = container.querySelector('.text-error');
          if (errorEl) errorEl.classList.add('hidden');
        }
      });
    });

    // Clear terms error on change
    const termsCheckbox = document.getElementById('terms');
    if (termsCheckbox) {
      termsCheckbox.addEventListener('change', () => {
        const termsError = document.getElementById('reg-terms-error');
        if (termsError) termsError.classList.add('hidden');
      });
    }
  }

  // ========== Password Strength Indicator ==========
  const pwdInput = document.getElementById('reg-password');
  const strengthContainer = document.getElementById('password-strength-container');
  const bar1 = document.getElementById('strength-bar-1');
  const bar2 = document.getElementById('strength-bar-2');
  const bar3 = document.getElementById('strength-bar-3');
  const strengthText = document.getElementById('strength-text');
  const reqLength = document.getElementById('req-length');
  const reqNumber = document.getElementById('req-number');
  const reqUpper = document.getElementById('req-upper');

  if (pwdInput && strengthContainer) {
    pwdInput.addEventListener('input', () => {
      const val = pwdInput.value;
      if (!val) {
        strengthContainer.classList.add('hidden');
        return;
      }
      strengthContainer.classList.remove('hidden');

      const hasLength = val.length >= 8;
      const hasNumber = /\d/.test(val);
      const hasUpper = /[A-Z]/.test(val);
      let score = [hasLength, hasNumber, hasUpper].filter(Boolean).length;

      // Update requirement indicators
      reqLength.classList.toggle('text-secondary', hasLength);
      reqLength.classList.toggle('font-semibold', hasLength);
      reqNumber.classList.toggle('text-secondary', hasNumber);
      reqNumber.classList.toggle('font-semibold', hasNumber);
      reqUpper.classList.toggle('text-secondary', hasUpper);
      reqUpper.classList.toggle('font-semibold', hasUpper);

      const colors = { 0: 'bg-stone-300', 1: 'bg-red-400', 2: 'bg-amber-400', 3: 'bg-green-500' };
      const labels = { 0: '', 1: 'Débil', 2: 'Media', 3: 'Fuerte ✅' };
      const textColors = { 0: 'text-stone-400', 1: 'text-red-500', 2: 'text-amber-600', 3: 'text-green-600' };
      const color = colors[score];

      bar1.className = `h-full rounded-full transition-all duration-300 ${score >= 1 ? color + ' w-full' : 'w-0'}`;
      bar2.className = `h-full rounded-full transition-all duration-300 ${score >= 2 ? color + ' w-full' : 'w-0'}`;
      bar3.className = `h-full rounded-full transition-all duration-300 ${score >= 3 ? color + ' w-full' : 'w-0'}`;
      strengthText.className = `text-[11px] font-semibold ${textColors[score]} flex items-center gap-1`;
      strengthText.textContent = labels[score];
    });
  }

  // ========== City Autocomplete ==========
  const cityInput = document.getElementById('reg-city');
  const citySuggestions = document.getElementById('city-suggestions');

  if (cityInput && citySuggestions) {
    cityInput.addEventListener('input', () => {
      const query = cityInput.value.toLowerCase().trim();
      if (query.length < 2) {
        citySuggestions.classList.add('hidden');
        return;
      }

      const matches = cities.filter(c => c.toLowerCase().includes(query)).slice(0, 6);
      if (matches.length === 0) {
        citySuggestions.classList.add('hidden');
        return;
      }

      citySuggestions.innerHTML = matches.map(c => `
        <button type="button" class="city-option w-full text-left px-4 py-2.5 text-sm text-stone-700 hover:bg-orange-50 transition-colors flex items-center gap-2">
          <span class="material-symbols-outlined text-[16px] text-stone-400">location_on</span>
          ${c}
        </button>
      `).join('');
      citySuggestions.classList.remove('hidden');

      citySuggestions.querySelectorAll('.city-option').forEach(opt => {
        opt.addEventListener('click', () => {
          cityInput.value = opt.textContent.trim();
          citySuggestions.classList.add('hidden');
        });
      });
    });

    cityInput.addEventListener('blur', () => {
      setTimeout(() => citySuggestions.classList.add('hidden'), 200);
    });

    cityInput.addEventListener('focus', () => {
      if (cityInput.value.length >= 2) {
        cityInput.dispatchEvent(new Event('input'));
      }
    });
  }
}
