/**
 * @file club.ts
 * Interfaces para representar un Club de fútbol.
 * Fuentes: Football-Data.org (/teams) y TheSportsDB (/lookupteam.php)
 */

// ─── Palmarés ─────────────────────────────────────────────────────────────────

export interface Trophy {
  /** Nombre del torneo/competición */
  league: string
  /** País de la competición */
  country: string
  /** Temporada de conquista, ej: "2022/2023" */
  season: string
  /** Fase alcanzada: campeón, finalista, etc. */
  place: 'Winner' | 'Runner-Up' | string
  /** URL de la imagen real del trofeo */
  image?: string
}

// ─── Estadísticas avanzadas de un club (por temporada/liga) ───────────────────

export interface ClubStatsSeason {
  /** ID de la liga */
  leagueId: number | string
  /** Nombre de la liga */
  leagueName: string
  /** Temporada ej: "2023/2024" */
  season: string
  /** Partidos jugados */
  played: number
  /** Victorias (local + visitante) */
  wins: number
  /** Empates */
  draws: number
  /** Derrotas */
  losses: number
  /** Goles a favor */
  goalsFor: number
  /** Goles en contra */
  goalsAgainst: number
  /** Expected Goals a favor (xG) */
  xGoalsFor?: number
  /** Expected Goals en contra (xGA) */
  xGoalsAgainst?: number
  /** Posesión media (%) */
  avgPossession?: number
  /** Puntos totales */
  points: number
  /** Posición final en la tabla */
  rank?: number
  /** Forma reciente (5 últimos): ['W','D','L',...] */
  form?: string
}

// ─── Plantilla ────────────────────────────────────────────────────────────────

export interface ClubPlayer {
  /** ID del jugador en Football-Data.org */
  id: number
  name: string
  /** URL de la foto */
  photo: string
  age?: number
  nationality: string
  position: string
  /** Número de dorsal */
  number?: number
  /** Valoración media de la temporada (0–10) */
  rating?: number
  marketValue?: string
  /** Estadísticas detalladas de la temporada */
  detailedStats?: {
    goals: number
    assists: number
    yellowCards: number
    secondYellows: number
    redCards: number
    minutes: number
    goalsConceded?: number
    cleanSheets?: number
  }
  /** Si está lesionado */
  injured: boolean
}

// ─── Entidad principal Club ───────────────────────────────────────────────────

export interface Club {
  /** ID único en Football-Data.org */
  id: number
  /** ID en TheSportsDB (para datos históricos) */
  theSportsDbId?: string
  name: string
  /** Nombre corto o abreviatura */
  shortName?: string
  /** Código de 3 letras, ej: "BAR" */
  code?: string
  country: string
  /** Ciudad sede */
  city?: string
  /** Año de fundación */
  founded?: number
  /** Si es un club nacional */
  national: boolean
  /** URL del escudo */
  logo: string
  /** URL del logo en alta resolución (TheSportsDB) */
  logoHD?: string
  /** Color principal del kit (hex) */
  primaryColor?: string
  /** Color secundario del kit (hex) */
  secondaryColor?: string
  venue: {
    name: string
    address?: string
    city?: string
    capacity?: number | string
    image?: string
  }
  /** Información del cuerpo técnico */
  coach?: {
    name: string
    age?: number | string
    photo?: string
    from?: string
  }
  /** Palmarés */
  trophies: Trophy[]
  /** Clasificación y stats de liga reales */
  seasonStats?: {
    rank: number
    points: number
    played: number
    goalsDiff: string | number
  }
  stats: ClubStatsSeason[]
  squad: ClubPlayer[]
}

// ─── Estadio ──────────────────────────────────────────────────────────────────

export interface VenueInfo {
  id?: number
  name: string
  city?: string
  capacity?: number
  /** URL de imagen del estadio */
  image?: string
  surface?: 'grass' | 'artificial turf' | string
}
