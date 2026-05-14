<template>
  <div class="view home-view">
    <div class="container">
      <header class="home-hero">
        <p class="home-hero__eyebrow"><span class="live-dot-inline"></span>Bienvenido al Engine</p>
        <h1 class="home-hero__title">Tu radar de <em class="text-accent">fútbol</em> global</h1>
        <p class="home-hero__sub">Estadísticas avanzadas, clasificaciones en tiempo real y análisis táctico.</p>
        <div class="home-hero__chips">
          <RouterLink to="/live" class="chip chip--live"><span class="live-dot"></span>En Vivo</RouterLink>
          <RouterLink to="/leagues" class="chip">🏆 Ligas</RouterLink>
          <RouterLink v-if="authStore.favoriteClubId" :to="`/club/${authStore.favoriteClubId}`" class="chip chip--fav">⭐ Mi Equipo</RouterLink>
        </div>
      </header>

      <!-- Portadas de periódicos -->
      <NewsCovers />

      <div class="home-grid">
        <section aria-label="Noticias">
          <div class="section-header">
            <h2 class="section-title">Últimas Noticias</h2>
          </div>
          
          <div v-if="newsStore.isLoading" class="news-list-skeleton">
            <div class="skeleton" style="height:360px;width:100%;margin-bottom:16px;border-radius:12px"></div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
              <div v-for="i in 4" :key="i" class="skeleton" style="height:280px;border-radius:12px"></div>
            </div>
          </div>
          
          <div v-else-if="newsStore.error" class="error-state">
            <p>{{ newsStore.error }}</p>
            <button class="btn btn-ghost" @click="loadNews">Reintentar</button>
          </div>
          
          <NewsFeed v-else :articles="newsStore.articles" />
        </section>

        <aside class="home-sidebar">
          <template v-if="authStore.isAuthenticated">
            <div v-if="favoriteClubData" class="fav-club-card">
              <p class="fav-club-card__label">Tu equipo</p>
              <RouterLink :to="`/club/${favoriteClubData.id}`" class="fav-club-card__link">
                <img v-if="favoriteClubData.logo" :src="favoriteClubData.logo" :alt="favoriteClubData.name" class="fav-club-card__logo" />
                <span class="fav-club-card__name">{{ favoriteClubData.name }}</span>
                <span class="fav-club-card__arrow">→</span>
              </RouterLink>
            </div>
            <div v-else class="fav-club-card fav-club-card--empty">
              <p>Configura tu equipo favorito</p>
              <RouterLink to="/leagues" class="btn btn-ghost btn--sm">Explorar Clubes</RouterLink>
            </div>
          </template>
          <div class="quick-leagues card">
            <h3 class="quick-leagues__title">Ligas Populares</h3>
            <div class="quick-leagues__list">
              <RouterLink v-for="l in popularLeagues" :key="l.id" :to="`/leagues/${l.id}`" class="quick-league-item">
                <img :src="l.logo" :alt="l.name" class="quick-league-logo" /><span>{{ l.name }}</span>
              </RouterLink>
            </div>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useNewsStore, useAuthStore } from '@/stores'
import NewsFeed from '@/components/news/NewsFeed.vue'
import NewsCovers from '@/components/news/NewsCovers.vue'

const newsStore = useNewsStore()
const authStore = useAuthStore()

const favoriteClubData = computed(() => {
  const prefs = authStore.currentUser?.preferences
  if (!prefs || !prefs.favoriteClubId) return null
  
  return {
    id: prefs.favoriteClubId,
    name: prefs.favoriteClubName,
    logo: prefs.favoriteClubLogo
  }
})

const popularLeagues = [
  { id: 'PL', name: 'Premier League', logo: 'https://api.sofascore.app/api/v1/unique-tournament/17/image' },
  { id: 'PD', name: 'La Liga', logo: 'https://api.sofascore.app/api/v1/unique-tournament/8/image' },
  { id: 'SA', name: 'Serie A', logo: 'https://api.sofascore.app/api/v1/unique-tournament/23/image' },
  { id: 'BL1', name: 'Bundesliga', logo: 'https://api.sofascore.app/api/v1/unique-tournament/35/image' },
  { id: 'FL1', name: 'Ligue 1', logo: 'https://api.sofascore.app/api/v1/unique-tournament/34/image' },
]

let refreshInterval: any = null

async function loadNews(force = false) { 
  try { await newsStore.fetchAllNews(force) } catch { /**/ } 
}

onMounted(() => {
  loadNews()
  // Refresh cada 5 minutos
  refreshInterval = setInterval(() => {
    loadNews(true) // Force refresh
  }, 5 * 60 * 1000)
})

onUnmounted(() => {
  if (refreshInterval) clearInterval(refreshInterval)
})
</script>

<style scoped>
.home-hero { padding: var(--space-10) 0 var(--space-8); overflow-x: hidden; }
.home-hero__eyebrow { display:flex;align-items:center;gap:var(--space-2);font-size:.8rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--color-accent);margin-bottom:var(--space-3); }
.live-dot-inline { width:8px;height:8px;border-radius:50%;background:var(--color-accent);display:inline-block;animation:pulse-dot 2s infinite; }
.home-hero__title { font-size:clamp(2rem,5vw,3.5rem);line-height:1.1;margin-bottom:var(--space-4); word-wrap: break-word; }
.home-hero__title em { font-style:normal; }
.home-hero__sub { font-size:1.05rem;max-width:480px;margin-bottom:var(--space-6); }
.home-hero__chips { display:flex;flex-wrap:wrap;gap:var(--space-2); }
.chip { display:inline-flex;align-items:center;gap:var(--space-2);padding:var(--space-2) var(--space-4);border-radius:var(--radius-full);font-size:.85rem;font-weight:500;background:var(--color-bg-elevated);border:1px solid var(--color-border);color:var(--color-text-secondary);text-decoration:none;transition:all var(--transition-fast); }
.chip:hover { border-color:var(--color-accent);color:var(--color-accent);background:var(--color-accent-muted); }
.chip--live { border-color:rgba(239,68,68,.4);color:var(--color-red);background:var(--color-red-muted); }
.chip--fav { border-color:rgba(245,158,11,.4);color:var(--color-amber);background:var(--color-amber-muted); }

.home-grid { display:grid;grid-template-columns:1fr;gap:var(--space-8); }
.home-sidebar { order: -1; }
@media(min-width:1024px){
  .home-grid{grid-template-columns:1fr 320px;}
  .home-sidebar { order: 1; }
}

.section-header { display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-5); }
.section-title { font-size:1.1rem; }

.home-sidebar { display:flex;flex-direction:column;gap:var(--space-4); }
.fav-club-card { background:linear-gradient(135deg,var(--color-bg-elevated),var(--color-bg-overlay));border:1px solid var(--color-border-strong);border-radius:var(--radius-lg);padding:var(--space-4); }
.fav-club-card__label { font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-2); }
.fav-club-card__link { display:flex;align-items:center;gap:var(--space-3);text-decoration:none;color:var(--color-text-primary); }
.fav-club-card__logo { width:40px;height:40px;object-fit:contain; }
.fav-club-card__name { font-weight:600;flex:1; }
.fav-club-card__arrow { color:var(--color-accent);transition:transform var(--transition-fast); }
.fav-club-card__link:hover .fav-club-card__arrow { transform:translateX(4px); }
.fav-club-card--empty { text-align:center;display:flex;flex-direction:column;align-items:center;gap:var(--space-3);color:var(--color-text-muted);font-size:.875rem; }

.quick-leagues__title { font-size:.875rem;margin-bottom:var(--space-3); }
.quick-leagues__list { display:flex;flex-direction:column;gap:var(--space-1); }
.quick-league-item { display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);color:var(--color-text-secondary);font-size:.875rem;text-decoration:none;transition:all var(--transition-fast); }
.quick-league-item:hover { background:var(--color-accent-muted);color:var(--color-text-primary); }
.quick-league-logo { width:24px;height:24px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2)); }

.error-state { display:flex;flex-direction:column;align-items:center;gap:var(--space-4);padding:var(--space-12) 0;color:var(--color-text-muted); }
.btn--sm { padding:var(--space-2) var(--space-4);font-size:.8rem; }
</style>
