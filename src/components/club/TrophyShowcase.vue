<template>
  <section class="trophy-showcase" aria-label="Palmarés histórico">
    <div class="trophy-showcase__header">
      <h3 class="trophy-showcase__title">
        <span class="trophy-icon">🏆</span>
        Palmarés
      </h3>
      <span class="trophy-showcase__total">{{ trophies.length }} títulos</span>
    </div>

    <!-- Grouped by competition -->
    <div v-if="grouped.length" class="trophy-groups">
      <div
        v-for="group in grouped"
        :key="group.league"
        class="trophy-group"
      >
        <div class="trophy-group__header">
          <span class="trophy-group__name">{{ group.league }}</span>
          <span class="trophy-group__count">
            {{ group.wins.length }}×
          </span>
        </div>

        <div class="trophy-grid">
          <div
            v-for="(trophy, i) in group.wins.slice(0, showAll ? undefined : 8)"
            :key="i"
            class="trophy-item"
            :title="`${trophy.season} — ${trophy.place}`"
          >
            <div class="trophy-item__icon">
              <img v-if="trophy.image" :src="trophy.image" :alt="trophy.league" class="trophy-img" />
              <template v-else>
                <svg v-if="isWinner(trophy)" viewBox="0 0 24 24" fill="currentColor" class="icon-trophy">
                  <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H9v2h6v-2h-2v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" class="icon-medal">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                </svg>
              </template>
            </div>
            <span class="trophy-item__year">
              {{ trophy.season.split('/')[0] }}
            </span>
          </div>

          <button
            v-if="!showAll && group.wins.length > 8"
            class="trophy-more"
            @click="showAll = true"
          >
            +{{ group.wins.length - 8 }} más
          </button>
        </div>
      </div>
    </div>

    <p v-else class="trophy-empty">Sin datos de palmarés disponibles.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Trophy } from '@/types'

const props = defineProps<{ trophies: Trophy[] }>()

const showAll = ref(false)

interface TrophyGroup {
  league: string
  wins: Trophy[]
}

function isWinner(t: Trophy) {
  return t.place === 'Winner'
}

const grouped = computed<TrophyGroup[]>(() => {
  const map = new Map<string, Trophy[]>()
  for (const t of props.trophies) {
    if (!map.has(t.league)) map.set(t.league, [])
    map.get(t.league)!.push(t)
  }
  // Sort by number of wins descending
  return Array.from(map.entries())
    .map(([league, wins]) => ({ league, wins }))
    .sort((a, b) => b.wins.length - a.wins.length)
})
</script>

<style scoped>
.trophy-showcase {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
}

.trophy-showcase__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-5);
}
.trophy-showcase__title {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: 1rem;
}
.trophy-icon { font-size: 1.1rem; }
.trophy-showcase__total {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-amber);
  background: var(--color-amber-muted);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}

.trophy-groups { display: flex; flex-direction: column; gap: var(--space-5); }

.trophy-group__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-3);
}
.trophy-group__name {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.trophy-group__count {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-amber);
}

.trophy-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.trophy-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-2) var(--space-3);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: default;
  transition: all var(--transition-fast);
}
.trophy-item:hover {
  border-color: var(--color-amber);
  background: var(--color-amber-muted);
  transform: translateY(-2px);
}

.trophy-item__icon { color: var(--color-amber); width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.trophy-img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.icon-trophy, .icon-medal { width: 24px; height: 24px; }
.icon-medal { color: var(--color-text-muted); }

.trophy-item__year {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  color: var(--color-text-muted);
}

.trophy-more {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-3);
  background: var(--color-accent-muted);
  border: 1px dashed var(--color-border-strong);
  border-radius: var(--radius-md);
  color: var(--color-accent);
  font-size: 0.75rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.trophy-more:hover { background: var(--color-accent); color: #fff; }

.trophy-empty {
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  padding: var(--space-8);
}
</style>
