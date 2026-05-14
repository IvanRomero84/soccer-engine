/**
 * @file player.ts
 * Interfaces para jugadores y estadísticas individuales.
 * Fuente: API-Football (/players)
 */

export interface PlayerBirth {
  date?: string
  place?: string
  country?: string
}

export interface PlayerStatistics {
  leagueId: number
  leagueName: string
  season: number
  teamId: number
  teamName: string
  /** Apariciones totales */
  appearances?: number
  lineups?: number
  minutesPlayed?: number
  goals?: number
  assists?: number
  /** Tarjetas amarillas */
  yellowCards?: number
  /** Tarjetas rojas directas */
  redCards?: number
  rating?: number
  /** Disparos totales */
  shots?: number
  /** Disparos a puerta */
  shotsOnTarget?: number
  /** Pases clave */
  keyPasses?: number
  /** Precisión de pases (%) */
  passAccuracy?: number
  /** Regates intentados */
  dribblesAttempted?: number
  /** Regates exitosos */
  dribblesSuccess?: number
}

export interface Player {
  id: number
  name: string
  firstname: string
  lastname: string
  age?: number
  nationality?: string
  height?: string
  weight?: string
  photo?: string
  injured?: boolean
  birth?: PlayerBirth
  position?: 'Goalkeeper' | 'Defender' | 'Midfielder' | 'Attacker'
  statistics?: PlayerStatistics[]
}
