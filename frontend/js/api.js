// ============================================
// PataMatch API Client
// Centralized module for all backend API calls
// ============================================

const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('patamatch_token');
}

function setToken(token) {
  localStorage.setItem('patamatch_token', token);
}

function clearToken() {
  localStorage.removeItem('patamatch_token');
  localStorage.removeItem('patamatch_user');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  if (res.status === 401) {
    clearToken();
    if (window.PataMatch) {
      window.PataMatch.user = null;
      window.PataMatch.toast('Sesión expirada. Por favor inicia sesión.', 'error');
    }
  }

  if (!res.ok && !data.success) {
    throw new Error(data.error || 'Error de servidor');
  }

  return data;
}

// ========== Auth ==========
export async function register(name, email, password, city) {
  const data = await request('POST', '/auth/register', { name, email, password, city });
  if (data.success) {
    setToken(data.data.token);
    localStorage.setItem('patamatch_user', JSON.stringify(data.data.user));
  }
  return data;
}

export async function login(email, password) {
  const data = await request('POST', '/auth/login', { email, password });
  if (data.success) {
    setToken(data.data.token);
    localStorage.setItem('patamatch_user', JSON.stringify(data.data.user));
  }
  return data;
}

export async function getMe() {
  return request('GET', '/auth/me');
}

export async function updateProfile(data) {
  return request('PUT', '/auth/me', data);
}

export function logout() {
  clearToken();
  if (window.PataMatch) window.PataMatch.user = null;
}

export function isLoggedIn() {
  return !!getToken();
}

export function getUser() {
  const u = localStorage.getItem('patamatch_user');
  return u ? JSON.parse(u) : null;
}

// ========== Pets ==========
export async function getPets(filters = {}) {
  const params = new URLSearchParams();
  if (filters.species) params.set('species', filters.species);
  if (filters.size) params.set('size', filters.size);
  if (filters.age) params.set('age', filters.age);
  if (filters.is_adopted !== undefined) params.set('is_adopted', filters.is_adopted);
  if (filters.limit) params.set('limit', filters.limit);
  if (filters.offset) params.set('offset', filters.offset);
  const qs = params.toString();
  return request('GET', `/pets${qs ? '?' + qs : ''}`);
}

export async function getPet(id) {
  return request('GET', `/pets/${id}`);
}

export async function createPet(petData) {
  return request('POST', '/pets', petData);
}

export async function adoptPet(id) {
  return request('POST', `/pets/${id}/adopt`);
}

// ========== Lost Pets ==========
export async function getLostPets(limit) {
  const qs = limit ? `?limit=${limit}` : '';
  return request('GET', `/lost-pets${qs}`);
}

export async function reportLostPet(data) {
  return request('POST', '/lost-pets', data);
}

export async function markFound(id) {
  return request('PUT', `/lost-pets/${id}/found`);
}

// ========== Posts ==========
export async function getPosts(category = 'all', sort = 'popular') {
  const params = new URLSearchParams({ sort });
  if (category && category !== 'all') params.set('category', category);
  return request('GET', `/posts?${params}`);
}

export async function createPost(postData) {
  return request('POST', '/posts', postData);
}

export async function toggleLike(postId) {
  return request('POST', `/posts/${postId}/like`);
}

export async function getComments(postId) {
  return request('GET', `/posts/${postId}/comments`);
}

export async function addComment(postId, body) {
  return request('POST', `/posts/${postId}/comments`, { body });
}

// ========== Stories ==========
export async function getStories(limit, offset) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (offset) params.set('offset', offset);
  const qs = params.toString();
  return request('GET', `/stories${qs ? '?' + qs : ''}`);
}

export async function submitStory(storyData) {
  return request('POST', '/stories', storyData);
}

// ========== Favorites ==========
export async function getFavorites() {
  return request('GET', '/favorites');
}

export async function toggleFavorite(petId) {
  return request('POST', `/favorites/${petId}`);
}

// ========== Carnets ==========
export async function getCarnets() {
  return request('GET', '/carnets');
}

export async function getCarnet(id) {
  return request('GET', `/carnets/${id}`);
}

// ========== Chats ==========
export async function getChats() {
  return request('GET', '/chats');
}

export async function getChatMessages(chatId) {
  return request('GET', `/chats/${chatId}/messages`);
}

export async function sendChatMessage(chatId, body) {
  return request('POST', `/chats/${chatId}/messages`, { body });
}

// ========== Notifications ==========
export async function getNotifications() {
  return request('GET', '/notifications');
}

export async function markNotificationRead(id) {
  return request('PUT', `/notifications/${id}/read`);
}

export async function markAllNotificationsRead() {
  return request('PUT', '/notifications/read-all');
}

// ========== Voluntariado (hogares de tránsito) ==========
export async function getMiHogar() {
  return request('GET', '/volunteers/me');
}

export async function ofrecerHogar(data) {
  return request('POST', '/volunteers', data);
}

export async function bajaHogar() {
  return request('DELETE', '/volunteers/me');
}

// species y size filtran por los hogares con cupo que aceptan ese animal.
export async function getHogares({ species, size } = {}) {
  const qs = new URLSearchParams();
  if (species) qs.set('species', species);
  if (size) qs.set('size', size);
  const query = qs.toString();
  return request('GET', `/volunteers${query ? `?${query}` : ''}`);
}

export async function asignarTransito(data) {
  return request('POST', '/volunteers/stays', data);
}

export async function cambiarEstadoTransito(id, status) {
  return request('PUT', `/volunteers/stays/${id}/status`, { status });
}

