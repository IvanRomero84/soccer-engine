<template>
  <div class="view">
    <div class="container">
      <header class="live-header">
        <div class="live-header__title">
          <span class="live-dot"></span>
          <h1>Partidos en Vivo</h1>
        </div>
        <button class="btn btn-ghost btn--sm" @click="refresh" :disabled="isLoading">
          {{ isLoading ? 'Actualizando...' : '↺ Actualizar' }}
        </button>
      </header>

      <div v-if="isLoading && !matches.length" class="matches-grid">
        <div v-for="i in 6" :key="i" class="skeleton" style="height:160px;border-radius:12px"></div>
      </div>

      <div v-else-if="!matches.length" class="empty-live">
        <p class="empty-live__icon">⚽</p>
        <h2>No hay partidos en vivo ahora</h2>
        <p>Vuelve cuando haya jornada activa o revisa el calendario.</p>
        <RouterLink to="/leagues" class="btn btn-primary">Ver Ligas</RouterLink>
      </div>

      <div v-else class="matches-grid">
        <MatchCard v-for="match in matches" :key="match.id" :match="match" @click="goToMatch" />
      </div>

      <p v-if="matches.length" class="refresh-note">
        Actualización automática cada 60 segundos
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useLeagueStore } from '@/stores'
import MatchCard from '@/components/match/MatchCard.vue'
import type { Match } from '@/types'

const router = useRouter()
const leagueStore = useLeagueStore()
const matches = ref<Match[]>([])
const isLoading = ref(false)
let interval: ReturnType<typeof setInterval> | null = null

async function refresh() {
  isLoading.value = true
  try { matches.value = await leagueStore.fetchLiveMatches() }
  catch { /**/ }
  finally { isLoading.value = false }
}

function goToMatch(match: Match) { router.push(`/match/${match.id}`) }

onMounted(() => {
  refresh()
  interval = setInterval(refresh, 60_000)
})
onUnmounted(() => { if (interval) clearInterval(interval) })
</script>

<style scoped>
.live-header { display:flex;align-items:center;justify-content:space-between;padding:var(--space-8) 0 var(--space-6); }
.live-header__title { display:flex;align-items:center;gap:var(--space-3); }
.live-header__title h1 { font-size:1.75rem; }
.matches-grid { display:grid;grid-template-columns:1fr;gap:var(--space-4); }
@media(min-width:640px){.matches-grid{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1024px){.matches-grid{grid-template-columns:repeat(3,1fr);}}
.empty-live { text-align:center;padding:var(--space-16) 0;display:flex;flex-direction:column;align-items:center;gap:var(--space-4); }
.empty-live__icon { font-size:4rem; }
.empty-live h2 { font-size:1.25rem;color:var(--color-text-primary); }
.empty-live p { color:var(--color-text-muted);max-width:320px; }
.refresh-note { text-align:center;font-size:.75rem;color:var(--color-text-muted);margin-top:var(--space-6); }
.btn--sm { padding:var(--space-2) var(--space-4);font-size:.8rem; }
</style>
