<template>
  <div class="view leagues-view">
    <div class="container">
      <header class="leagues-header">
        <h1 class="leagues-title">Explorar <em class="text-accent">Competiciones</em></h1>
        <p class="leagues-sub">Accede a las mejores ligas del mundo con datos en tiempo real.</p>
        
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input 
            v-model="searchQuery" 
            type="text" 
            placeholder="Buscar liga o país..." 
            class="search-input"
          />
        </div>
      </header>

      <div class="leagues-grid">
        <article 
          v-for="league in filteredLeagues" 
          :key="league.id" 
          class="league-card card"
          @click="$router.push(`/leagues/${league.id}`)"
        >
          <div class="league-card__logo-wrap">
            <img :src="league.logo" :alt="league.name" class="league-card__logo" />
          </div>
          <div class="league-card__content">
            <div class="league-card__meta">
              <span class="badge">{{ league.country }}</span>
              <span class="league-card__type">{{ league.type === 'League' ? '🏆 Liga' : '⚔️ Copa' }}</span>
            </div>
            <h2 class="league-card__name">{{ league.name }}</h2>
            <button class="btn btn-primary btn--block mt-4">Ver Clasificación</button>
          </div>
        </article>
      </div>

      <div v-if="filteredLeagues.length === 0" class="no-results">
        <p>No se encontraron ligas que coincidan con "{{ searchQuery }}"</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { League } from '@/types'

const searchQuery = ref('')

// Lista curada de ligas disponibles en el plan gratuito de football-data.org v4
const allLeagues: League[] = [
  { id: 'PL', name: 'Premier League', type: 'League', country: 'Inglaterra', logo: 'https://api.sofascore.app/api/v1/unique-tournament/17/image' },
  { id: 'ELC', name: 'Championship', type: 'League', country: 'Inglaterra', logo: 'https://api.sofascore.app/api/v1/unique-tournament/18/image' },
  { id: 'PD', name: 'La Liga', type: 'League', country: 'España', logo: 'https://api.sofascore.app/api/v1/unique-tournament/8/image' },
  { id: 'SA', name: 'Serie A', type: 'League', country: 'Italia', logo: 'https://api.sofascore.app/api/v1/unique-tournament/23/image' },
  { id: 'BL1', name: 'Bundesliga', type: 'League', country: 'Alemania', logo: 'https://api.sofascore.app/api/v1/unique-tournament/35/image' },
  { id: 'FL1', name: 'Ligue 1', type: 'League', country: 'Francia', logo: 'https://api.sofascore.app/api/v1/unique-tournament/34/image' },
  { id: 'DED', name: 'Eredivisie', type: 'League', country: 'Países Bajos', logo: 'https://api.sofascore.app/api/v1/unique-tournament/37/image' },
  { id: 'PPL', name: 'Primeira Liga', type: 'League', country: 'Portugal', logo: 'https://api.sofascore.app/api/v1/unique-tournament/238/image' },
  { id: 'CL', name: 'Champions League', type: 'Cup', country: 'Europa', logo: 'https://api.sofascore.app/api/v1/unique-tournament/7/image' },
  { id: 'CLI', name: 'Copa Libertadores', type: 'Cup', country: 'Sudamérica', logo: 'https://api.sofascore.app/api/v1/unique-tournament/384/image' },
]

const filteredLeagues = computed(() => {
  const query = searchQuery.value.toLowerCase().trim()
  if (!query) return allLeagues
  return allLeagues.filter(l => 
    l.name.toLowerCase().includes(query) || 
    l.country.toLowerCase().includes(query)
  )
})
</script>

<style scoped>
.leagues-header {
  padding: var(--space-12) 0 var(--space-8);
  text-align: center;
}

.leagues-title {
  font-size: clamp(2rem, 5vw, 3rem);
  margin-bottom: var(--space-3);
  line-height: 1.1;
}

.leagues-sub {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  max-width: 600px;
  margin: 0 auto var(--space-8);
}

.search-wrap {
  position: relative;
  max-width: 500px;
  margin: 0 auto;
}

.search-icon {
  position: absolute;
  left: var(--space-4);
  top: 50%;
  transform: translateY(-50%);
  color: var(--color-text-muted);
}

.search-input {
  width: 100%;
  padding: var(--space-4) var(--space-4) var(--space-4) var(--space-10);
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-primary);
  font-size: 1rem;
  transition: all var(--transition-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent);
  background: var(--color-bg-overlay);
  box-shadow: 0 0 0 4px var(--color-accent-muted);
}

.leagues-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: var(--space-6);
  padding-bottom: var(--space-12);
}

.league-card {
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.league-card:hover {
  transform: translateY(-4px);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-lg);
}

.league-card__logo-wrap {
  padding: var(--space-6);
  background: var(--color-bg-surface);
  display: flex;
  justify-content: center;
  align-items: center;
  border-bottom: 1px solid var(--color-border);
}

.league-card__logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0,0,0,0.3));
  transition: transform var(--transition-base);
}

.league-card:hover .league-card__logo {
  transform: scale(1.1);
}

.league-card__content {
  padding: var(--space-5);
}

.league-card__meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-3);
}

.league-card__type {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-weight: 500;
}

.league-card__name {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: var(--space-4);
  color: var(--color-text-primary);
}

.no-results {
  text-align: center;
  padding: var(--space-12) 0;
  color: var(--color-text-muted);
}

.mt-4 { margin-top: var(--space-4); }

@media (max-width: 640px) {
  .leagues-grid {
    grid-template-columns: 1fr;
  }
}
</style>
