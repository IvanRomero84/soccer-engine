/**
 * @file useNewsStore.ts
 * Store de Pinia para el feed de noticias (RSS Feeds unificados).
 * Caché en memoria de 15 minutos.
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchAllRSSFeeds } from '@/services/newsService'
import type { NewsArticle } from '@/types'

const NEWS_TTL_MS = 5 * 60 * 1000 // 5 min

export const useNewsStore = defineStore('news', () => {
  const articles = ref<NewsArticle[]>([])
  const fetchedAt = ref<number | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function isFresh(): boolean {
    return fetchedAt.value !== null && Date.now() - fetchedAt.value < NEWS_TTL_MS
  }

  /**
   * Carga las noticias de todos los feeds RSS.
   * @param force  Si true, ignora la caché
   */
  async function fetchAllNews(force = false): Promise<NewsArticle[]> {
    if (!force && isFresh() && articles.value.length > 0) {
      return articles.value
    }

    isLoading.value = true
    error.value = null

    try {
      articles.value = await fetchAllRSSFeeds()
      fetchedAt.value = Date.now()
      return articles.value
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al cargar noticias'
      error.value = msg
      throw new Error(msg)
    } finally {
      isLoading.value = false
    }
  }

  return {
    articles,
    fetchedAt,
    isLoading,
    error,
    fetchAllNews,
  }
})
