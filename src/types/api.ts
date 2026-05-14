/**
 * @file api.ts
 * Interfaces crudas para las respuestas de football-data.org v4.
 */

export interface FDTeam {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
  address?: string
  website?: string
  founded?: number
  clubColors?: string
  venue?: string
}

export interface FDCompetition {
  id: number
  name: string
  code: string
  type: string
  emblem: string
}

export interface FDStandingEntry {
  position: number
  team: FDTeam
  playedGames: number
  form: string | null
  won: number
  draw: number
  lost: number
  points: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
}

export interface FDStanding {
  stage: string
  type: string // "TOTAL", "HOME", "AWAY"
  group: string | null
  table: FDStandingEntry[]
}

export interface FDStandingsResponse {
  filters: any
  competition: FDCompetition
  season: any
  standings: FDStanding[]
}

export interface FDMatch {
  id: number
  utcDate: string
  status: string // "SCHEDULED", "TIMED", "IN_PLAY", "PAUSED", "FINISHED", "POSTPONED", "SUSPENDED", "CANCELLED"
  minute?: number
  competition: FDCompetition
  homeTeam: FDTeam
  awayTeam: FDTeam
  score: {
    winner: string | null
    duration: string
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
}

export interface FDMatchesResponse {
  filters: any
  resultSet: any
  matches: FDMatch[]
}

export interface FDPlayer {
  id: number
  name: string
  position: string
  dateOfBirth: string
  nationality: string
  shirtNumber: number | null
}

export interface FDTeamResponse extends FDTeam {
  squad: FDPlayer[]
  runningCompetitions?: FDCompetition[]
}

// ─── Cache entry genérico ─────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T
  fetchedAt: number
}
