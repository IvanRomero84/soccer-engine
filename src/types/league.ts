/**
 * @file league.ts
 * Interfaces para Ligas, Clasificaciones y Temporadas.
 * Fuente: Football-Data.org (/competitions, /standings)
 */

// ─── Liga ─────────────────────────────────────────────────────────────────────

export interface League {
  id: number | string
  name: string
  type: 'League' | 'Cup'
  logo: string
  country: string
  countryCode?: string
  countryFlag?: string
  /** Temporadas disponibles */
  seasons?: LeagueSeason[]
}

export interface LeagueSeason {
  year: number
  start: string
  end: string
  current: boolean
  coverage: {
    standings: boolean
    fixtures: boolean
    players: boolean
    topScorers: boolean
    predictions: boolean
  }
}

// ─── Clasificación (Standings) ────────────────────────────────────────────────

export interface StandingRecord {
  /** Partidos jugados */
  played: number
  win: number
  draw: number
  lose: number
  goalsFor: number
  goalsAgainst: number
  goalsDiff: number
}

export interface StandingEntry {
  rank: number
  teamId: number | string
  teamName: string
  teamLogo: string
  points: number
  goalsDiff: number
  group?: string
  form?: string
  /** Descripción de la zona (Champions, Descenso, etc.) */
  description?: string
  all: StandingRecord
  home: StandingRecord
  away: StandingRecord
  /** Fecha de la última actualización */
  update?: string
}

export interface LeagueStandings {
  leagueId: number | string
  leagueName: string
  leagueLogo: string
  season: number
  /** Una tabla por grupo (normalmente 1, en groups pueden ser varios) */
  standings: StandingEntry[][]
  /** Timestamp de cuando se cargaron estos datos */
  fetchedAt: number
}
