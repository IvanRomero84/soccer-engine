/**
 * @file match.ts
 * Interfaces para representar un Partido (fixture).
 * Fuente principal: Football-Data.org (/matches)
 */

import type { Club } from './club'

// ─── Estado del partido ───────────────────────────────────────────────────────

export type MatchStatus =
  | 'TBD'   // Por determinar
  | 'NS'    // Not Started
  | '1H'    // Primera parte
  | 'HT'    // Descanso
  | '2H'    // Segunda parte
  | 'ET'    // Prórroga
  | 'P'     // Penaltis
  | 'FT'    // Final
  | 'AET'   // Final tras prórroga
  | 'PEN'   // Final tras penaltis
  | 'PST'   // Pospuesto
  | 'CANC'  // Cancelado
  | 'ABD'   // Abandonado
  | 'SUSP'  // Suspendido
  | 'AWD'   // Adjudicado
  | 'WO'    // Walk Over
  | 'LIVE'  // En vivo (genérico)

// ─── Evento dentro del partido ────────────────────────────────────────────────

export type MatchEventType = 'Goal' | 'Card' | 'Subst' | 'Var'

export interface MatchEvent {
  /** Minuto del evento */
  time: number
  /** Minuto extra si lo hay (ej: 45+2) */
  timeExtra?: number
  /** ID del equipo que protagoniza el evento */
  teamId: number
  /** Nombre del jugador principal */
  player: string
  playerId?: number
  /** Asistente (en goles) o jugador que sale (sustituciones) */
  assist?: string
  assistId?: number
  type: MatchEventType
  /** Detalle: 'Normal Goal', 'Yellow Card', 'Red Card', etc. */
  detail: string
  comments?: string
}

// ─── Estadísticas del partido por equipo ─────────────────────────────────────

export interface MatchTeamStats {
  teamId: number
  /** Tiros a puerta */
  shotsOnGoal?: number
  /** Tiros totales */
  shotsTotal?: number
  /** Corners */
  corners?: number
  /** Posesión (%) */
  possession?: number
  /** xG – Expected Goals */
  xGoals?: number
  /** Faltas */
  fouls?: number
  /** Tarjetas amarillas */
  yellowCards?: number
  /** Tarjetas rojas */
  redCards?: number
  /** Salvadas del portero */
  saves?: number
  /** Pases totales */
  passes?: number
  /** Precisión de pases (%) */
  passAccuracy?: number
  /** Fueras de juego */
  offsides?: number
}

// ─── Marcador ────────────────────────────────────────────────────────────────

export interface Score {
  home: number | null
  away: number | null
}

export interface MatchScore {
  /** Marcador al descanso */
  halftime: Score
  /** Marcador al final de los 90' */
  fulltime: Score
  /** Marcador al final de la prórroga */
  extratime: Score
  /** Resultado en penaltis */
  penalty: Score
}

// ─── Entidad principal Partido ────────────────────────────────────────────────

export interface Match {
  /** ID del partido en Football-Data.org */
  id: number
  /** Árbitro */
  referee?: string
  /** Fecha y hora (ISO 8601 UTC) */
  date: string
  /** Timestamp Unix */
  timestamp: number
  /** Zona horaria del fixture */
  timezone: string

  // Liga y temporada
  leagueId: number | string
  leagueName: string
  leagueLogo?: string
  leagueCountry?: string
  season: number
  /** Jornada, ej: "Regular Season - 12" */
  round: string

  // Equipos
  homeTeam: Pick<Club, 'id' | 'name' | 'logo'>
  awayTeam: Pick<Club, 'id' | 'name' | 'logo'>

  // Estado
  status: MatchStatus
  /** Descripción larga del estado, ej: "Match Finished" */
  statusLong: string
  /** Minuto actual si el partido está en vivo */
  elapsed?: number

  // Marcador
  score: MatchScore
  /** Goles actuales (acceso rápido) */
  goals: Score

  // Datos enriquecidos (se cargan bajo demanda)
  events?: MatchEvent[]
  statistics?: [MatchTeamStats, MatchTeamStats]
  /** Alineaciones en formato posicional */
  lineups?: MatchLineup[]
}

// ─── Alineación ───────────────────────────────────────────────────────────────

export interface LineupPlayer {
  id: number
  name: string
  number: number
  position: string
  /** Posición en el grid (fila, columna) para la visualización táctica */
  grid?: string
}

export interface MatchLineup {
  teamId: number
  teamName: string
  teamLogo: string
  /** Sistema táctico, ej: "4-3-3" */
  formation: string
  startXI: LineupPlayer[]
  substitutes: LineupPlayer[]
  coach: string
}
