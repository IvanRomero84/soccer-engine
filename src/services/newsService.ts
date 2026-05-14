/**
 * @file newsService.ts
 * Servicio para obtener noticias de los principales diarios deportivos españoles
 * a través de RSS, utilizando rss2json como bridge CORS.
 */

import type { NewsArticle, RssResponse, RssItem } from '@/types'

const RSS2JSON_BASE = 'https://api.rss2json.com/v1/api.json?rss_url='

const NEWS_SOURCES = [
  { name: 'Marca', url: 'https://objetos.estaticos-marca.com/rss/futbol/primera-division.xml' },
  { name: 'AS', url: 'https://feeds.as.com/mrss-s/pages/as/site/as.com/section/futbol/portada/' },
  { name: 'Sport', url: 'https://www.sport.es/es/rss/futbol/rss.xml' },
]

/**
 * Extrae la URL de la imagen del item RSS.
 * Rss2Json suele mapear <enclosure> a item.enclosure.link,
 * o si hay un img en la descripción/content, intenta parsearlo a item.thumbnail.
 * Si falla, intentamos hacer un regex manual.
 */
function extractThumbnail(item: RssItem): string | undefined {
  if (item.thumbnail) return item.thumbnail
  if (item.enclosure?.link) return item.enclosure.link

  // Regex para buscar src="..." en content o description
  const imgRegex = /<img[^>]+src="([^">]+)"/i
  const match = imgRegex.exec(item.content) || imgRegex.exec(item.description)
  if (match && match[1]) {
    return match[1]
  }

  return undefined
}

/**
 * Normaliza el RSS Item a nuestra interfaz unificada NewsArticle.
 */
function mapRssItemToArticle(item: RssItem, sourceName: string): NewsArticle {
  return {
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    content: item.description || item.content, // Usualmente description tiene el resumen útil
    thumbnail: extractThumbnail(item),
    source: sourceName,
  }
}

/**
 * Realiza las llamadas a todos los feeds concurrentemente y unifica los resultados.
 */
export async function fetchAllRSSFeeds(): Promise<NewsArticle[]> {
  const fetchPromises = NEWS_SOURCES.map(async (source) => {
    try {
      const encodedUrl = encodeURIComponent(source.url)
      const response = await fetch(`${RSS2JSON_BASE}${encodedUrl}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      
      const data: RssResponse = await response.json()
      if (data.status !== 'ok') {
        console.warn(`[newsService] Error en rss2json para ${source.name}: status no ok`)
        return []
      }

      return data.items.map(item => mapRssItemToArticle(item, source.name))
    } catch (err) {
      console.error(`[newsService] Falló la carga del feed de ${source.name}:`, err)
      return [] // En caso de fallo en una fuente, retornamos vacío para no bloquear el resto
    }
  })

  const results = await Promise.all(fetchPromises)
  const allArticles = results.flat()

  // Ordenar por fecha de publicación descendente (más recientes primero)
  allArticles.sort((a, b) => {
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  })

  return allArticles
}
