<template>
  <div class="view">
    <div class="container">
      <div class="league-detail-header">
        <button class="btn btn-ghost btn--sm" @click="$router.back()">← Volver</button>
        <div v-if="standings" class="league-info">
          <img v-if="standings.leagueLogo" :src="standings.leagueLogo" :alt="standings.leagueName" class="league-logo" />
          <div>
            <h1 class="league-name">{{ standings.leagueName }}</h1>
            <div class="season-selector-wrap">
              <span class="text-muted">Temporada:</span>
              <select v-model="leagueStore.selectedSeason" class="season-select" @change="onSeasonChange">
                <option v-for="y in availableYears" :key="y" :value="y">
                  {{ y }}/{{ y + 1 }}
                </option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tabs" role="tablist">
        <button v-for="tab in tabs" :key="tab.id" :id="`tab-${tab.id}`" class="tab" :class="{ 'tab--active': activeTab === tab.id }" role="tab" :aria-selected="activeTab === tab.id" @click="activeTab = tab.id">
          {{ tab.label }}
        </button>
      </div>

      <!-- Standings -->
      <div v-if="activeTab === 'standings'" role="tabpanel" :aria-labelledby="'tab-standings'">
        <div v-if="leagueStore.isLoading" class="loading-state">
          <div v-for="i in 10" :key="i" class="skeleton" style="height:44px;margin-bottom:4px;border-radius:8px"></div>
        </div>
        <div v-else-if="leagueStore.error" class="error-state">
          <p>{{ leagueStore.error }}</p>
          <button class="btn btn-ghost" @click="loadStandings">Reintentar</button>
        </div>
        <div v-else-if="standings" class="table-wrapper">
          <table class="table standings-table">
            <thead>
              <tr>
                <th>#</th><th colspan="2">Equipo</th>
                <th title="Jugados">PJ</th><th title="Victorias">G</th>
                <th title="Empates">E</th><th title="Derrotas">P</th>
                <th title="Goles a favor">GF</th><th title="Goles en contra">GC</th>
                <th title="Diferencia de goles">DG</th><th title="Puntos">Pts</th>
                <th title="Forma">Forma</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in standings.standings[0]" :key="entry.teamId" class="standings-row" @click="$router.push(`/club/${entry.teamId}`)">
                <td class="rank-cell">
                  <span class="rank" :class="rankClass(entry.rank)">{{ entry.rank }}</span>
                </td>
                <td class="logo-cell">
                  <img :src="entry.teamLogo" :alt="entry.teamName" class="team-logo-sm" loading="lazy" />
                </td>
                <td class="name-cell">
                  <span class="team-name-link">{{ entry.teamName }}</span>
                </td>
                <td>{{ entry.all.played }}</td>
                <td class="text-green">{{ entry.all.win }}</td>
                <td class="text-amber">{{ entry.all.draw }}</td>
                <td class="text-red">{{ entry.all.lose }}</td>
                <td>{{ entry.all.goalsFor }}</td>
                <td>{{ entry.all.goalsAgainst }}</td>
                <td :class="entry.goalsDiff > 0 ? 'text-green' : entry.goalsDiff < 0 ? 'text-red' : ''">
                  {{ entry.goalsDiff > 0 ? '+' : '' }}{{ entry.goalsDiff }}
                </td>
                <td class="pts-cell">{{ entry.points }}</td>
                <td class="form-cell">
                  <div class="form-mini">
                    <span v-for="(r, i) in (entry.form ?? '').split('').slice(-5)" :key="i" :class="['form-dot', `form-dot--${r.toLowerCase()}`]"></span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Fixtures -->
      <div v-if="activeTab === 'fixtures'" role="tabpanel" :aria-labelledby="'tab-fixtures'">
        <div v-if="leagueStore.isLoading" class="loading-state">
          <div v-for="i in 6" :key="i" class="skeleton" style="height:120px;margin-bottom:8px;border-radius:12px"></div>
        </div>
        <div v-else-if="!leagueStore.currentFixtures.length" class="empty-state">
          <p>No hay próximos partidos disponibles.</p>
        </div>
        <div v-else class="fixtures-grid">
          <MatchCard v-for="match in leagueStore.currentFixtures" :key="match.id" :match="match" @click="goToMatch" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLeagueStore } from '@/stores'
import MatchCard from '@/components/match/MatchCard.vue'
import type { Match } from '@/types'

const props = defineProps<{ id: string }>()
const router = useRouter()
const leagueStore = useLeagueStore()

const activeTab = ref<'standings' | 'fixtures'>('standings')
const tabs = [
  { id: 'standings' as const, label: 'Clasificación' },
  { id: 'fixtures' as const, label: 'Próximos Partidos' },
]

const parsedId = computed(() => isNaN(Number(props.id)) ? props.id : Number(props.id))
const standings = computed(() => leagueStore.standingsCache.get(parsedId.value) ?? null)
const availableYears = [2026, 2025, 2024, 2023, 2022, 2021]

async function loadStandings() {
  leagueStore.selectedLeagueId = parsedId.value
  await leagueStore.fetchStandings(parsedId.value)
}

async function loadFixtures() {
  leagueStore.selectedLeagueId = parsedId.value
  await leagueStore.fetchUpcomingFixtures(parsedId.value)
}

async function onSeasonChange() {
  leagueStore.clearAllCache()
  await loadStandings()
  if (activeTab.value === 'fixtures') await loadFixtures()
}

function goToMatch(match: Match) {
  router.push(`/match/${match.id}`)
}

function rankClass(rank: number) {
  if (rank <= 4) return 'rank--champions'
  if (rank <= 6) return 'rank--europa'
  if (rank >= 18) return 'rank--relegation'
  return ''
}

watch(activeTab, (tab) => {
  if (tab === 'fixtures') loadFixtures()
})

watch(() => props.id, loadStandings)
onMounted(loadStandings)
</script>

<style scoped>
.league-detail-header { display:flex;align-items:flex-start;flex-wrap:wrap;gap:var(--space-4);padding:var(--space-8) 0 var(--space-5); }
.league-info { display:flex;align-items:center;gap:var(--space-4); }
.league-logo { width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(0,0,0,.5)); }
.league-name { font-size:1.5rem; margin-bottom: 2px; }
.season-selector-wrap { display: flex; align-items: center; gap: var(--space-2); font-size: 0.85rem; }
.season-select { background: var(--color-bg-elevated); color: var(--color-text-primary); border: 1px solid var(--color-border); border-radius: var(--radius-md); padding: 2px 8px; font-size: 0.85rem; cursor: pointer; outline: none; transition: border-color var(--transition-fast); }
.season-select:focus { border-color: var(--color-accent); }
.tabs { display:flex;gap:var(--space-1);margin-bottom:var(--space-6);border-bottom:1px solid var(--color-border);padding-bottom:0; }
.tab { padding:var(--space-3) var(--space-5);font-size:.875rem;font-weight:500;color:var(--color-text-muted);background:none;border:none;border-bottom:2px solid transparent;cursor:pointer;transition:all var(--transition-fast);margin-bottom:-1px; }
.tab:hover { color:var(--color-text-primary); }
.tab--active { color:var(--color-accent);border-bottom-color:var(--color-accent); }
.table-wrapper { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; }
.standings-table { font-size:.82rem; min-width: 600px; }
.standings-table th { text-align:center; }
.standings-table td { text-align:center; }
.name-cell,.standings-table th:nth-child(3) { text-align:left; }
.standings-row { cursor:pointer;transition:background var(--transition-fast); }
.standings-row:hover td { background:var(--color-accent-muted) !important; }
.rank-cell { width:30px; }
.logo-cell { width:52px; min-width:52px; padding-right:8px; }
.rank { display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:.7rem;font-weight:700; }
.rank--champions { background:var(--color-accent-muted);color:var(--color-accent); }
.rank--europa { background:var(--color-green-muted);color:var(--color-green); }
.rank--relegation { background:var(--color-red-muted);color:var(--color-red); }
.team-logo-sm { width:36px;height:36px;min-width:36px;object-fit:contain;margin:0 auto;filter:drop-shadow(0 2px 4px rgba(0,0,0,.2));flex-shrink:0; }
.team-name-link { font-weight:500;color:var(--color-text-primary); }
.pts-cell { font-weight:700;color:var(--color-text-primary); }
.hide-mobile { display:none; }
@media(min-width:768px){.hide-mobile{display:table-cell;}}
.form-mini { display:flex;gap:3px;justify-content:center; min-width: 60px; }
.form-dot { width:7px;height:7px;border-radius:50%; flex-shrink: 0; }
.form-dot--w { background:var(--color-green); }
.form-dot--d { background:var(--color-amber); }
.form-dot--l { background:var(--color-red); }
.fixtures-grid { display:grid;grid-template-columns:1fr;gap:var(--space-3); }
@media(min-width:640px){.fixtures-grid{grid-template-columns:repeat(2,1fr);}}
@media(min-width:1024px){.fixtures-grid{grid-template-columns:repeat(3,1fr);}}
.loading-state,.empty-state { padding:var(--space-8) 0; }
.empty-state { text-align:center;color:var(--color-text-muted); }
.error-state { display:flex;flex-direction:column;align-items:center;gap:var(--space-4);padding:var(--space-8) 0;color:var(--color-text-muted); }
.btn--sm { padding:var(--space-2) var(--space-4);font-size:.8rem; }
</style>
