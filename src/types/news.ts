/**
 * @file news.ts
 * Interfaces para artículos de noticias (RSS Feeds unificados).
 */

export interface NewsArticle {
  /** Título de la noticia */
  title: string
  /** URL original del artículo */
  link: string
  /** Fecha de publicación en formato ISO */
  pubDate: string
  /** Contenido o resumen HTML de la noticia */
  content?: string
  /** URL de la imagen principal */
  thumbnail?: string
  /** Nombre del diario (Marca, AS, Mundo Deportivo, Sport) */
  source: string
}

export interface RssItem {
  title: string
  pubDate: string
  link: string
  guid: string
  author: string
  thumbnail: string
  description: string
  content: string
  enclosure: {
    link: string
    type: string
  }
  categories: string[]
}

export interface RssResponse {
  status: 'ok' | 'error'
  feed: {
    url: string
    title: string
    link: string
    author: string
    description: string
    image: string
  }
  items: RssItem[]
}
