import { updateProfile } from '../api.js';

export function render() {
    const user = window.PataMatch.user;
    if (!user) {
        window.location.hash = 'login';
        return '';
    }

    const avatarUrl = user.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name) + '&background=random';

    return `
    <div class="max-w-2xl mx-auto px-6 py-12">
        <div class="mb-8">
            <h1 class="font-headline-lg text-stone-800 mb-2">Mi Perfil</h1>
            <p class="text-stone-600">Actualiza tu información personal y foto de perfil.</p>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-stone-100 p-8">
            <form id="perfil-form" class="space-y-6">
                <!-- Avatar Preview -->
                <div class="flex items-center gap-6 mb-8">
                    <img id="avatar-preview" src="${avatarUrl}" alt="Avatar" class="w-24 h-24 rounded-full object-cover border-4 border-stone-50 shadow-sm" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random'"/>
                    <div>
                        <h3 class="font-bold text-stone-800 text-lg">${user.name}</h3>
                        <p class="text-stone-500 text-sm">${user.email}</p>
                    </div>
                </div>

                <div class="space-y-4">
                    <div>
                        <label for="name" class="block text-sm font-semibold text-stone-700 mb-2">Nombre Completo</label>
                        <input type="text" id="name" name="name" value="${user.name}" required
                            class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-[#D96C4A] focus:border-[#D96C4A] transition-all outline-none"
                            placeholder="Ej. Sarah Miller" />
                    </div>

                    <div>
                        <label for="avatar_file" class="block text-sm font-semibold text-stone-700 mb-2">Sube una Foto de Perfil</label>
                        <input type="file" id="avatar_file" name="avatar_file" accept="image/*"
                            class="w-full px-4 py-3 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-[#D96C4A] focus:border-[#D96C4A] transition-all outline-none file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#D96C4A]/10 file:text-[#D96C4A] hover:file:bg-[#D96C4A]/20 cursor-pointer" />
                        <p class="text-xs text-stone-500 mt-2">Sube una imagen desde tu computadora (JPG, PNG). Se adaptará automáticamente.</p>
                    </div>

                    <div class="pt-2">
                        <label class="block text-sm font-semibold text-stone-700 mb-2">Mi Zona</label>
                        <p class="text-xs text-stone-500 mb-3">
                            Haz clic en el mapa para marcar tu zona. Te avisaremos cuando se reporte
                            una mascota perdida a menos de <strong>5 km</strong> de este punto.
                        </p>
                        <div id="zona-map" class="w-full h-64 rounded-xl border border-stone-200 overflow-hidden bg-stone-100"></div>
                        <p id="zona-status" class="text-xs mt-2 ${user.lat ? 'text-stone-600' : 'text-amber-700'}">
                            ${user.lat
                                ? `Zona activa en ${Number(user.lat).toFixed(4)}, ${Number(user.lng).toFixed(4)}`
                                : 'Todavía no fijaste tu zona — no vas a recibir alertas de mascotas perdidas.'}
                        </p>
                        <button type="button" id="usar-ubicacion-btn" class="mt-3 text-xs font-semibold text-[#D96C4A] hover:underline flex items-center gap-1">
                            <span class="material-symbols-outlined text-[16px]">my_location</span>
                            Usar mi ubicación actual
                        </button>
                    </div>
                </div>

                <div class="pt-6 border-t border-stone-100 flex justify-end gap-4">
                    <a href="#home" class="px-6 py-3 rounded-xl text-stone-600 font-semibold hover:bg-stone-50 transition-colors">Cancelar</a>
                    <button type="submit" id="save-profile-btn" class="bg-[#D96C4A] text-white px-8 py-3 rounded-xl font-bold hover:bg-[#c45a39] active:scale-[0.98] transition-all shadow-sm">
                        Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    </div>
    `;
}

export function init() {
    const user = window.PataMatch.user;
    if (!user) return;

    const form = document.getElementById('perfil-form');
    const avatarInput = document.getElementById('avatar_file');
    const avatarPreview = document.getElementById('avatar-preview');
    const nameInput = document.getElementById('name');
    const saveBtn = document.getElementById('save-profile-btn');

    let currentBase64Avatar = user.avatar_url || '';

    // ===== "Mi Zona": punto que define el centro del radio de alertas (RF-09) =====
    let zonaLat = user.lat != null ? Number(user.lat) : null;
    let zonaLng = user.lng != null ? Number(user.lng) : null;

    const zonaStatus = document.getElementById('zona-status');
    const zonaMap = L.map('zona-map', { zoomControl: true })
        .setView([zonaLat ?? 19.4326, zonaLng ?? -99.1332], 12);

    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    }).addTo(zonaMap);

    // El mapa se monta antes de ser visible en el SPA: hay que recalcular su
    // tamaño y recién ahí encuadrar, o el fitBounds se calcula sobre 0x0 px.
    setTimeout(() => {
        zonaMap.invalidateSize();
        if (zonaCirculo) zonaMap.fitBounds(zonaCirculo.getBounds().pad(0.1));
    }, 100);

    let zonaMarker = null;
    let zonaCirculo = null;

    function fijarZona(lat, lng, encuadrar = false) {
        zonaLat = lat;
        zonaLng = lng;

        if (zonaMarker) zonaMap.removeLayer(zonaMarker);
        if (zonaCirculo) zonaMap.removeLayer(zonaCirculo);

        zonaMarker = L.marker([lat, lng]).addTo(zonaMap);
        // El círculo hace visible el radio de 5 km que usa el backend. Va en un
        // tono oscuro y punteado porque el naranja de marca se pierde sobre las
        // calles del mapa, que ya son naranjas.
        zonaCirculo = L.circle([lat, lng], {
            radius: 5000,
            color: '#7C2D12',
            fillColor: '#D96C4A',
            fillOpacity: 0.15,
            weight: 3,
            dashArray: '6 6'
        }).addTo(zonaMap);

        // Encuadrar al círculo garantiza que el radio siempre se vea completo,
        // sin depender de un nivel de zoom fijo.
        if (encuadrar) zonaMap.fitBounds(zonaCirculo.getBounds().pad(0.1));

        zonaStatus.textContent = `Zona activa en ${lat.toFixed(4)}, ${lng.toFixed(4)} — radio de 5 km`;
        zonaStatus.className = 'text-xs mt-2 text-stone-600';
    }

    if (zonaLat != null && zonaLng != null) fijarZona(zonaLat, zonaLng);

    zonaMap.on('click', (e) => fijarZona(e.latlng.lat, e.latlng.lng));

    document.getElementById('usar-ubicacion-btn')?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            window.PataMatch.toast('Tu navegador no soporta geolocalización', 'error');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => fijarZona(pos.coords.latitude, pos.coords.longitude, /* encuadrar */ true),
            () => window.PataMatch.toast('No se pudo obtener tu ubicación', 'error')
        );
    });

    // File input handler with resize
    avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Max dimensions to prevent huge strings
                const MAX_WIDTH = 400;
                const MAX_HEIGHT = 400;
                let width = img.width;
                let height = img.height;
                
                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                currentBase64Avatar = dataUrl;
                avatarPreview.src = dataUrl;
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
    
    nameInput.addEventListener('input', (e) => {
        if (!currentBase64Avatar) {
            avatarPreview.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(e.target.value || 'Usuario') + '&background=random';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = nameInput.value.trim();

        if (!name) {
            window.PataMatch.toast('El nombre es requerido', 'error');
            return;
        }

        const originalText = saveBtn.innerText;
        saveBtn.innerText = 'Guardando...';
        saveBtn.disabled = true;

        try {
            const res = await updateProfile({
                name,
                avatar_url: currentBase64Avatar,
                lat: zonaLat,
                lng: zonaLng
            });
            if (res.success) {
                // Update local state
                window.PataMatch.user = { ...window.PataMatch.user, ...res.data };
                localStorage.setItem('patamatch_user', JSON.stringify(window.PataMatch.user));
                
                window.PataMatch.toast('Perfil actualizado correctamente', 'success');
                // Refresh to show new avatar in navigation immediately
                setTimeout(() => {
                    window.location.reload();
                }, 800);
            }
        } catch (err) {
            window.PataMatch.toast(err.message || 'Error al actualizar perfil', 'error');
        } finally {
            saveBtn.innerText = originalText;
            saveBtn.disabled = false;
        }
    });
}
