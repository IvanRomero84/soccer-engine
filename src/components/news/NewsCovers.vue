<template>
  <section class="news-covers" @mouseenter="showControls = true" @mouseleave="showControls = false">
    <div class="section-header">
      <div class="header-content">
        <h2 class="section-title">Quiosco de Portadas</h2>
        <p class="section-subtitle">Titulares del día en la prensa deportiva</p>
      </div>
      <div class="scroll-indicators" v-if="hasScroll">
        <span class="indicator-dot" :class="{ active: scrollProgress < 0.3 }"></span>
        <span class="indicator-dot" :class="{ active: scrollProgress >= 0.3 && scrollProgress < 0.7 }"></span>
        <span class="indicator-dot" :class="{ active: scrollProgress >= 0.7 }"></span>
      </div>
    </div>

    <div class="covers-container" :class="{ 'can-scroll-left': !isAtStart, 'can-scroll-right': !isAtEnd }">
      <button 
        v-if="hasScroll"
        class="scroll-btn scroll-btn--left" 
        :class="{ 'is-visible': showControls && !isAtStart }"
        @click="scroll('left')"
        aria-label="Desplazar a la izquierda"
      >
        <span class="arrow">←</span>
      </button>

      <div class="covers-track" ref="track" @scroll="handleScroll">
        <div 
          v-for="cover in covers" 
          :key="cover.id" 
          class="cover-card"
          @click="openLightbox(cover)"
        >
          <div class="cover-image-container">
            <img :src="cover.url" :alt="`Portada de ${cover.name}`" class="cover-image" @error="handleImageError(cover.id)" />
            <div class="cover-overlay">
              <span class="cover-zoom-icon">🔍</span>
            </div>
          </div>
          <div class="cover-info">
            <span class="cover-name">{{ cover.name }}</span>
            <span class="cover-tag">{{ cover.country }}</span>
          </div>
        </div>
      </div>

      <button 
        v-if="hasScroll"
        class="scroll-btn scroll-btn--right" 
        :class="{ 'is-visible': showControls && !isAtEnd }"
        @click="scroll('right')"
        aria-label="Desplazar a la derecha"
      >
        <span class="arrow">→</span>
      </button>
    </div>

    <!-- Lightbox -->
    <Transition name="fade">
      <div v-if="selectedCover" class="lightbox" @click="selectedCover = null">
        <button class="lightbox-close" @click="selectedCover = null">&times;</button>
        <div class="lightbox-content" @click.stop>
          <img :src="selectedCover.url" :alt="selectedCover.name" class="lightbox-image" />
          <div class="lightbox-caption">
            <h3>{{ selectedCover.name }}</h3>
            <p>{{ selectedCover.country }} — Portada del día</p>
          </div>
        </div>
      </div>
    </Transition>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const getTodayStr = (offset = 0) => {
  const now = new Date()
  if (offset !== 0) now.setDate(now.getDate() + offset)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}/${m}/${d}`
}

const today = getTodayStr()
const yesterday = getTodayStr(-1)

interface Cover {
  id: string
  name: string
  country: string
  url: string
  path: string
  retried?: boolean
}

const covers = ref<Cover[]>([
  { id: 'marca', name: 'Marca', country: 'España', path: 'es/marca', url: `https://img.kiosko.net/${today}/es/marca.750.jpg` },
  { id: 'as', name: 'AS', country: 'España', path: 'es/as', url: `https://img.kiosko.net/${today}/es/as.750.jpg` },
  { id: 'md', name: 'Mundo Deportivo', country: 'España', path: 'es/mundodeportivo', url: `https://img.kiosko.net/${today}/es/mundodeportivo.750.jpg` },
  { id: 'sport', name: 'Sport', country: 'España', path: 'es/sport', url: `https://img.kiosko.net/${today}/es/sport.750.jpg` },
  { id: 'el9', name: 'L\'Esportiu', country: 'España', path: 'es/el9', url: `https://img.kiosko.net/${today}/es/el9.750.jpg` },
  { id: 'lequipe', name: 'L\'Equipe', country: 'Francia', path: 'fr/l_equip', url: `https://img.kiosko.net/${today}/fr/l_equip.750.jpg` },
  { id: 'gazzetta', name: 'Gazzetta', country: 'Italia', path: 'it/gazzetta_sport', url: `https://img.kiosko.net/${today}/it/gazzetta_sport.750.jpg` },
  { id: 'corriere_sport', name: 'Corriere dello Sport', country: 'Italia', path: 'it/corriere_sport', url: `https://img.kiosko.net/${today}/it/corriere_sport.750.jpg` },
  { id: 'tuttosport', name: 'Tuttosport', country: 'Italia', path: 'it/tuttosport', url: `https://img.kiosko.net/${today}/it/tuttosport.750.jpg` },
  { id: 'a_bola', name: 'A Bola', country: 'Portugal', path: 'pt/a_bola', url: `https://img.kiosko.net/${today}/pt/a_bola.750.jpg` },
  { id: 'ole', name: 'Olé', country: 'Argentina', path: 'ar/ole', url: `https://img.kiosko.net/${today}/ar/ole.750.jpg` },
  { id: 'daily_star', name: 'Daily Star', country: 'UK', path: 'uk/daily_star', url: `https://img.kiosko.net/${today}/uk/daily_star.750.jpg` },
  { id: 'daily_mail', name: 'Daily Mail', country: 'UK', path: 'uk/daily_mail', url: `https://img.kiosko.net/${today}/uk/daily_mail.750.jpg` },
])

const selectedCover = ref<Cover | null>(null)
const track = ref<HTMLElement | null>(null)
const isAtStart = ref(true)
const isAtEnd = ref(false)
const hasScroll = ref(false)
const showControls = ref(false)
const scrollProgress = ref(0)

function openLightbox(cover: Cover) {
  selectedCover.value = cover
}

function handleImageError(id: string) {
  const cover = covers.value.find(c => c.id === id)
  if (cover && !cover.retried) {
    // Try yesterday's cover (common for timezone differences or late updates)
    cover.retried = true
    cover.url = `https://img.kiosko.net/${yesterday}/${cover.path}.750.jpg`
    return
  }
  
  // If already retried or not found, remove it quietly
  covers.value = covers.value.filter(c => c.id !== id)
  checkScroll()
}

function handleScroll() {
  if (!track.value) return
  
  const { scrollLeft, scrollWidth, clientWidth } = track.value
  isAtStart.value = scrollLeft <= 10
  isAtEnd.value = scrollLeft + clientWidth >= scrollWidth - 10
  scrollProgress.value = scrollLeft / (scrollWidth - clientWidth)
}

function scroll(direction: 'left' | 'right') {
  if (!track.value) return
  
  const scrollAmount = track.value.clientWidth * 0.8
  track.value.scrollBy({
    left: direction === 'left' ? -scrollAmount : scrollAmount,
    behavior: 'smooth'
  })
}

function checkScroll() {
  if (!track.value) return
  hasScroll.value = track.value.scrollWidth > track.value.clientWidth
  handleScroll()
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  checkScroll()
  window.addEventListener('resize', checkScroll)
  
  // Also watch for content changes
  if (track.value) {
    resizeObserver = new ResizeObserver(checkScroll)
    resizeObserver.observe(track.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', checkScroll)
  if (resizeObserver) resizeObserver.disconnect()
})
</script>

<style scoped>
.news-covers {
  margin-bottom: var(--space-8);
  padding: var(--space-6) 0;
  position: relative;
}

.section-header { 
  margin-bottom: var(--space-5); 
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}
.section-subtitle { font-size: 0.85rem; color: var(--color-text-muted); margin-top: 2px; }

.scroll-indicators {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  transition: all 0.3s ease;
}

.indicator-dot.active {
  background: var(--color-accent);
  transform: scale(1.2);
}

.covers-container {
  position: relative;
  margin: 0 calc(var(--space-4) * -1);
  padding: 0 var(--space-4);
}

/* Gradients for scroll indication */
.covers-container::before,
.covers-container::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: var(--space-6);
  width: 100px;
  pointer-events: none;
  z-index: 2;
  transition: opacity 0.3s;
}

.covers-container::before {
  left: 0;
  background: linear-gradient(to right, var(--color-bg), transparent);
  opacity: 0;
}

.covers-container::after {
  right: 0;
  background: linear-gradient(to left, var(--color-bg), transparent);
  opacity: 1;
}

.covers-container.can-scroll-left::before { opacity: 1; }
.covers-container.can-scroll-right::after { opacity: 1; }
.covers-container:not(.can-scroll-right)::after { opacity: 0; }

.covers-track {
  display: flex;
  gap: var(--space-4);
  overflow-x: auto;
  padding: var(--space-2) var(--space-1) var(--space-6);
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-behavior: smooth;
  -webkit-overflow-scrolling: touch;
}
.covers-track::-webkit-scrollbar { display: none; }

.cover-card {
  flex: 0 0 160px;
  cursor: pointer;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  position: relative;
  z-index: 1;
}

.cover-card:hover {
  transform: translateY(-8px) scale(1.02);
  z-index: 5;
}

.cover-image-container {
  position: relative;
  aspect-ratio: 3/4;
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.05);
  background: var(--color-bg-elevated);
}

.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.cover-card:hover .cover-overlay { opacity: 1; }

.cover-zoom-icon { font-size: 1.5rem; }

.cover-info {
  margin-top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cover-name { font-size: 0.85rem; font-weight: 700; color: var(--color-text-primary); }
.cover-tag { font-size: 0.7rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

/* Scroll Buttons */
.scroll-btn {
  position: absolute;
  top: 40%;
  transform: translateY(-50%);
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-strong);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 10;
  opacity: 0;
  pointer-events: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 8px 16px rgba(0,0,0,0.3);
}

.scroll-btn.is-visible {
  opacity: 1;
  pointer-events: auto;
}

.scroll-btn--left { left: var(--space-2); transform: translateY(-50%) translateX(-10px); }
.scroll-btn--right { right: var(--space-2); transform: translateY(-50%) translateX(10px); }

.scroll-btn.is-visible.scroll-btn--left { transform: translateY(-50%) translateX(0); }
.scroll-btn.is-visible.scroll-btn--right { transform: translateY(-50%) translateX(0); }

.scroll-btn:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: white;
  transform: translateY(-50%) scale(1.1) !important;
}

.arrow { font-size: 1.25rem; font-weight: bold; }

/* Lightbox */
.lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
}

.lightbox-close {
  position: absolute;
  top: var(--space-6);
  right: var(--space-6);
  background: none;
  border: none;
  color: white;
  font-size: 2.5rem;
  cursor: pointer;
  z-index: 1001;
}

.lightbox-content {
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-4);
}

.lightbox-image {
  max-width: 100%;
  max-height: 80vh;
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
}

.lightbox-caption { text-align: center; color: white; }
.lightbox-caption h3 { font-size: 1.5rem; margin-bottom: 4px; }
.lightbox-caption p { color: var(--color-text-muted); }

@media (min-width: 768px) {
  .cover-card { flex: 0 0 200px; }
  .scroll-btn--left { left: var(--space-6); }
  .scroll-btn--right { right: var(--space-6); }
}

@media (max-width: 768px) {
  .scroll-btn { display: none; }
  .covers-container::before, .covers-container::after { display: none; }
}
</style>
