<template>
  <div class="view">
    <div class="container">
      <div v-if="clubStore.isLoading && !club" class="loading-state">
        <div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:300px;border-radius:16px"></div>
      </div>

      <div v-else-if="clubStore.error && !club" class="error-state">
        <p>{{ clubStore.error }}</p>
        <button class="btn btn-ghost" @click="loadClub">Reintentar</button>
      </div>

      <template v-else-if="club">
        <!-- Club hero banner -->
        <section class="club-hero">
          <div class="club-hero__content">
            <button class="btn btn-ghost btn--sm" @click="$router.back()">← Volver</button>
            <div class="club-hero__identity">
              <div class="club-logo-wrap">
                <img :src="club.logo" :alt="club.name" class="club-logo" referrerpolicy="no-referrer" />
              </div>
              <div>
                <h1 class="club-name">{{ club.name }}</h1>
                <div class="club-meta">
                  <span>{{ club.country }}</span>
                  <span v-if="club.founded">· Fundado en {{ club.founded }}</span>
                  <span v-if="club.venue">· {{ club.venue.name }}</span>
                </div>
                <!-- Fav button -->
                <button class="btn btn-ghost btn--sm mt-3" @click="setAsFavorite" :disabled="!authStore.isAuthenticated">
                  {{ isFavorite ? '⭐ Equipo favorito' : '☆ Marcar como favorito' }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Tabs -->
        <div class="tabs">
          <button v-for="tab in tabs" :key="tab.id" class="tab" :class="{ 'tab--active': activeTab === tab.id }" @click="activeTab = tab.id">
            {{ tab.label }}
          </button>
        </div>

        <!-- Palmarés -->
        <div v-if="activeTab === 'trophies'">
          <TrophyShowcase :trophies="club.trophies ?? []" />
        </div>

        <!-- Estadísticas -->
        <div v-if="activeTab === 'stats'">
          <SeasonStats v-if="club.stats?.length || club.seasonStats" :stats="club.stats" :real-stats="club.seasonStats" />
          <p v-else class="empty-state">Sin estadísticas disponibles para esta temporada.</p>
        </div>

        <!-- Plantilla -->
        <div v-if="activeTab === 'squad'">
          <div v-if="club.squad?.length" class="squad-grid">
            <div v-for="player in club.squad" :key="player.id" class="player-card">
              <div class="player-card__img-wrap">
                <img v-if="player.photo" :src="player.photo" :alt="player.name" class="player-card__photo" loading="lazy" referrerpolicy="no-referrer" />
                <div v-else class="player-card__photo-placeholder">{{ player.name.charAt(0) }}</div>
                <div v-if="player.rating" class="player-card__rating" :class="ratingClass(Number(player.rating))">
                  {{ Number(player.rating).toFixed(1) }}
                </div>
              </div>
              <div class="player-card__info">
                <div class="player-card__top">
                  <span v-if="player.number" class="player-card__num">#{{ player.number }}</span>
                  <span v-if="player.injured" class="badge badge-live">Lesión</span>
                </div>
                <p class="player-card__name">{{ player.name }}</p>
                <p class="player-card__pos">{{ translatePosition(player.position) }}</p>
                
                <div v-if="player.detailedStats" class="player-card__stats">
                  <template v-if="player.detailedStats.cleanSheets !== undefined">
                    <span title="Porterías a cero">🧤 {{ player.detailedStats.cleanSheets }}</span>
                    <span title="Goles encajados">⚽ {{ player.detailedStats.goalsConceded }}</span>
                  </template>
                  <template v-else>
                    <span v-if="player.detailedStats.goals > 0" title="Goles">⚽ {{ player.detailedStats.goals }}</span>
                    <span v-if="player.detailedStats.assists > 0" title="Asistencias">👟 {{ player.detailedStats.assists }}</span>
                  </template>
                  <span v-if="player.detailedStats.yellowCards > 0" title="Tarjetas amarillas">🟨 {{ player.detailedStats.yellowCards }}</span>
                </div>

                <p v-if="player.marketValue" class="player-card__value">{{ player.marketValue }}</p>
              </div>
            </div>
          </div>
          <p v-else class="empty-state">Plantilla no disponible.</p>
        </div>

        <!-- Entrenador -->
        <div v-if="activeTab === 'coach'">
          <div v-if="club.coach" class="info-card info-card--coach">
            <div class="info-card__image-wrap">
              <img v-if="club.coach.photo" :src="club.coach.photo" :alt="club.coach.name" class="info-card__image" />
              <div v-else class="info-card__placeholder">👤</div>
            </div>
            <div class="info-card__content">
              <h3 class="info-card__title">{{ club.coach.name }}</h3>
              <p class="info-card__detail"><strong>Edad:</strong> {{ club.coach.age }} años</p>
              <p class="info-card__detail"><strong>Rol:</strong> Director Técnico</p>
            </div>
          </div>
          <p v-else class="empty-state">Información del entrenador no disponible.</p>
        </div>

        <!-- Estadio -->
        <div v-if="activeTab === 'venue'">
          <div v-if="club.venue" class="info-card info-card--venue">
            <div class="info-card__image-wrap info-card__image-wrap--venue">
              <img v-if="club.venue.image" :src="club.venue.image" :alt="club.venue.name" class="info-card__image" />
              <div v-else class="info-card__placeholder">🏟️</div>
            </div>
            <div class="info-card__content">
              <h3 class="info-card__title">{{ club.venue.name }}</h3>
              <p v-if="club.venue.city" class="info-card__detail"><strong>Ciudad:</strong> {{ club.venue.city }}</p>
              <p v-if="club.venue.capacity" class="info-card__detail"><strong>Capacidad:</strong> {{ club.venue.capacity }} espectadores</p>
              <p v-if="club.venue.yearBuilt" class="info-card__detail"><strong>Inaugurado:</strong> {{ club.venue.yearBuilt }}</p>
              <p v-if="club.venue.pitchSize" class="info-card__detail"><strong>Terreno:</strong> {{ club.venue.pitchSize }}</p>
              <p v-if="club.venue.surface" class="info-card__detail"><strong>Césped:</strong> {{ club.venue.surface }}</p>
              <p v-if="club.venue.address" class="info-card__detail"><strong>Dirección:</strong> {{ club.venue.address }}</p>
            </div>
          </div>
          <p v-else class="empty-state">Información del estadio no disponible.</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useClubStore, useAuthStore, useNotificationStore } from '@/stores'
import TrophyShowcase from '@/components/club/TrophyShowcase.vue'
import SeasonStats from '@/components/club/SeasonStats.vue'

const props = defineProps<{ id: string }>()
const clubStore = useClubStore()
const authStore = useAuthStore()
const notificationStore = useNotificationStore()

const activeTab = ref<'trophies' | 'stats' | 'squad' | 'coach' | 'venue'>('trophies')
const tabs = [
  { id: 'trophies' as const, label: '🏆 Palmarés' },
  { id: 'stats' as const, label: '📊 Stats' },
  { id: 'squad' as const, label: '👥 Plantilla' },
  { id: 'coach' as const, label: '👔 Entrenador' },
  { id: 'venue' as const, label: '🏟️ Campo' },
]

const parsedId = computed(() => isNaN(Number(props.id)) ? props.id : Number(props.id))
const club = computed(() => clubStore.clubCache.get(parsedId.value)?.data ?? null)
const isFavorite = computed(() => {
  if (!authStore.favoriteClubId || !parsedId.value) return false
  return Number(authStore.favoriteClubId) === Number(parsedId.value)
})

async function loadClub() {
  await clubStore.fetchClub(parsedId.value)
}

async function setAsFavorite() {
  if (!club.value || !authStore.isAuthenticated) return
  try {
    await authStore.setFavoriteClub(club.value.id, club.value.name, club.value.logo)
    notificationStore.addNotification({
      type: 'system',
      title: 'Equipo Favorito',
      message: `Has marcado al ${club.value.name} como tu equipo favorito.`
    })
  } catch (e) {
    console.error(e)
  }
}

function translatePosition(pos: string) {
  const map: Record<string, string> = {
    Goalkeeper: 'Portero', Defender: 'Defensa', Midfielder: 'Centrocampista', Attacker: 'Delantero',
  }
  return map[pos] ?? pos
}

function ratingClass(r: number) {
  if (r >= 7.5) return 'rating--high'
  if (r >= 6.5) return 'rating--mid'
  return 'rating--low'
}

watch(() => props.id, loadClub)
onMounted(loadClub)
</script>

<style scoped>
.club-hero { padding:var(--space-8) 0 0; }
.club-hero__content { display:flex;flex-direction:column;gap:var(--space-4); }
.club-hero__identity { display:flex;align-items:flex-start;gap:var(--space-6);flex-wrap:wrap; }
.club-logo-wrap { width:96px;height:96px;display:flex;align-items:center;justify-content:center;background:var(--color-bg-elevated);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-3);flex-shrink:0; }
.club-logo { width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5)); }
.club-name { font-size:clamp(1.5rem,4vw,2.5rem);margin-bottom:var(--space-2); }
.club-meta { display:flex;flex-wrap:wrap;gap:var(--space-2);font-size:.85rem;color:var(--color-text-muted);margin-bottom:var(--space-3); }
.mt-3 { margin-top:var(--space-3); }
.tabs { display:flex;gap:var(--space-1);margin:var(--space-6) 0;border-bottom:1px solid var(--color-border);padding-bottom:0;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none; }
.tabs::-webkit-scrollbar { display:none; }
.tab { padding:var(--space-3) var(--space-5);font-size:.875rem;font-weight:500;color:var(--color-text-muted);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all var(--transition-fast);margin-bottom:-1px;white-space:nowrap; }
.tab:hover { color:var(--color-text-primary); }
.tab--active { color:var(--color-accent);border-bottom-color:var(--color-accent); }
.squad-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:var(--space-3); }
@media (max-width: 480px) {
  .squad-grid { grid-template-columns: repeat(2, 1fr); }
}
.player-card { background:var(--color-bg-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;transition:all var(--transition-base);display:flex;flex-direction:column; }
.player-card:hover { border-color:var(--color-border-strong);transform:translateY(-2px);box-shadow:var(--shadow-md); }
.player-card__img-wrap { position:relative;width:100%;aspect-ratio:1;background:var(--color-bg-elevated); }
.player-card__photo { width:100%;height:100%;object-fit:cover;object-position:top;filter:grayscale(10%);transition:filter var(--transition-base); }
.player-card:hover .player-card__photo { filter:grayscale(0); }
.player-card__photo-placeholder { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:3rem;font-weight:800;color:var(--color-text-muted);background:var(--color-bg-elevated); }
.player-card__info { padding:var(--space-3);flex:1;display:flex;flex-direction:column;gap:2px; }
.player-card__top { display:flex;justify-content:space-between;align-items:center;margin-bottom:2px; }
.player-card__num { font-family:var(--font-mono);font-size:.65rem;color:var(--color-accent);font-weight:700; }
.player-card__name { font-size:.85rem;font-weight:600;color:var(--color-text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.player-card__pos { font-size:.7rem;color:var(--color-text-muted); }
.player-card__stats { display:flex;gap:var(--space-2);margin-top:var(--space-2);font-size:.7rem;font-weight:600;color:var(--color-text-secondary);background:var(--color-bg-elevated);padding:4px 8px;border-radius:var(--radius-sm);width:fit-content; }
.player-card__stats span { display:flex;align-items:center;gap:2px; }
.player-card__value { font-family:var(--font-mono);font-size:.75rem;color:var(--color-amber);font-weight:600;margin-top:auto;padding-top:var(--space-2); }
.player-card__rating { position:absolute;bottom:var(--space-2);right:var(--space-2);width:32px;height:32px;border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:.75rem;font-weight:800;border:2px solid;backdrop-filter:blur(4px);z-index:2; }
.rating--high { background:rgba(34,197,94,0.2);color:var(--color-green);border-color:var(--color-green); }
.rating--mid { background:rgba(245,158,11,0.2);color:var(--color-amber);border-color:var(--color-amber); }
.rating--low { background:rgba(239,68,68,0.2);color:var(--color-red);border-color:var(--color-red); }
.loading-state,.empty-state,.error-state { padding:var(--space-10) 0; }
.empty-state { text-align:center;color:var(--color-text-muted); }

/* Info Cards (Coach & Venue) */
.info-card { display:flex;gap:var(--space-6);background:var(--color-bg-surface);border:1px solid var(--color-border);border-radius:var(--radius-xl);overflow:hidden;padding:var(--space-6);align-items:center; }
.info-card__image-wrap { width:150px;height:150px;border-radius:var(--radius-lg);overflow:hidden;background:var(--color-bg-elevated);flex-shrink:0; }
.info-card__image-wrap--venue { width:240px;height:160px; }
.info-card__image { width:100%;height:100%;object-fit:cover; }
.info-card__placeholder { width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:4rem;background:var(--color-bg-elevated); }
.info-card__content { flex:1; }
.info-card__title { font-size:1.5rem;font-weight:700;margin-bottom:var(--space-2);color:var(--color-accent); }
.info-card__detail { font-size:0.9rem;color:var(--color-text-secondary);margin-bottom:4px; }
.info-card__detail strong { color:var(--color-text-primary); }

@media (max-width: 640px) {
  .info-card { flex-direction:column;align-items:flex-start; }
  .info-card__image-wrap--venue { width:100%; }
}
.error-state { display:flex;flex-direction:column;align-items:center;gap:var(--space-4);color:var(--color-text-muted); }
.btn--sm { padding:var(--space-2) var(--space-4);font-size:.8rem; }
</style>
