<template>
  <div class="view profile-view">
    <div class="container container--narrow">
      <div v-if="!authStore.isAuthenticated" class="auth-warning">
        <div class="card text-center p-8">
          <p class="mb-4">Debes iniciar sesión para ver tu perfil.</p>
          <RouterLink to="/auth" class="btn btn-primary">Ir al Login</RouterLink>
        </div>
      </div>

      <template v-else-if="user">
        <!-- Profile Header -->
        <header class="profile-header">
          <div class="profile-avatar-wrap">
            <img v-if="user.photoURL" :src="user.photoURL" :alt="user.displayName" class="profile-avatar" />
            <div v-else class="profile-avatar profile-avatar--initials">{{ initials }}</div>
          </div>
          <div class="profile-identity">
            <h1 class="profile-name">{{ user.displayName || 'Usuario sin nombre' }}</h1>
            <p class="profile-email">{{ user.email }}</p>
            <span class="badge badge-provider">{{ providerLabel }}</span>
          </div>
        </header>

        <div class="profile-content">
          <!-- Section: Identity -->
          <section class="profile-section card">
            <h2 class="section-title">Información Personal</h2>
            <form @submit.prevent="handleUpdateProfile" class="profile-form">
              <div class="form-group">
                <label for="displayName">Nombre de usuario</label>
                <input 
                  id="displayName" 
                  v-model="editForm.displayName" 
                  type="text" 
                  class="form-input" 
                  placeholder="Tu nombre"
                />
              </div>
              <div class="form-group">
                <label>Email (no editable)</label>
                <input :value="user.email" type="email" class="form-input" disabled />
              </div>
              <button 
                type="submit" 
                class="btn btn-primary" 
                :disabled="authStore.isLoading || !isDirty"
              >
                {{ authStore.isLoading ? 'Guardando...' : 'Guardar Cambios' }}
              </button>
              <p v-if="statusMsg.text" :class="['status-msg', `status-msg--${statusMsg.type}`]">
                {{ statusMsg.text }}
              </p>
            </form>
          </section>

          <!-- Section: Favorites -->
          <section class="profile-section card">
            <h2 class="section-title">Mi Equipo y Notificaciones</h2>
            
            <!-- Notification Toggles -->
            <div class="notif-toggles mb-6">
              <p class="text-sm font-semibold mb-3">Recibir alertas de:</p>
              <div class="toggles-grid">
                <label class="toggle-item">
                  <input type="checkbox" v-model="editForm.notifs.matchStart" @change="handleSavePrefs" />
                  <span>Inicio de partido</span>
                </label>
                <label class="toggle-item">
                  <input type="checkbox" v-model="editForm.notifs.goals" @change="handleSavePrefs" />
                  <span>Goles</span>
                </label>
                <label class="toggle-item">
                  <input type="checkbox" v-model="editForm.notifs.matchEnd" @change="handleSavePrefs" />
                  <span>Resultado final</span>
                </label>
              </div>
            </div>

            <div v-if="user.preferences.favoriteClubId" class="fav-club-display mb-4">
              <div class="fav-club-info">
                <img :src="user.preferences.favoriteClubLogo" class="fav-club-logo" />
                <div>
                  <p class="fav-club-name">{{ user.preferences.favoriteClubName }}</p>
                  <p class="text-muted text-sm">Equipo principal configurado.</p>
                </div>
              </div>
              <button @click="handleRemoveFavorite" class="btn btn-ghost btn--sm text-red">Quitar</button>
            </div>

            <div class="club-search-box">
              <p class="text-sm mb-2">Buscar nuevo equipo favorito:</p>
              <div class="search-input-wrap">
                <input 
                  v-model="clubSearchQuery" 
                  type="text" 
                  class="form-input" 
                  placeholder="Ej: Real Madrid, Barcelona, City..."
                  @input="handleClubSearch"
                />
                <div v-if="isSearching" class="search-loading">Buscando...</div>
              </div>
              
              <ul v-if="searchResults.length" class="search-results-list">
                <li v-for="club in searchResults" :key="club.id" @click="handleSelectClub(club)">
                  <img :src="club.logo" class="result-logo" />
                  <span>{{ club.name }}</span>
                </li>
              </ul>
            </div>
          </section>

          <!-- Section: Preferences -->
          <section class="profile-section card">
            <h2 class="section-title">Preferencias</h2>
            <div class="prefs-grid">
              <div class="pref-item">
                <label>Tema Visual</label>
                <select v-model="editForm.theme" @change="handleSavePrefs" class="form-input">
                  <option value="dark">Oscuro (Predeterminado)</option>
                  <option value="light">Claro (Próximamente)</option>
                </select>
              </div>
              <div class="pref-item">
                <label>Idioma</label>
                <select v-model="editForm.language" @change="handleSavePrefs" class="form-input">
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </section>

          <!-- Section: Account -->
          <section class="profile-section card">
            <h2 class="section-title">Cuenta y Seguridad</h2>
            <div class="security-actions">
              <div v-if="user.providerId === 'password'">
                <p class="text-sm mb-3">¿Quieres cambiar tu contraseña? Te enviaremos un enlace a tu email.</p>
                <button @click="handleResetPassword" class="btn btn-ghost" :disabled="authStore.isLoading">
                  Enviar email de restablecimiento
                </button>
              </div>
              <div class="mt-6 pt-6 border-t">
                <button @click="authStore.logout()" class="btn btn-danger-outline btn--block">
                  Cerrar Sesión
                </button>
              </div>
            </div>
          </section>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue'
import { useAuthStore, useNotificationStore } from '@/stores'

const authStore = useAuthStore()
const notificationStore = useNotificationStore()
const user = computed(() => authStore.currentUser)

const editForm = reactive({
  displayName: user.value?.displayName || '',
  theme: user.value?.preferences.theme || 'dark',
  language: user.value?.preferences.language || 'es',
  notifs: {
    matchStart: user.value?.preferences.notifs?.matchStart ?? true,
    goals: user.value?.preferences.notifs?.goals ?? true,
    matchEnd: user.value?.preferences.notifs?.matchEnd ?? true,
  }
})

const clubSearchQuery = ref('')
const searchResults = ref<any[]>([])
const isSearching = ref(false)

const statusMsg = reactive({ text: '', type: 'success' as 'success' | 'error' })

const initials = computed(() => {
  const name = user.value?.displayName || user.value?.email || ''
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
})

const providerLabel = computed(() => {
  const p = user.value?.providerId
  if (p === 'google.com') return 'Google Account'
  if (p === 'facebook.com') return 'Facebook Account'
  return 'Email & Password'
})

const isDirty = computed(() => {
  return editForm.displayName !== (user.value?.displayName || '')
})

watch(user, (newUser) => {
  if (newUser) {
    editForm.displayName = newUser.displayName || ''
    editForm.theme = newUser.preferences.theme || 'dark'
    editForm.language = newUser.preferences.language || 'es'
  }
}, { immediate: true })

async function handleUpdateProfile() {
  try {
    await authStore.updateUserProfile(editForm.displayName)
    showMsg('¡Perfil actualizado correctamente!', 'success')
  } catch (e) {
    showMsg('Error al actualizar el perfil.', 'error')
  }
}

async function handleSavePrefs() {
  try {
    await authStore.savePreferences({
      theme: editForm.theme as any,
      language: editForm.language as any,
      notifs: editForm.notifs
    })
    showMsg('Preferencias guardadas.', 'success')
  } catch {
    showMsg('Error al guardar preferencias.', 'error')
  }
}

let searchTimeout: any = null
async function handleClubSearch() {
  if (clubSearchQuery.value.length < 3) {
    searchResults.value = []
    return
  }
  
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(async () => {
    isSearching.value = true
    try {
      const mockClubs = [
        { id: 86, name: 'Real Madrid CF', logo: 'https://crests.football-data.org/86.png' },
        { id: 81, name: 'FC Barcelona', logo: 'https://crests.football-data.org/81.png' },
        { id: 78, name: 'Atlético de Madrid', logo: 'https://crests.football-data.org/78.png' },
        { id: 65, name: 'Manchester City FC', logo: 'https://crests.football-data.org/65.png' },
        { id: 64, name: 'Liverpool FC', logo: 'https://crests.football-data.org/64.png' },
        { id: 61, name: 'Chelsea FC', logo: 'https://crests.football-data.org/61.png' },
        { id: 66, name: 'Manchester United FC', logo: 'https://crests.football-data.org/66.png' },
        { id: 524, name: 'Paris Saint-Germain FC', logo: 'https://crests.football-data.org/524.png' },
        { id: 4, name: 'FC Bayern München', logo: 'https://crests.football-data.org/4.png' },
        { id: 108, name: 'Inter Milan', logo: 'https://crests.football-data.org/108.png' },
        { id: 113, name: 'SSC Napoli', logo: 'https://crests.football-data.org/113.png' },
        { id: 98, name: 'AC Milan', logo: 'https://crests.football-data.org/98.png' },
        { id: 109, name: 'Juventus FC', logo: 'https://crests.football-data.org/109.png' },
      ]
      searchResults.value = mockClubs.filter(c => 
        c.name.toLowerCase().includes(clubSearchQuery.value.toLowerCase())
      )
    } finally {
      isSearching.value = false
    }
  }, 300)
}

async function handleSelectClub(club: any) {
  try {
    await authStore.setFavoriteClub(club.id, club.name, club.logo)
    clubSearchQuery.value = ''
    searchResults.value = []
    showMsg('¡Equipo favorito actualizado!', 'success')
    notificationStore.addNotification({
      type: 'system',
      title: 'Equipo Actualizado',
      message: `Has cambiado tu equipo favorito a ${club.name}.`
    })
  } catch {
    showMsg('Error al actualizar equipo.', 'error')
  }
}

async function handleRemoveFavorite() {
  try {
    await authStore.savePreferences({
      favoriteClubId: null as any,
      favoriteClubName: null as any,
      favoriteClubLogo: null as any
    })
    showMsg('Equipo favorito eliminado.', 'success')
  } catch {
    showMsg('Error al eliminar favorito.', 'error')
  }
}

async function handleResetPassword() {
  if (!user.value?.email) return
  try {
    await authStore.resetPassword(user.value.email)
    showMsg('Email de restablecimiento enviado.', 'success')
  } catch {
    showMsg('Error al enviar el email.', 'error')
  }
}

function showMsg(text: string, type: 'success' | 'error') {
  statusMsg.text = text
  statusMsg.type = type
  setTimeout(() => { statusMsg.text = '' }, 3000)
}
</script>

<style scoped>
.profile-view { padding-bottom: var(--space-12); }
.container--narrow { max-width: 720px; }

.profile-header {
  display: flex;
  align-items: center;
  gap: var(--space-6);
  padding: var(--space-12) 0 var(--space-8);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-8);
}

.profile-avatar {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  border: 3px solid var(--color-border-strong);
  object-fit: cover;
}

.profile-avatar--initials {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-muted);
  color: var(--color-accent);
  font-size: 1.5rem;
  font-weight: 700;
}

.profile-name { font-size: 1.75rem; line-height: 1.2; margin-bottom: 4px; }
.profile-email { color: var(--color-text-muted); font-size: 1rem; margin-bottom: var(--space-2); }

.badge-provider {
  background: var(--color-bg-elevated);
  color: var(--color-text-muted);
  font-size: 0.7rem;
  padding: 4px 10px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--space-5);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.profile-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.form-group { display: flex; flex-direction: column; gap: 6px; }
.form-group label { font-size: 0.85rem; font-weight: 500; color: var(--color-text-muted); }

.status-msg { margin-top: var(--space-3); font-size: 0.875rem; font-weight: 500; }
.status-msg--success { color: var(--color-green); }
.status-msg--error { color: var(--color-red); }

.fav-club-display {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
}

.fav-club-info { display: flex; align-items: center; gap: var(--space-4); }
.fav-club-logo { width: 48px; height: 48px; object-fit: contain; }
.fav-club-name { font-weight: 600; font-size: 1.1rem; }

.empty-fav {
  text-align: center;
  padding: var(--space-6);
  color: var(--color-text-muted);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}

.prefs-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-4);
}

.security-actions { display: flex; flex-direction: column; }
.border-t { border-top: 1px solid var(--color-border); }
.text-red { color: var(--color-red); }

.toggles-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
.toggle-item { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; cursor: pointer; }
.toggle-item input { width: 16px; height: 16px; accent-color: var(--color-accent); }

.club-search-box { position: relative; }
.search-input-wrap { position: relative; }
.search-loading { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; color: var(--color-text-muted); }

.search-results-list { 
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10; 
  background: var(--color-bg-elevated); border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-md); box-shadow: var(--shadow-lg); 
  max-height: 200px; overflow-y: auto; list-style: none; padding: 0; margin-top: 4px;
}
.search-results-list li { 
  display: flex; align-items: center; gap: 12px; padding: 10px 16px; 
  cursor: pointer; transition: background 0.2s; 
}
.search-results-list li:hover { background: var(--color-accent-muted); }
.result-logo { width: 24px; height: 24px; object-fit: contain; }

.mb-6 { margin-bottom: 24px; }
.mb-4 { margin-bottom: 16px; }
.mb-3 { margin-bottom: 12px; }
.font-semibold { font-weight: 600; }
.text-sm { font-size: 0.875rem; }

@media (max-width: 640px) {
  .profile-header { flex-direction: column; text-align: center; }
  .prefs-grid { grid-template-columns: 1fr; }
  .fav-club-display { flex-direction: column; text-align: center; }
}
</style>
