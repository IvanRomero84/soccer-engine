<template>
  <div class="match-stats">
    <h3 class="match-stats__title">Estadísticas del Partido</h3>

    <div class="stats-grid">
      <div
        v-for="stat in statsRows"
        :key="stat.key"
        class="stat-row"
      >
        <span class="stat-row__home-val">{{ stat.homeVal }}</span>

        <div class="stat-row__bars">
          <span class="stat-row__label">{{ stat.label }}</span>
          <div class="stat-row__bar-wrap">
            <div class="stat-row__bar stat-row__bar--home">
              <div
                class="stat-row__fill stat-row__fill--home"
                :style="{ width: `${stat.homePct}%` }"
              ></div>
            </div>
            <div class="stat-row__bar stat-row__bar--away">
              <div
                class="stat-row__fill stat-row__fill--away"
                :style="{ width: `${stat.awayPct}%` }"
              ></div>
            </div>
          </div>
        </div>

        <span class="stat-row__away-val">{{ stat.awayVal }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MatchTeamStats } from '@/types'

const props = defineProps<{
  home: MatchTeamStats
  away: MatchTeamStats
}>()

interface StatRow {
  key: string
  label: string
  homeVal: string | number
  awayVal: string | number
  homePct: number
  awayPct: number
}

function pct(h: number | undefined, a: number | undefined): [number, number] {
  const hv = h ?? 0
  const av = a ?? 0
  const total = hv + av
  if (total === 0) return [50, 50]
  return [Math.round((hv / total) * 100), Math.round((av / total) * 100)]
}

const statsRows = computed<StatRow[]>(() => {
  const h = props.home
  const a = props.away

  const rows: StatRow[] = [
    ...(h.possession !== undefined
      ? [{
          key: 'poss',
          label: 'Posesión',
          homeVal: `${h.possession}%`,
          awayVal: `${a.possession}%`,
          homePct: h.possession ?? 50,
          awayPct: a.possession ?? 50,
        }]
      : []),
    ...(h.xGoals !== undefined
      ? [{
          key: 'xg',
          label: 'xG',
          homeVal: (h.xGoals ?? 0).toFixed(2),
          awayVal: (a.xGoals ?? 0).toFixed(2),
          ...(() => { const [hp, ap] = pct(h.xGoals, a.xGoals); return { homePct: hp, awayPct: ap } })(),
        }]
      : []),
    {
      key: 'shots',
      label: 'Tiros',
      homeVal: h.shotsTotal ?? '—',
      awayVal: a.shotsTotal ?? '—',
      ...(() => { const [hp, ap] = pct(h.shotsTotal, a.shotsTotal); return { homePct: hp, awayPct: ap } })(),
    },
    {
      key: 'shotsOT',
      label: 'A puerta',
      homeVal: h.shotsOnGoal ?? '—',
      awayVal: a.shotsOnGoal ?? '—',
      ...(() => { const [hp, ap] = pct(h.shotsOnGoal, a.shotsOnGoal); return { homePct: hp, awayPct: ap } })(),
    },
    {
      key: 'passes',
      label: 'Pases',
      homeVal: h.passes ?? '—',
      awayVal: a.passes ?? '—',
      ...(() => { const [hp, ap] = pct(h.passes, a.passes); return { homePct: hp, awayPct: ap } })(),
    },
    {
      key: 'passAcc',
      label: 'Precisión pase',
      homeVal: h.passAccuracy ? `${h.passAccuracy}%` : '—',
      awayVal: a.passAccuracy ? `${a.passAccuracy}%` : '—',
      ...(() => { const [hp, ap] = pct(h.passAccuracy, a.passAccuracy); return { homePct: hp, awayPct: ap } })(),
    },
    {
      key: 'corners',
      label: 'Córners',
      homeVal: h.corners ?? '—',
      awayVal: a.corners ?? '—',
      ...(() => { const [hp, ap] = pct(h.corners, a.corners); return { homePct: hp, awayPct: ap } })(),
    },
    {
      key: 'fouls',
      label: 'Faltas',
      homeVal: h.fouls ?? '—',
      awayVal: a.fouls ?? '—',
      ...(() => { const [hp, ap] = pct(h.fouls, a.fouls); return { homePct: hp, awayPct: ap } })(),
    },
  ]

  return rows
})
</script>

<style scoped>
.match-stats {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}
.match-stats__title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: var(--space-4);
}

.stats-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.stat-row {
  display: grid;
  grid-template-columns: 3rem 1fr 3rem;
  align-items: center;
  gap: var(--space-3);
}
.stat-row__home-val,
.stat-row__away-val {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}
.stat-row__home-val { text-align: right; }
.stat-row__away-val { text-align: left; }

.stat-row__bars {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.stat-row__label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.stat-row__bar-wrap {
  display: flex;
  width: 100%;
  gap: 2px;
}
.stat-row__bar {
  flex: 1;
  height: 5px;
  background: var(--color-bg-elevated);
  overflow: hidden;
  position: relative;
}
.stat-row__bar--home { border-radius: var(--radius-full) 0 0 var(--radius-full); }
.stat-row__bar--away { border-radius: 0 var(--radius-full) var(--radius-full) 0; }

.stat-row__fill {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: inherit;
  transition: width 1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.stat-row__fill--home {
  right: 0;
  background: linear-gradient(to left, #3b82f6, #60a5fa);
}
.stat-row__fill--away {
  left: 0;
  background: linear-gradient(to right, #f59e0b, #fbbf24);
}
</style>
