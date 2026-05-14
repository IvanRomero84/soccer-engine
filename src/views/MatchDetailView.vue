<template>
  <div class="view">
    <div class="container">
      <div v-if="isLoading && !match" class="loading-state">
        <div class="skeleton" style="height:160px;border-radius:16px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:200px;border-radius:16px;margin-bottom:16px"></div>
        <div class="skeleton" style="height:140px;border-radius:16px"></div>
      </div>

      <template v-else-if="match">
        <button class="btn btn-ghost btn--sm back-btn" @click="$router.back()">← Volver</button>

        <!-- Match header -->
        <section class="match-header">
          <div class="match-header__league">
            <img v-if="match.leagueLogo" :src="match.leagueLogo" :alt="match.leagueName" class="mh-league-logo" />
            <span>{{ match.leagueName }} · {{ match.round }}</span>
            <span v-if="isLive" class="badge badge-live ml">{{ match.elapsed }}'</span>
          </div>

          <div class="match-header__teams">
            <div class="mh-team mh-team--home">
              <img :src="match.homeTeam.logo" :alt="match.homeTeam.name" class="mh-team-logo" />
              <h2 class="mh-team-name">{{ match.homeTeam.name }}</h2>
            </div>

            <div class="mh-scoreboard">
              <div v-if="hasScore" class="mh-score">
                <span :class="{ 'score-winner': homeWon }">{{ match.goals.home }}</span>
                <span class="mh-sep">–</span>
                <span :class="{ 'score-winner': awayWon }">{{ match.goals.away }}</span>
              </div>
              <div v-else class="mh-time">
                <span class="mh-kickoff">{{ kickoffTime }}</span>
                <span class="mh-date">{{ kickoffDate }}</span>
              </div>
              <p class="mh-status">{{ match.statusLong }}</p>
            </div>

            <div class="mh-team mh-team--away">
              <img :src="match.awayTeam.logo" :alt="match.awayTeam.name" class="mh-team-logo" />
              <h2 class="mh-team-name">{{ match.awayTeam.name }}</h2>
            </div>
          </div>
        </section>

        <!-- Pressure Momentum (the engine piece) -->
        <PressureMomentum :match="match" :elapsed="match.elapsed" />

        <!-- Stats -->
        <MatchStats
          v-if="match.statistics?.length === 2"
          :home="match.statistics[0]"
          :away="match.statistics[1]"
        />

        <!-- Events timeline -->
        <section v-if="match.events?.length" class="timeline card">
          <h3 class="timeline__title">Timeline de Eventos</h3>
          <div class="events-list">
            <div v-for="(ev, i) in match.events" :key="i" class="event-item" :class="ev.teamId === match.homeTeam.id ? 'event-item--home' : 'event-item--away'">
              <span class="event-item__min">{{ ev.time }}'</span>
              <span class="event-item__icon">{{ eventIcon(ev.type, ev.detail) }}</span>
              <div class="event-item__text">
                <span class="event-item__player">{{ ev.player }}</span>
                <span v-if="ev.assist" class="event-item__assist">↳ {{ ev.assist }}</span>
              </div>
            </div>
          </div>
        </section>
      </template>

      <div v-else class="error-state">
        <p>Partido no encontrado.</p>
        <button class="btn btn-ghost" @click="$router.back()">Volver</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { fetchFromFootballDataOrg } from '@/services/api'
import PressureMomentum from '@/components/match/PressureMomentum.vue'
import MatchStats from '@/components/match/MatchStats.vue'
import type { Match } from '@/types'

const props = defineProps<{ id: string }>()
const match = ref<Match | null>(null)
const isLoading = ref(false)
let refreshInterval: ReturnType<typeof setInterval> | null = null

const LIVE = new Set(['1H','HT','2H','ET','P','LIVE'])
const FINISHED = new Set(['FT','AET','PEN'])
const isLive = computed(() => LIVE.has(match.value?.status ?? ''))
const hasScore = computed(() => match.value?.goals.home !== null)
const homeWon = computed(() => FINISHED.has(match.value?.status ?? '') && (match.value?.goals.home ?? 0) > (match.value?.goals.away ?? 0))
const awayWon = computed(() => FINISHED.has(match.value?.status ?? '') && (match.value?.goals.away ?? 0) > (match.value?.goals.home ?? 0))
const kickoffTime = computed(() => new Date(match.value?.date ?? '').toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
const kickoffDate = computed(() => new Date(match.value?.date ?? '').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }))


import type { FDMatch } from '@/types/api'

function mapFixtureStatus(status: string): Match['status'] {
  const s = status?.toUpperCase() || ''
  if (['SCHEDULED', 'TIMED'].includes(s)) return 'NS'
  if (['IN_PLAY', 'PAUSED'].includes(s)) return 'LIVE'
  if (['FINISHED'].includes(s)) return 'FT'
  if (['POSTPONED'].includes(s)) return 'PST'
  if (['SUSPENDED', 'CANCELLED', 'AWARDED'].includes(s)) return 'CANC'
  return 'NS'
}

async function loadMatch() {
  isLoading.value = true
  try {
    const f = await fetchFromFootballDataOrg<FDMatch>(`/matches/${props.id}`)
    if (!f) return
    
    match.value = {
      id: f.id, 
      referee: undefined, 
      date: f.utcDate,
      timestamp: new Date(f.utcDate).getTime(), 
      timezone: 'UTC',
      leagueId: f.competition?.id || 0, 
      leagueName: f.competition?.name || '', 
      leagueLogo: f.competition?.emblem || '',
      leagueCountry: '', 
      season: new Date(f.utcDate).getFullYear(), 
      round: '',
      homeTeam: { id: f.homeTeam.id, name: f.homeTeam.shortName || f.homeTeam.name, logo: f.homeTeam.crest }, 
      awayTeam: { id: f.awayTeam.id, name: f.awayTeam.shortName || f.awayTeam.name, logo: f.awayTeam.crest },
      status: mapFixtureStatus(f.status),
      statusLong: f.status, 
      elapsed: f.minute || undefined,
      goals: { home: f.score?.fullTime?.home ?? null, away: f.score?.fullTime?.away ?? null }, 
      score: {
        halftime: { home: f.score?.halfTime?.home ?? null, away: f.score?.halfTime?.away ?? null },
        fulltime: { home: f.score?.fullTime?.home ?? null, away: f.score?.fullTime?.away ?? null },
        extratime: { home: null, away: null },
        penalty: { home: null, away: null }
      }, 
      events: [], 
      statistics: undefined, 
    }
  } catch (e) {
    console.warn('Error loading match', e)
  } finally {
    isLoading.value = false
  }
}

function eventIcon(type: string, detail: string) {
  if (type === 'Goal') return detail === 'Own Goal' ? '⚽🔴' : '⚽'
  if (type === 'Card') return detail === 'Red Card' ? '🟥' : '🟨'
  if (type === 'Subst') return '🔄'
  return '📋'
}

onMounted(async () => {
  await loadMatch()
  if (isLive.value) {
    refreshInterval = setInterval(loadMatch, 30_000)
  }
})
onUnmounted(() => { if (refreshInterval) clearInterval(refreshInterval) })
</script>

<style scoped>
.back-btn { margin-top:var(--space-6);margin-bottom:var(--space-4); }
.match-header { background:linear-gradient(135deg,var(--color-bg-elevated),var(--color-bg-overlay));border:1px solid var(--color-border);border-radius:var(--radius-xl);padding:var(--space-6);margin-bottom:var(--space-5); }
.match-header__league { display:flex;align-items:center;gap:var(--space-2);font-size:.8rem;color:var(--color-text-muted);margin-bottom:var(--space-5); }
.mh-league-logo { width:20px;height:20px;object-fit:contain; }
.ml { margin-left:var(--space-2); }
.match-header__teams { display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:var(--space-4); }
.mh-team { display:flex;flex-direction:column;align-items:center;gap:var(--space-3); }
.mh-team--home { align-items:flex-end;text-align:right; }
.mh-team--away { align-items:flex-start;text-align:left; }
.mh-team-logo { width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,.5)); }
.mh-team-name { font-size:clamp(.9rem,2.5vw,1.25rem);font-weight:700; }
.mh-scoreboard { display:flex;flex-direction:column;align-items:center;gap:var(--space-2); }
.mh-score { font-family:var(--font-display);font-size:clamp(2rem,6vw,4rem);font-weight:800;display:flex;align-items:center;gap:var(--space-3);line-height:1; }
.mh-sep { color:var(--color-text-muted);font-weight:300; }
.score-winner { color:var(--color-green); }
.mh-time { display:flex;flex-direction:column;align-items:center; }
.mh-kickoff { font-family:var(--font-display);font-size:2rem;font-weight:700;color:var(--color-accent); }
.mh-date { font-size:.75rem;color:var(--color-text-muted); }
.mh-status { font-size:.75rem;color:var(--color-text-muted); }
.timeline { margin-top:var(--space-5); }
.timeline__title { font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:var(--color-text-muted);margin-bottom:var(--space-4); }
.events-list { display:flex;flex-direction:column;gap:var(--space-2); }
.event-item { display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg-elevated); }
.event-item--home { flex-direction:row; }
.event-item--away { flex-direction:row-reverse; }
.event-item__min { font-family:var(--font-mono);font-size:.75rem;color:var(--color-text-muted);width:28px;text-align:center;flex-shrink:0; }
.event-item__icon { font-size:1rem; }
.event-item__text { display:flex;flex-direction:column;gap:2px; }
.event-item__player { font-size:.85rem;font-weight:600;color:var(--color-text-primary); }
.event-item__assist { font-size:.75rem;color:var(--color-text-muted); }
.loading-state { padding:var(--space-8) 0; }
.error-state { display:flex;flex-direction:column;align-items:center;gap:var(--space-4);padding:var(--space-12) 0;color:var(--color-text-muted); }
.btn--sm { padding:var(--space-2) var(--space-4);font-size:.8rem; }
</style>
