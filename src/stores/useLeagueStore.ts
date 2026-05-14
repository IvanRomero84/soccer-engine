/**
 * @file useLeagueStore.ts
 * Store de Pinia para ligas y clasificaciones (football-data.org v4).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { fetchFromFootballDataOrg } from '@/services/api'
import type {
  League,
  LeagueStandings,
  StandingEntry,
  Match,
  CacheEntry,
} from '@/types'
import type { FDStandingsResponse, FDStandingEntry, FDMatchesResponse, FDMatch } from '@/types/api'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 hora
const LS_KEY_STANDINGS = 'se_standings_'

function mapStandingEntry(e: FDStandingEntry): StandingEntry {
  const record = {
    played: e.playedGames || 0,
    win: e.won || 0,
    draw: e.draw || 0,
    lose: e.lost || 0,
    goalsFor: e.goalsFor || 0,
    goalsAgainst: e.goalsAgainst || 0,
    goalsDiff: e.goalDifference || 0,
  }

  return {
    rank: e.position || 0,
    teamId: e.team.id,
    teamName: e.team.shortName || e.team.name,
    teamLogo: e.team.crest,
    points: e.points || 0,
    goalsDiff: e.goalDifference || 0,
    group: undefined,
    form: e.form || undefined,
    description: undefined,
    all: record,
    home: record,
    away: record,
    update: undefined,
  }
}

function mapFixtureStatus(status: string): Match['status'] {
  const s = status?.toUpperCase() || ''
  if (['SCHEDULED', 'TIMED'].includes(s)) return 'NS'
  if (['IN_PLAY', 'PAUSED'].includes(s)) return 'LIVE'
  if (['FINISHED'].includes(s)) return 'FT'
  if (['POSTPONED'].includes(s)) return 'PST'
  if (['SUSPENDED', 'CANCELLED', 'AWARDED'].includes(s)) return 'CANC'
  return 'NS'
}

function mapFixture(f: FDMatch): Match {
  return {
    id: f.id,
    referee: undefined,
    date: f.utcDate,
    timestamp: new Date(f.utcDate).getTime(),
    timezone: 'UTC',
    leagueId: f.competition?.id || 0,
    leagueName: f.competition?.name || '',
    leagueLogo: f.competition?.emblem || '',
    leagueCountry: '',
    season: new Date(f.utcDate).getFullYear(),
    round: '', 
    homeTeam: { id: f.homeTeam.id, name: f.homeTeam.shortName || f.homeTeam.name, logo: f.homeTeam.crest },
    awayTeam: { id: f.awayTeam.id, name: f.awayTeam.shortName || f.awayTeam.name, logo: f.awayTeam.crest },
    status: mapFixtureStatus(f.status),
    statusLong: f.status,
    elapsed: f.minute || undefined,
    goals: { home: f.score?.fullTime?.home ?? null, away: f.score?.fullTime?.away ?? null },
    score: {
      halftime: { home: f.score?.halfTime?.home ?? null, away: f.score?.halfTime?.away ?? null },
      fulltime: { home: f.score?.fullTime?.home ?? null, away: f.score?.fullTime?.away ?? null },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  }
}

function readFromLocalStorage<T>(key: string): CacheEntry<T> | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) as CacheEntry<T> : null
  } catch {
    return null
  }
}

function writeToLocalStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify({ data, fetchedAt: Date.now() }))
  } catch (e) {
    console.warn('[LeagueStore] No se pudo escribir en localStorage:', e)
  }
}

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < CACHE_TTL_MS
}

export const useLeagueStore = defineStore('league', () => {
  const standingsCache = ref<Map<string | number, LeagueStandings>>(new Map())
  const fixturesCache = ref<Map<string | number, CacheEntry<Match[]>>>(new Map())
  const selectedLeagueId = ref<number | string | null>(null)

  const getCurrentSeasonYear = () => {
    const now = new Date()
    return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  }

  const selectedSeason = ref<number>(getCurrentSeasonYear())
  const leagues = ref<League[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const currentStandings = computed<LeagueStandings | null>(() =>
    selectedLeagueId.value !== null
      ? (standingsCache.value.get(selectedLeagueId.value) ?? null)
      : null,
  )

  const currentFixtures = computed<Match[]>(() => {
    if (selectedLeagueId.value === null) return []
    return fixturesCache.value.get(selectedLeagueId.value)?.data ?? []
  })

  async function fetchStandings(leagueId: number | string): Promise<LeagueStandings> {
    const cached = standingsCache.value.get(leagueId)
    if (cached && isFresh(cached.fetchedAt)) return cached

    const lsKey = `${LS_KEY_STANDINGS}${leagueId}_${selectedSeason.value}`
    const lsCached = readFromLocalStorage<LeagueStandings>(lsKey)
    if (lsCached && isFresh(lsCached.fetchedAt)) {
      standingsCache.value.set(leagueId, lsCached.data)
      return lsCached.data
    }

    isLoading.value = true
    error.value = null

    try {
      const res = await fetchFromFootballDataOrg<FDStandingsResponse>(`/competitions/${leagueId}/standings`, { season: selectedSeason.value })

      if (!res || !res.standings || res.standings.length === 0) {
        throw new Error(`No se encontraron clasificaciones para la liga ${leagueId} en la temporada ${selectedSeason.value}`)
      }

      // Tomamos la tabla de la liga principal (type 'TOTAL')
      const totalStanding = res.standings.find(s => s.type === 'TOTAL') || res.standings[0]

      const result: LeagueStandings = {
        leagueId,
        leagueName: res.competition.name,
        leagueLogo: res.competition.emblem,
        season: selectedSeason.value,
        standings: [totalStanding.table.map(mapStandingEntry)],
        fetchedAt: Date.now(),
      }

      standingsCache.value.set(leagueId, result)
      writeToLocalStorage(lsKey, result)
      return result
    } catch (e: any) {
      error.value = e.message || 'Error desconocido al cargar clasificación'
      throw new Error(error.value!)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchUpcomingFixtures(leagueId: number | string, next = 10): Promise<Match[]> {
    const cached = fixturesCache.value.get(leagueId)
    if (cached && isFresh(cached.fetchedAt)) return cached.data

    isLoading.value = true
    error.value = null

    try {
      const res = await fetchFromFootballDataOrg<FDMatchesResponse>(`/competitions/${leagueId}/matches`, { status: 'SCHEDULED', season: selectedSeason.value })
      
      let matches: Match[] = []
      if (res && res.matches) {
        matches = res.matches.slice(0, next).map(mapFixture)
      }
      
      fixturesCache.value.set(leagueId, { data: matches, fetchedAt: Date.now() })
      return matches
    } catch (e: any) {
      error.value = e.message || 'Error al cargar fixtures'
      throw new Error(error.value!)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchLiveMatches(): Promise<Match[]> {
    isLoading.value = true
    error.value = null
    try {
      const res = await fetchFromFootballDataOrg<FDMatchesResponse>('/matches', { status: 'IN_PLAY,PAUSED' })
      return (res && res.matches) ? res.matches.map(mapFixture) : []
    } catch (e: any) {
      error.value = e.message || 'Error al cargar partidos en vivo'
      throw new Error(error.value!)
    } finally {
      isLoading.value = false
    }
  }

  function invalidateLeagueCache(leagueId: number | string): void {
    standingsCache.value.delete(leagueId)
    fixturesCache.value.delete(leagueId)
    const lsKey = `${LS_KEY_STANDINGS}${leagueId}_${selectedSeason.value}`
    localStorage.removeItem(lsKey)
  }

  function clearAllCache(): void {
    standingsCache.value.clear()
    fixturesCache.value.clear()
    Object.keys(localStorage)
      .filter((k) => k.startsWith(LS_KEY_STANDINGS))
      .forEach((k) => localStorage.removeItem(k))
  }

  return {
    standingsCache,
    fixturesCache,
    selectedLeagueId,
    selectedSeason,
    leagues,
    isLoading,
    error,
    currentStandings,
    currentFixtures,
    fetchStandings,
    fetchUpcomingFixtures,
    fetchLiveMatches,
    invalidateLeagueCache,
    clearAllCache,
  }
})
