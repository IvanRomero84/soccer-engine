<template>
  <div class="season-stats">
    <div class="season-stats__header">
      <h3 class="season-stats__title">Estadísticas de Temporada</h3>
      <select
        v-if="stats.length > 1"
        v-model="selectedIdx"
        class="form-input season-stats__select"
        aria-label="Seleccionar temporada"
      >
        <option
          v-for="(s, i) in stats"
          :key="i"
          :value="i"
        >
          {{ s.leagueName }} · {{ s.season }}
        </option>
      </select>
    </div>

    <!-- Clasificación Real (Scraped) -->
    <div v-if="realStats" class="real-standing">
      <div class="real-standing__item">
        <span class="real-standing__label">Posición</span>
        <span class="real-standing__value">#{{ realStats.rank }}</span>
      </div>
      <div class="real-standing__item">
        <span class="real-standing__label">Puntos</span>
        <span class="real-standing__value">{{ realStats.points }}</span>
      </div>
      <div class="real-standing__item">
        <span class="real-standing__label">Partidos</span>
        <span class="real-standing__value">{{ realStats.played }}</span>
      </div>
      <div class="real-standing__item">
        <span class="real-standing__label">Dif. Goles</span>
        <span class="real-standing__value">{{ realStats.goalsDiff }}</span>
      </div>
    </div>

    <div v-if="current" class="stats-content">
      <!-- Summary row -->
      <div class="stats-summary">
        <div class="stat-pill">
          <span class="stat-pill__val">{{ current.played }}</span>
          <span class="stat-pill__label">PJ</span>
        </div>
        <div class="stat-pill stat-pill--win">
          <span class="stat-pill__val">{{ current.wins }}</span>
          <span class="stat-pill__label">G</span>
        </div>
        <div class="stat-pill stat-pill--draw">
          <span class="stat-pill__val">{{ current.draws }}</span>
          <span class="stat-pill__label">E</span>
        </div>
        <div class="stat-pill stat-pill--loss">
          <span class="stat-pill__val">{{ current.losses }}</span>
          <span class="stat-pill__label">P</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill__val">{{ current.points }}</span>
          <span class="stat-pill__label">Pts</span>
        </div>
        <div v-if="current.rank" class="stat-pill stat-pill--rank">
          <span class="stat-pill__val">#{{ current.rank }}</span>
          <span class="stat-pill__label">Pos</span>
        </div>
      </div>

      <!-- Animated bars -->
      <div class="stat-bars">
        <!-- Win rate -->
        <div class="bar-stat">
          <div class="bar-stat__meta">
            <span>% Victorias</span>
            <span class="font-mono">{{ winRate }}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-fill--green" :style="{ width: `${winRate}%` }"></div>
          </div>
        </div>

        <!-- Goals for -->
        <div class="bar-stat">
          <div class="bar-stat__meta">
            <span>Goles a favor</span>
            <span class="font-mono">{{ current.goalsFor }}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-fill--blue" :style="{ width: `${goalForPct}%` }"></div>
          </div>
        </div>

        <!-- Goals against -->
        <div class="bar-stat">
          <div class="bar-stat__meta">
            <span>Goles en contra</span>
            <span class="font-mono">{{ current.goalsAgainst }}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-fill--red" :style="{ width: `${goalAgainstPct}%` }"></div>
          </div>
        </div>

        <!-- xG if available -->
        <div v-if="current.xGoalsFor !== undefined" class="bar-stat">
          <div class="bar-stat__meta">
            <span>xG</span>
            <span class="font-mono">{{ current.xGoalsFor?.toFixed(1) }}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-fill--accent" :style="{ width: `${xgPct}%` }"></div>
          </div>
        </div>

        <!-- Possession if available -->
        <div v-if="current.avgPossession !== undefined" class="bar-stat">
          <div class="bar-stat__meta">
            <span>Posesión media</span>
            <span class="font-mono">{{ current.avgPossession?.toFixed(1) }}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill bar-fill--accent" :style="{ width: `${current.avgPossession}%` }"></div>
          </div>
        </div>
      </div>

      <!-- Form streak -->
      <div v-if="current.form" class="form-streak">
        <span class="form-streak__label">Forma reciente</span>
        <div class="form-chips">
          <span
            v-for="(r, i) in formChips"
            :key="i"
            :class="['form-chip', `form-chip--${r.toLowerCase()}`]"
          >
            {{ r }}
          </span>
        </div>
      </div>
    </div>

    <p v-else class="text-muted" style="text-align:center; padding: 2rem 0">
      Sin estadísticas disponibles.
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { ClubStatsSeason } from '@/types'

const props = defineProps<{ 
  stats: ClubStatsSeason[],
  realStats?: {
    rank: number
    points: number
    played: number
    goalsDiff: string | number
  }
}>()

const selectedIdx = ref(0)
const current = computed(() => props.stats[selectedIdx.value] ?? null)

const winRate = computed(() => {
  if (!current.value?.played) return 0
  return Math.round((current.value.wins / current.value.played) * 100)
})

const maxGoals = 100 // normalización
const goalForPct = computed(() =>
  Math.min(100, Math.round(((current.value?.goalsFor ?? 0) / maxGoals) * 100))
)
const goalAgainstPct = computed(() =>
  Math.min(100, Math.round(((current.value?.goalsAgainst ?? 0) / maxGoals) * 100))
)
const xgPct = computed(() =>
  Math.min(100, Math.round(((current.value?.xGoalsFor ?? 0) / 100) * 100))
)

const formChips = computed(() =>
  (current.value?.form ?? '').split('').slice(0, 10)
)
</script>

<style scoped>
.season-stats {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.season-stats__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
  margin-bottom: var(--space-5);
}
.season-stats__title { font-size: 1rem; }
.season-stats__select {
  width: auto;
  font-size: 0.8rem;
  padding: var(--space-2) var(--space-3);
}

/* Real Standing */
.real-standing {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  margin-bottom: var(--space-6);
}
.real-standing__item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.real-standing__label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.real-standing__value {
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--color-accent);
  font-family: var(--font-display);
}

@media (max-width: 480px) {
  .real-standing { 
    grid-template-columns: repeat(2, 1fr); 
    gap: var(--space-3);
    padding: var(--space-4);
  }
  .real-standing__value { font-size: 1.25rem; }
}

/* ── Summary pills ─────────────────────────────────────────────────────── */
.stats-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
}
.stat-pill {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-3) var(--space-4);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  min-width: 52px;
}
.stat-pill__val {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
}
.stat-pill__label {
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  margin-top: 2px;
}
.stat-pill--win  { border-color: rgba(34,197,94,0.3); }
.stat-pill--win  .stat-pill__val { color: var(--color-green); }
.stat-pill--draw { border-color: rgba(245,158,11,0.3); }
.stat-pill--draw .stat-pill__val { color: var(--color-amber); }
.stat-pill--loss { border-color: rgba(239,68,68,0.3); }
.stat-pill--loss .stat-pill__val { color: var(--color-red); }
.stat-pill--rank { border-color: var(--color-border-strong); }
.stat-pill--rank .stat-pill__val { color: var(--color-accent); }

/* ── Animated bars ─────────────────────────────────────────────────────── */
.stat-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin-bottom: var(--space-5);
}
.bar-stat { display: flex; flex-direction: column; gap: var(--space-2); }
.bar-stat__meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}
.bar-track {
  height: 8px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-full);
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.bar-fill--green  { background: linear-gradient(to right, #16a34a, #22c55e); }
.bar-fill--blue   { background: linear-gradient(to right, #1d4ed8, #3b82f6); }
.bar-fill--red    { background: linear-gradient(to right, #b91c1c, #ef4444); }
.bar-fill--accent { background: linear-gradient(to right, #1d4ed8, #60a5fa); }

/* ── Form streak ───────────────────────────────────────────────────────── */
.form-streak { display: flex; align-items: center; gap: var(--space-3); }
.form-streak__label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  white-space: nowrap;
}
.form-chips { display: flex; gap: var(--space-1); }
.form-chip {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  font-weight: 700;
}
.form-chip--w { background: var(--color-green-muted); color: var(--color-green); }
.form-chip--d { background: var(--color-amber-muted); color: var(--color-amber); }
.form-chip--l { background: var(--color-red-muted); color: var(--color-red); }
</style>
