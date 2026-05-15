/**
 * @file useClubStore.ts
 * Store de Pinia para fichas de club.
 * Consume la API de football-data.org v4.
 */

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
    if (cached && isFresh(cached.fetchedAt)) {
      return cached.data
    }

    isLoading.value = true
    error.value = null

    try {
      const now = new Date()
      const defaultSeason = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
      const currentSeason = season ?? defaultSeason

      // 1. Fetch info de API (incluye Squad)
      const teamRes = await fetchFromFootballDataOrg<FDTeamResponse>(`/teams/${clubId}`)
      if (!teamRes) {
        throw new Error('Equipo no encontrado')
      }

      // Mapear plantilla
      const squad: ClubPlayer[] = (teamRes.squad || []).map(p => ({
        id: p.id,
        name: p.name,
        photo: '', // football-data org doesn't usually provide player photos
        number: p.shirtNumber || undefined,
        position: p.position || 'Unknown',
        nationality: p.nationality || '',
        age: p.dateOfBirth ? (new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()) : undefined,
        injured: false,
      }))

      // 2. Fetch últimos 5 partidos para stats/form
      let stats: ClubStatsSeason[] = []
      try {
        const matchesRes = await fetchFromFootballDataOrg<FDMatchesResponse>(`/teams/${clubId}/matches`, { status: 'FINISHED', limit: 5 })

        if (matchesRes && matchesRes.matches && matchesRes.matches.length > 0) {
          let wins = 0, draws = 0, losses = 0, gf = 0, ga = 0
          let formStr = ''

          matchesRes.matches.forEach(match => {
            const isHome = match.homeTeam.id === Number(clubId)
            const myScore = isHome ? match.score.fullTime.home : match.score.fullTime.away
            const oppScore = isHome ? match.score.fullTime.away : match.score.fullTime.home

            if (myScore !== null && oppScore !== null) {
              gf += myScore
              ga += oppScore
              if (myScore > oppScore) { wins++; formStr += 'W' }
              else if (myScore === oppScore) { draws++; formStr += 'D' }
              else { losses++; formStr += 'L' }
            }
          })

          stats.push({
            leagueId: 0,
            leagueName: 'Últimos Partidos',
            season: `${currentSeason}`,
            played: wins + draws + losses,
            wins, draws, losses,
            goalsFor: gf, goalsAgainst: ga,
            points: wins * 3 + draws,
            form: formStr.split('').reverse().join(''), // De reciente a antiguo
          })
        }
      } catch (e) {
        console.warn('Error fetching last matches:', e)
      }

      const club: Club = {
        id: teamRes.id,
        name: teamRes.name,
        code: teamRes.tla || (teamRes as any).tla || '',
        country: (teamRes as any).country || '',
        founded: (teamRes as any).founded || teamRes.founded,
        national: false,
        logo: teamRes.crest || '',
        venue: (teamRes as any).venue && typeof (teamRes as any).venue === 'object' ? (teamRes as any).venue : {
          name: (teamRes as any).venue || '',
        },
        coach: (teamRes as any).coach,
        trophies: ((teamRes as any).trophies || []).map((t: any) => ({
          league: t.league,
          country: '',
          season: t.seasons || `${t.count}x`,
          place: 'Winner',
          image: t.image
        })),
        stats,
        squad: ((teamRes as any).squad || squad).map((p: any) => ({
          ...p,
          rating: p.stats ? calculateRating(p.stats) : p.rating
        })),
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

  /**
   * Calcula un rating ficticio basado en stats (solo para visualización premium)
   */
  function calculateRating(stats: any) {
    let r = 6.0
    r += (stats.goals || 0) * 0.2
    r += (stats.assists || 0) * 0.15
    if (stats.minutes > 2000) r += 0.5
    return Math.min(9.9, r)
  }

  return {
    clubCache,
    isLoading,
    error,
    fetchClub,
  }
})
