<template>
  <article
    class="match-card"
    :class="{
      'match-card--live': isLive,
      'match-card--finished': isFinished,
    }"
    @click="$emit('click', match)"
    tabindex="0"
    role="button"
    :aria-label="`${match.homeTeam.name} vs ${match.awayTeam.name}`"
    @keydown.enter="$emit('click', match)"
  >
    <!-- Top bar: League info + status -->
    <div class="match-card__header">
      <div class="match-card__league">
        <img
          v-if="match.leagueLogo"
          :src="match.leagueLogo"
          :alt="match.leagueName"
          class="match-card__league-logo"
          referrerpolicy="no-referrer"
        />
        <span class="match-card__league-name">{{ match.leagueName }}</span>
        <span class="match-card__round">· {{ shortRound }}</span>
      </div>

      <!-- Status badge -->
      <div class="match-card__status">
        <span v-if="isLive" class="badge badge-live">
          {{ match.elapsed }}'
        </span>
        <span v-else-if="match.status === 'HT'" class="badge badge-draw">
          DESCANSO
        </span>
        <span v-else-if="isFinished" class="status-text">
          {{ match.statusLong }}
        </span>
        <span v-else class="status-text status-text--scheduled">
          {{ matchDate }}
        </span>
      </div>
    </div>

    <!-- Main match body -->
    <div class="match-card__body">
      <!-- Home team -->
      <div class="team team--home">
        <div class="team__logo-wrap">
          <img
            :src="match.homeTeam.logo"
            :alt="match.homeTeam.name"
            class="team__logo"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </div>
        <span class="team__name" :class="{ 'team__name--winner': homeWon }">
          {{ match.homeTeam.name }}
        </span>
      </div>

      <!-- Score / Time -->
      <div class="match-card__score-center">
        <template v-if="hasScore">
          <span class="score" :class="{ 'score--live': isLive }">
            <span :class="{ 'score__num--winner': homeWon }">{{ match.goals.home }}</span>
            <span class="score__sep">—</span>
            <span :class="{ 'score__num--winner': awayWon }">{{ match.goals.away }}</span>
          </span>
          <!-- Penalty score if applicable -->
          <span v-if="hasPenalty" class="penalty-score">
            ({{ match.score.penalty.home }} – {{ match.score.penalty.away }} pen)
          </span>
        </template>
        <template v-else>
          <span class="kickoff-time">{{ kickoffTime }}</span>
          <span class="kickoff-date">{{ kickoffDate }}</span>
        </template>

        <!-- Live pulse ring -->
        <span v-if="isLive" class="live-ring" aria-hidden="true"></span>
      </div>

      <!-- Away team -->
      <div class="team team--away">
        <div class="team__logo-wrap">
          <img
            :src="match.awayTeam.logo"
            :alt="match.awayTeam.name"
            class="team__logo"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </div>
        <span class="team__name" :class="{ 'team__name--winner': awayWon }">
          {{ match.awayTeam.name }}
        </span>
      </div>
    </div>

    <!-- Footer: mini stats if available -->
    <div v-if="hasStats" class="match-card__footer">
      <div class="mini-stat">
        <span class="mini-stat__val">{{ homeStat?.shotsOnGoal ?? '—' }}</span>
        <span class="mini-stat__label">Tiros</span>
        <span class="mini-stat__val">{{ awayStat?.shotsOnGoal ?? '—' }}</span>
      </div>
      <div class="mini-stat">
        <span class="mini-stat__val">{{ homePoss }}%</span>
        <span class="mini-stat__label">Posesión</span>
        <span class="mini-stat__val">{{ awayStat?.possession ?? '—' }}%</span>
      </div>
    </div>

    <!-- Glow border on live -->
    <div v-if="isLive" class="match-card__glow" aria-hidden="true"></div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Match } from '@/types'

const props = defineProps<{
  match: Match
}>()

defineEmits<{
  (e: 'click', match: Match): void
}>()

// ── Status helpers ────────────────────────────────────────────────────────────
const LIVE_STATUSES = new Set(['1H', 'HT', '2H', 'ET', 'P', 'LIVE', 'BT'])
const FINISHED_STATUSES = new Set(['FT', 'AET', 'PEN'])

const isLive = computed(() => LIVE_STATUSES.has(props.match.status))
const isFinished = computed(() => FINISHED_STATUSES.has(props.match.status))
const hasScore = computed(
  () => props.match.goals.home !== null && props.match.goals.away !== null
)

// ── Result helpers ─────────────────────────────────────────────────────────
const homeWon = computed(() => {
  if (!isFinished.value || !hasScore.value) return false
  return (props.match.goals.home ?? 0) > (props.match.goals.away ?? 0)
})
const awayWon = computed(() => {
  if (!isFinished.value || !hasScore.value) return false
  return (props.match.goals.away ?? 0) > (props.match.goals.home ?? 0)
})

const hasPenalty = computed(
  () =>
    props.match.score.penalty.home !== null &&
    props.match.status === 'PEN'
)

// ── Date helpers ──────────────────────────────────────────────────────────────
const dateObj = computed(() => new Date(props.match.date))

const kickoffTime = computed(() =>
  dateObj.value.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
)
const kickoffDate = computed(() =>
  dateObj.value.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
)
const matchDate = computed(() =>
  dateObj.value.toLocaleString('es-ES', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
)

// ── Round label ───────────────────────────────────────────────────────────────
const shortRound = computed(() => {
  const r = props.match.round
  // "Regular Season - 12" → "J12"
  const m = r.match(/(\d+)$/)
  return m ? `J${m[1]}` : r
})

// ── Stats ─────────────────────────────────────────────────────────────────────
const hasStats = computed(() => !!props.match.statistics?.length)
const homeStat = computed(() => props.match.statistics?.[0])
const awayStat = computed(() => props.match.statistics?.[1])
const homePoss = computed(() => homeStat.value?.possession ?? '—')
</script>

<style scoped>
/* ── Card shell ───────────────────────────────────────────────────────────── */
.match-card {
  position: relative;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  cursor: pointer;
  transition: all var(--transition-base);
  overflow: hidden;
  outline: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}
.match-card:hover,
.match-card:focus-visible {
  border-color: var(--color-border-strong);
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}
.match-card--live {
  border-color: rgba(239, 68, 68, 0.35);
}
.match-card--live:hover { box-shadow: 0 8px 32px rgba(239, 68, 68, 0.15); }

/* ── Glow (live only) ─────────────────────────────────────────────────────── */
.match-card__glow {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  box-shadow: inset 0 0 40px rgba(239, 68, 68, 0.06);
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.match-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.match-card__league {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}
.match-card__league-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
  flex-shrink: 0;
}
.match-card__league-name {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.match-card__round {
  font-size: 0.7rem;
  color: var(--color-text-disabled);
}
.match-card__status { flex-shrink: 0; }

.status-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.status-text--scheduled { color: var(--color-accent); }

/* ── Body ─────────────────────────────────────────────────────────────────── */
.match-card__body {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-3);
}

/* ── Team ─────────────────────────────────────────────────────────────────── */
.team {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}
.team__logo-wrap {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.team__logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
  transition: transform var(--transition-fast);
}
.match-card:hover .team__logo { transform: scale(1.05); }

.team__name {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  text-align: center;
  line-height: 1.2;
  max-width: 90px;
}
.team__name--winner {
  color: var(--color-text-primary);
  font-weight: 700;
}

/* ── Score center ─────────────────────────────────────────────────────────── */
.match-card__score-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  position: relative;
}

.score {
  font-family: var(--font-display);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
  line-height: 1;
}
.score--live { color: var(--color-red); }
.score__sep { color: var(--color-text-muted); font-weight: 300; }
.score__num--winner { color: var(--color-green); }

.penalty-score {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.kickoff-time {
  font-family: var(--font-display);
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-accent);
}
.kickoff-date {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: capitalize;
}

/* ── Live pulse ring ──────────────────────────────────────────────────────── */
.live-ring {
  position: absolute;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: 2px solid rgba(239, 68, 68, 0.5);
  animation: live-pulse 2s infinite;
  pointer-events: none;
}
@keyframes live-pulse {
  0%   { transform: scale(0.9); opacity: 0.7; }
  70%  { transform: scale(1.4); opacity: 0; }
  100% { transform: scale(0.9); opacity: 0; }
}

/* ── Footer mini stats ────────────────────────────────────────────────────── */
.match-card__footer {
  display: flex;
  gap: var(--space-4);
  justify-content: center;
  border-top: 1px solid var(--color-border);
  padding-top: var(--space-3);
}
.mini-stat {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.mini-stat__val {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary);
  min-width: 28px;
  text-align: center;
}
.mini-stat__label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
</style>
