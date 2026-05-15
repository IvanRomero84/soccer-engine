import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fetchFromFootballDataOrg } from '@/services/api'
import type { Club, ClubStatsSeason, CacheEntry, ClubPlayer } from '@/types'
import type { FDTeamResponse, FDMatchesResponse } from '@/types/api'

const CLUB_TTL_MS = 60 * 60 * 1000 // 1 hora

export const useClubStore = defineStore('club', () => {
  const clubCache = ref<Map<number | string, CacheEntry<Club>>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  function isFresh(fetchedAt: number): boolean {
    return Date.now() - fetchedAt < CLUB_TTL_MS
  }

  async function fetchClub(clubId: number | string, season?: number): Promise<Club> {
    const cached = clubCache.value.get(clubId)
    if (cached && isFresh(cached.fetchedAt)) return cached.data

    isLoading.value = true
    error.value = null

    try {
      const now = new Date()
      const defaultSeason = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
      const currentSeason = season ?? defaultSeason

      // 1. Fetch info de API enriquecida (scraper)
      const teamRes = await fetchFromFootballDataOrg<FDTeamResponse>(`/teams/${clubId}`)
      if (!teamRes) throw new Error('Equipo no encontrado')

      // Mapear plantilla directamente desde el scraper (evitando duplicados)
      const rawSquad = (teamRes as any).squad || teamRes.squad || []
      const squad: ClubPlayer[] = rawSquad.map((p: any) => ({
        id: p.id,
        name: p.name,
        photo: p.photo || '',
        number: p.number || p.shirtNumber || undefined,
        position: p.position || 'Unknown',
        nationality: p.nationality || '',
        age: p.age || (p.dateOfBirth ? (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()) : undefined),
        injured: p.injured || false,
        marketValue: p.marketValue || '',
        rating: p.rating || (p.stats ? calculateRating(p.stats) : 7.0)
      }))

      // Fetch partidos para stats (si el scraper no las dio)
      let stats: ClubStatsSeason[] = []
      if ((teamRes as any).stats) {
        stats = (teamRes as any).stats
      } else {
        try {
          const matchesRes = await fetchFromFootballDataOrg<FDMatchesResponse>(`/teams/${clubId}/matches`, { status: 'FINISHED', limit: 5 })
          if (matchesRes?.matches?.length) {
            let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0
            let formStr = ''
            matchesRes.matches.forEach(match => {
              const isHome = match.homeTeam.id === Number(clubId)
              const myScore = isHome ? match.score.fullTime.home : match.score.fullTime.away
              const oppScore = isHome ? match.score.fullTime.away : match.score.fullTime.home
              if (myScore !== null && oppScore !== null) {
                gf += myScore; ga += oppScore
                if (myScore > oppScore) { wins++; formStr += 'W' }
                else if (myScore === oppScore) { draws++; formStr += 'D' }
                else { losses++; formStr += 'L' }
              }
            })
            stats.push({
              leagueId: 0, leagueName: 'Últimos Partidos', season: `${currentSeason}`,
              played: wins + draws + losses, wins, draws, losses, goalsFor: gf, goalsAgainst: ga,
              points: wins * 3 + draws, form: formStr.split('').reverse().join('')
            })
          }
        } catch (e) { console.warn('Error fetching matches:', e) }
      }

      const club: Club = {
        id: teamRes.id,
        name: teamRes.name,
        code: teamRes.tla || (teamRes as any).tla || '',
        country: (teamRes as any).country || '',
        founded: (teamRes as any).founded || teamRes.founded,
        national: false,
        logo: (teamRes as any).logo || teamRes.crest || '',
        venue: (teamRes as any).venue || { name: (teamRes as any).venueName || '' },
        coach: (teamRes as any).coach || { name: 'No disponible' },
        trophies: ((teamRes as any).trophies || []).map((t: any) => ({
          league: t.league, country: '', season: t.season || `${t.count}x`, place: 'Winner', image: t.image
        })),
        stats,
        squad
      }

      clubCache.value.set(clubId, { data: club, fetchedAt: Date.now() })
      return club
    } catch (e: any) {
      error.value = e.message || 'Error al cargar club'
      throw new Error(error.value!)
    } finally {
      isLoading.value = false
    }
  }

  function calculateRating(stats: any) {
    let r = 6.0
    r += (stats.goals || 0) * 0.2
    r += (stats.assists || 0) * 0.15
    return Math.min(9.9, r)
  }

  return { clubCache, isLoading, error, fetchClub }
})
