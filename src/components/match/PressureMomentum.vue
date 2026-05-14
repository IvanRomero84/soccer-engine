<template>
  <div class="pressure-momentum" :id="`pm-${uid}`">
    <!-- Header -->
    <div class="pm__header">
      <h3 class="pm__title">
        <svg viewBox="0 0 16 16" fill="currentColor" class="pm__icon" aria-hidden="true">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v3a1 1 0 01-1 1H3a1 1 0 01-1-1v-3zM6 7a1 1 0 011-1h2a1 1 0 011 1v7a1 1 0 01-1 1H7a1 1 0 01-1-1V7zM10 4a1 1 0 011-1h2a1 1 0 011 1v10a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
        </svg>
        Pressure Momentum
      </h3>
      <div class="pm__legend">
        <span class="pm__legend-item pm__legend-item--home">
          <span class="pm__legend-dot"></span>
          {{ homeTeamName }}
        </span>
        <span class="pm__legend-item pm__legend-item--away">
          <span class="pm__legend-dot"></span>
          {{ awayTeamName }}
        </span>
      </div>
    </div>

    <!-- SVG Chart -->
    <div class="pm__chart-wrap">
      <svg
        :viewBox="`0 0 ${W} ${H}`"
        class="pm__svg"
        :width="W"
        :height="H"
        aria-label="Gráfico de dominio por tramo de partido"
        role="img"
      >
        <defs>
          <!-- Home gradient (blue) -->
          <linearGradient :id="`grad-home-${uid}`" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.05"/>
          </linearGradient>
          <!-- Away gradient (gold) -->
          <linearGradient :id="`grad-away-${uid}`" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stop-color="#f59e0b" stop-opacity="0.7"/>
            <stop offset="100%" stop-color="#f59e0b" stop-opacity="0.05"/>
          </linearGradient>

          <!-- Clip for animated draw -->
          <clipPath :id="`clip-${uid}`">
            <rect x="0" y="0" :height="H" :width="clipWidth" />
          </clipPath>
        </defs>

        <!-- Background grid lines -->
        <g class="pm__grid">
          <line
            v-for="min in gridMinutes"
            :key="min"
            :x1="toX(min)" y1="0"
            :x2="toX(min)" :y2="H"
            class="pm__grid-line"
          />
          <line x1="0" :y1="midY" :x2="W" :y2="midY" class="pm__grid-line pm__grid-line--center"/>
        </g>

        <!-- Home area (above center) -->
        <path
          :d="homeAreaPath"
          :fill="`url(#grad-home-${uid})`"
          :clip-path="`url(#clip-${uid})`"
          class="pm__area"
        />
        <!-- Away area (below center) -->
        <path
          :d="awayAreaPath"
          :fill="`url(#grad-away-${uid})`"
          :clip-path="`url(#clip-${uid})`"
          class="pm__area"
        />

        <!-- Home line -->
        <path
          :d="homeLinePath"
          fill="none"
          stroke="#3b82f6"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :clip-path="`url(#clip-${uid})`"
          class="pm__line"
        />
        <!-- Away line (mirrored) -->
        <path
          :d="awayLinePath"
          fill="none"
          stroke="#f59e0b"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :clip-path="`url(#clip-${uid})`"
          class="pm__line"
        />

        <!-- Event markers (goals, cards) -->
        <g v-for="ev in eventMarkers" :key="`${ev.time}-${ev.type}`">
          <line
            :x1="toX(ev.time)" y1="4"
            :x2="toX(ev.time)" :y2="H - 4"
            :class="['pm__event-line', `pm__event-line--${ev.type}`]"
          />
          <circle
            :cx="toX(ev.time)"
            :cy="ev.isHome ? midY - 10 : midY + 10"
            r="4"
            :class="['pm__event-dot', `pm__event-dot--${ev.type}`]"
          >
            <title>{{ ev.label }} ({{ ev.time }}')</title>
          </circle>
        </g>

        <!-- Time axis labels -->
        <g class="pm__axis">
          <text
            v-for="min in axisLabels"
            :key="min"
            :x="toX(min)"
            :y="H - 2"
            class="pm__axis-label"
            text-anchor="middle"
          >{{ min }}'</text>
        </g>

        <!-- Current time cursor (live) -->
        <line
          v-if="elapsed && elapsed > 0"
          :x1="toX(Math.min(elapsed, 90))" y1="0"
          :x2="toX(Math.min(elapsed, 90))" :y2="H"
          class="pm__cursor"
        />
      </svg>

      <!-- Dominance bar below chart -->
      <div class="pm__dominance">
        <span class="pm__dominance-label">{{ homeTeamName }}</span>
        <div class="pm__bar-track">
          <div
            class="pm__bar-fill pm__bar-fill--home"
            :style="{ width: `${homeDominancePct}%` }"
          ></div>
          <div
            class="pm__bar-fill pm__bar-fill--away"
            :style="{ width: `${100 - homeDominancePct}%` }"
          ></div>
        </div>
        <span class="pm__dominance-label">{{ awayTeamName }}</span>
      </div>
    </div>

    <!-- Tramo breakdown -->
    <div class="pm__segments">
      <div
        v-for="seg in segments"
        :key="seg.label"
        class="pm__segment"
        :class="{
          'pm__segment--home': seg.momentum > 0.1,
          'pm__segment--away': seg.momentum < -0.1,
          'pm__segment--neutral': Math.abs(seg.momentum) <= 0.1,
        }"
      >
        <span class="pm__segment-label">{{ seg.label }}</span>
        <div class="pm__segment-bar">
          <div
            class="pm__segment-fill"
            :style="{
              height: `${Math.abs(seg.momentum) * 100}%`,
              background: seg.momentum > 0 ? '#3b82f6' : '#f59e0b',
            }"
          ></div>
        </div>
        <span class="pm__segment-team">
          {{ seg.momentum > 0.1 ? 'L' : seg.momentum < -0.1 ? 'V' : '=' }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import type { Match, MatchEvent } from '@/types'

// ── Unique ID for SVG defs ─────────────────────────────────────────────────
const uid = Math.random().toString(36).slice(2, 7)

// ── Props ──────────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  match: Match
  /** Minuto actual (para partidos en vivo) */
  elapsed?: number
}>(), {
  elapsed: 0,
})

// ── Chart dimensions ───────────────────────────────────────────────────────
const W = 480
const H = 120
const PAD_X = 12
const PAD_Y = 8
const midY = H / 2
const chartW = W - PAD_X * 2
const TOTAL_MIN = 90

function toX(min: number) {
  return PAD_X + (min / TOTAL_MIN) * chartW
}

const gridMinutes = [15, 30, 45, 60, 75]
const axisLabels = [0, 15, 30, 45, 60, 75, 90]

// ── Team names ─────────────────────────────────────────────────────────────
const homeTeamName = computed(() => props.match.homeTeam.name)
const awayTeamName = computed(() => props.match.awayTeam.name)

// ── Momentum calculation per bucket ───────────────────────────────────────
/**
 * Divide 90 min en 6 buckets de 15 min.
 * Cada evento da puntos de momentum:
 *   Goal: ±3  |  Shot: ±1  |  Corner: ±0.5  |  Card: ∓0.5  |  Subst: ±0.1
 * Resultado normalizado en [-1, 1] donde +1 = dominio total local.
 */
interface MomentumBucket {
  startMin: number
  endMin: number
  label: string
  homeScore: number
  awayScore: number
  /** Normalizado [-1, 1] */
  momentum: number
}

const BUCKET_SIZE = 15
const NUM_BUCKETS = 6

function eventScore(ev: MatchEvent, forHome: boolean): number {
  const isHomeEvent = ev.teamId === props.match.homeTeam.id
  const sign = forHome ? (isHomeEvent ? 1 : -1) : (isHomeEvent ? -1 : 1)

  switch (ev.type) {
    case 'Goal':
      if (ev.detail === 'Own Goal') return sign * -2
      return sign * 3
    case 'Card':
      if (ev.detail === 'Red Card') return sign * -1.5
      return sign * -0.3
    case 'Subst':
      return sign * 0.1
    default:
      return sign * 0.2
  }
}

const momentumBuckets = computed<MomentumBucket[]>(() => {
  const events = props.match.events ?? []
  const buckets: MomentumBucket[] = []

  for (let i = 0; i < NUM_BUCKETS; i++) {
    const start = i * BUCKET_SIZE
    const end = start + BUCKET_SIZE
    const label = `${start}'–${end}'`

    const inBucket = events.filter((ev) => {
      const t = ev.time + (ev.timeExtra ?? 0)
      return t > start && t <= end
    })

    let homeScore = 0
    let awayScore = 0
    inBucket.forEach((ev) => {
      homeScore += eventScore(ev, true)
      awayScore += eventScore(ev, false)
    })

    // Si no hay eventos → leve ventaja neutral
    if (!inBucket.length) {
      homeScore = 0.1
      awayScore = 0.1
    }

    const total = Math.abs(homeScore) + Math.abs(awayScore) || 1
    const momentum = Math.max(-1, Math.min(1, (homeScore - awayScore) / total))

    buckets.push({ startMin: start, endMin: end, label, homeScore, awayScore, momentum })
  }

  return buckets
})

// Si no hay eventos, generamos datos de demo para visualización
const DEMO_MOMENTUM = [0.3, 0.6, -0.2, 0.1, -0.5, 0.4]
const effectiveBuckets = computed<MomentumBucket[]>(() => {
  const hasEvents = (props.match.events?.length ?? 0) > 0
  if (hasEvents) return momentumBuckets.value
  // Demo: usar valores pre-definidos para mostrar la forma del gráfico
  return momentumBuckets.value.map((b, i) => ({ ...b, momentum: DEMO_MOMENTUM[i] }))
})

// ── SVG path generation ────────────────────────────────────────────────────

/** Genera puntos suavizados via bezier para la línea del equipo local */
function buildPath(points: [number, number][]): string {
  if (points.length < 2) return ''
  let d = `M ${points[0][0]} ${points[0][1]}`

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpX = (prev[0] + curr[0]) / 2
    d += ` C ${cpX} ${prev[1]}, ${cpX} ${curr[1]}, ${curr[0]} ${curr[1]}`
  }
  return d
}

// Puntos para la línea home (por encima del centro)
const homePoints = computed<[number, number][]>(() =>
  effectiveBuckets.value.map((b) => {
    const x = toX((b.startMin + b.endMin) / 2)
    const maxOffset = midY - PAD_Y
    const y = midY - Math.max(0, b.momentum) * maxOffset
    return [x, y]
  })
)

// Puntos para la línea away (por debajo del centro)
const awayPoints = computed<[number, number][]>(() =>
  effectiveBuckets.value.map((b) => {
    const x = toX((b.startMin + b.endMin) / 2)
    const maxOffset = midY - PAD_Y
    const y = midY + Math.max(0, -b.momentum) * maxOffset
    return [x, y]
  })
)

const homeLinePath = computed(() => buildPath(homePoints.value))
const awayLinePath = computed(() => buildPath(awayPoints.value))

// Área home (relleno hasta el centro)
const homeAreaPath = computed(() => {
  const pts = homePoints.value
  if (!pts.length) return ''
  const line = buildPath(pts)
  return `${line} L ${pts[pts.length - 1][0]} ${midY} L ${pts[0][0]} ${midY} Z`
})

const awayAreaPath = computed(() => {
  const pts = awayPoints.value
  if (!pts.length) return ''
  const line = buildPath(pts)
  return `${line} L ${pts[pts.length - 1][0]} ${midY} L ${pts[0][0]} ${midY} Z`
})

// ── Event markers ──────────────────────────────────────────────────────────
const eventMarkers = computed(() =>
  (props.match.events ?? [])
    .filter((ev) => ev.type === 'Goal' || ev.detail === 'Red Card')
    .map((ev) => ({
      time: Math.min(ev.time, 90),
      type: ev.type === 'Goal' ? 'goal' : 'card',
      isHome: ev.teamId === props.match.homeTeam.id,
      label: ev.type === 'Goal'
        ? `Gol de ${ev.player}`
        : `Tarjeta roja a ${ev.player}`,
    }))
)

// ── Dominance percentage ──────────────────────────────────────────────────
const homeDominancePct = computed(() => {
  const avg =
    effectiveBuckets.value.reduce((sum, b) => sum + b.momentum, 0) /
    effectiveBuckets.value.length
  return Math.round(50 + avg * 50)
})

// ── Segments (for bottom row) ─────────────────────────────────────────────
const segments = computed(() =>
  effectiveBuckets.value.map((b) => ({
    label: `${b.startMin}'`,
    momentum: b.momentum,
  }))
)

// ── Animated clip path (draw on mount) ───────────────────────────────────
const clipWidth = ref(0)

onMounted(() => {
  // Animar desde 0 hasta W
  const duration = 1200
  const start = performance.now()
  function animate(now: number) {
    const t = Math.min((now - start) / duration, 1)
    // Easing: ease-out-cubic
    clipWidth.value = W * (1 - Math.pow(1 - t, 3))
    if (t < 1) requestAnimationFrame(animate)
  }
  requestAnimationFrame(animate)
})

// Si es en vivo y llegaron nuevos datos, animar de nuevo
watch(() => props.match.events?.length, () => {
  clipWidth.value = W
})
</script>

<style scoped>
.pressure-momentum {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* ── Header ─────────────────────────────────────────────────────────────── */
.pm__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-3);
}
.pm__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.pm__icon { width: 14px; height: 14px; color: var(--color-accent); }

.pm__legend {
  display: flex;
  gap: var(--space-4);
}
.pm__legend-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
.pm__legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.pm__legend-item--home .pm__legend-dot { background: #3b82f6; }
.pm__legend-item--away .pm__legend-dot { background: #f59e0b; }

/* ── SVG container ───────────────────────────────────────────────────────── */
.pm__chart-wrap {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.pm__svg {
  width: 100%;
  height: auto;
  overflow: visible;
}

/* ── Grid ────────────────────────────────────────────────────────────────── */
.pm__grid-line {
  stroke: var(--color-border);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}
.pm__grid-line--center {
  stroke: rgba(255,255,255,0.08);
  stroke-dasharray: none;
  stroke-width: 1.5;
}

/* ── Lines and areas ─────────────────────────────────────────────────────── */
.pm__area { transition: d 0.4s; }
.pm__line  { transition: d 0.4s; }

/* ── Axis ─────────────────────────────────────────────────────────────────── */
.pm__axis-label {
  font-family: var(--font-mono);
  font-size: 9px;
  fill: var(--color-text-disabled);
}

/* ── Event markers ───────────────────────────────────────────────────────── */
.pm__event-line {
  stroke-width: 1;
  stroke-dasharray: 2 3;
}
.pm__event-line--goal { stroke: rgba(34, 197, 94, 0.5); }
.pm__event-line--card { stroke: rgba(239, 68, 68, 0.5); }

.pm__event-dot { cursor: help; transition: r var(--transition-fast); }
.pm__event-dot:hover { r: 6; }
.pm__event-dot--goal { fill: var(--color-green); }
.pm__event-dot--card { fill: var(--color-red); }

/* ── Live cursor ──────────────────────────────────────────────────────────── */
.pm__cursor {
  stroke: rgba(239, 68, 68, 0.8);
  stroke-width: 1.5;
  stroke-dasharray: 4 3;
  animation: cursor-blink 1.5s infinite;
}
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}

/* ── Dominance bar ────────────────────────────────────────────────────────── */
.pm__dominance {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.pm__dominance-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  white-space: nowrap;
  flex: 0 0 auto;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pm__bar-track {
  flex: 1;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-bg-elevated);
  overflow: hidden;
  display: flex;
}
.pm__bar-fill {
  height: 100%;
  transition: width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.pm__bar-fill--home { background: #3b82f6; border-radius: var(--radius-full) 0 0 var(--radius-full); }
.pm__bar-fill--away { background: #f59e0b; border-radius: 0 var(--radius-full) var(--radius-full) 0; }

/* ── Segment breakdown ────────────────────────────────────────────────────── */
.pm__segments {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: var(--space-2);
}
.pm__segment {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.pm__segment-label {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-text-muted);
}
.pm__segment-bar {
  width: 100%;
  height: 32px;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-sm);
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  position: relative;
}
.pm__segment-fill {
  width: 100%;
  transition: height 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  border-radius: var(--radius-sm);
  opacity: 0.8;
  min-height: 3px;
}
.pm__segment-team {
  font-size: 0.6rem;
  font-weight: 700;
}
.pm__segment--home .pm__segment-team { color: #3b82f6; }
.pm__segment--away .pm__segment-team { color: #f59e0b; }
.pm__segment--neutral .pm__segment-team { color: var(--color-text-muted); }
</style>
