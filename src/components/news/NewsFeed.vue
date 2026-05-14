<template>
  <div class="news-feed">
    <!-- Portada del Día (Hero) -->
    <article 
      v-if="portadaArticle" 
      class="news-card news-card--hero"
      @click="openArticle(portadaArticle.link)"
      tabindex="0"
      role="link"
      :aria-label="portadaArticle.title"
      @keydown.enter="openArticle(portadaArticle.link)"
    >
      <div class="news-card__img-wrap">
        <img 
          v-if="portadaArticle.thumbnail" 
          :src="portadaArticle.thumbnail" 
          :alt="portadaArticle.title" 
          class="news-card__img" 
          loading="lazy" 
        />
        <div v-else class="news-card__img-fallback">
          <span>{{ portadaArticle.source }}</span>
        </div>
      </div>
      
      <div class="news-card__body">
        <div class="news-card__meta">
          <span 
            class="news-card__badge" 
            :style="sourceStyle(portadaArticle.source)"
          >
            {{ portadaArticle.source }}
          </span>
          <span class="news-card__date">{{ timeAgo(portadaArticle.pubDate) }}</span>
        </div>
        <h2 class="news-card__title">{{ portadaArticle.title }}</h2>
        <p v-if="portadaArticle.content" class="news-card__desc" v-html="stripHtml(portadaArticle.content)"></p>
      </div>
    </article>

    <!-- Masonry/Grid Feed -->
    <div class="news-grid">
      <article 
        v-for="article in feedArticles" 
        :key="article.link" 
        class="news-card"
        @click="openArticle(article.link)"
        tabindex="0"
        role="link"
        :aria-label="article.title"
        @keydown.enter="openArticle(article.link)"
      >
        <div class="news-card__img-wrap">
          <img 
            v-if="article.thumbnail" 
            :src="article.thumbnail" 
            :alt="article.title" 
            class="news-card__img" 
            loading="lazy" 
          />
          <div v-else class="news-card__img-fallback">
            <span>{{ article.source }}</span>
          </div>
        </div>

        <div class="news-card__body">
          <div class="news-card__meta">
            <span 
              class="news-card__badge" 
              :style="sourceStyle(article.source)"
            >
              {{ article.source }}
            </span>
            <span class="news-card__date">{{ timeAgo(article.pubDate) }}</span>
          </div>
          <h3 class="news-card__title">{{ article.title }}</h3>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NewsArticle } from '@/types'

const props = defineProps<{
  articles: NewsArticle[]
}>()

// Buscar el primer artículo que contenga "PORTADA" en el título
const portadaArticle = computed(() => {
  return props.articles.find(a => a.title.toUpperCase().includes('PORTADA'))
})

// El resto de artículos (excluyendo la portada si existe)
const feedArticles = computed(() => {
  if (!portadaArticle.value) return props.articles
  return props.articles.filter(a => a.link !== portadaArticle.value!.link)
})

function openArticle(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

// Estilos corporativos por fuente
function sourceStyle(sourceName: string) {
  const name = sourceName.toLowerCase()
  if (name.includes('marca')) {
    return { backgroundColor: '#E2001A', color: '#fff' }
  }
  if (name.includes('as')) {
    return { backgroundColor: '#D20A11', color: '#fff' }
  }
  if (name.includes('mundo deportivo')) {
    return { backgroundColor: '#FFED00', color: '#000' }
  }
  if (name.includes('sport')) {
    return { backgroundColor: '#ED1C24', color: '#fff' }
  }
  return { backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }
}

// Convertir fecha a tiempo relativo
function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return `hace ${seconds} seg`
  
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `hace ${minutes} min`
  
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `hace ${hours} hora${hours > 1 ? 's' : ''}`
  
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} día${days > 1 ? 's' : ''}`
  
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })
}

// Limpiar HTML básico que pueda venir en el RSS content
function stripHtml(html: string): string {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  const text = tmp.textContent || tmp.innerText || ''
  return text.substring(0, 150) + (text.length > 150 ? '...' : '')
}
</script>

<style scoped>
.news-feed {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.news-card {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.3s ease;
  outline: none;
}

.news-card:hover, .news-card:focus-visible {
  border-color: var(--color-border-strong);
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

.news-card__img-wrap {
  width: 100%;
  height: 180px;
  overflow: hidden;
  position: relative;
  background: var(--color-bg-elevated);
}

.news-card__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
}

.news-card:hover .news-card__img {
  transform: scale(1.05);
}

.news-card__img-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-display);
  font-weight: 800;
  color: var(--color-text-disabled);
  font-size: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.3;
}

.news-card__body {
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  flex: 1;
}

.news-card__meta {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.news-card__badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  letter-spacing: 0.05em;
}

.news-card__date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.news-card__title {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.35;
  color: var(--color-text-primary);
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Hero Portada ────────────────────────────────────────────────────────── */
.news-card--hero {
  flex-direction: column;
}

@media (min-width: 768px) {
  .news-card--hero {
    flex-direction: row;
    height: 360px;
  }
  
  .news-card--hero .news-card__img-wrap {
    width: 60%;
    height: 100%;
  }

  .news-card--hero .news-card__body {
    width: 40%;
    padding: var(--space-6);
    justify-content: center;
  }
  
  .news-card--hero .news-card__title {
    font-size: 1.5rem;
    -webkit-line-clamp: 4;
  }
}

.news-card__desc {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Masonry Grid ────────────────────────────────────────────────────────── */
.news-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-4);
}

@media (min-width: 640px) {
  .news-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .news-grid {
    /* Si el sidebar ocupa ~320px, nos queda espacio para 2 o 3 columnas */
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }
}
</style>
