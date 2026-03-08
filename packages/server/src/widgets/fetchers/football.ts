import { getSecret } from '../../secrets/index.js'
import { getConfig } from '../../config/index.js'
import { logger } from '../../lib/logger.js'

export interface FootballMatch {
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  status: string
  date: string
  competition: string
}

export interface FootballTeamData {
  id: number
  name: string
  crest: string
  nextMatch: FootballMatch | null
  lastMatch: FootballMatch | null
}

const API_BASE = 'https://api.football-data.org/v4'

async function footballApi(path: string): Promise<any> {
  const apiKey = getSecret('FOOTBALL_API_KEY') || getConfig('FOOTBALL_API_KEY')
  if (!apiKey) throw new Error('FOOTBALL_API_KEY not configured')
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'X-Auth-Token': apiKey },
  })
  if (!res.ok) throw new Error(`Football API error: ${res.status}`)
  return res.json()
}

function mapMatch(m: any): FootballMatch {
  return {
    homeTeam: m.homeTeam.shortName || m.homeTeam.name,
    awayTeam: m.awayTeam.shortName || m.awayTeam.name,
    homeScore: m.score?.fullTime?.home ?? null,
    awayScore: m.score?.fullTime?.away ?? null,
    status: m.status,
    date: m.utcDate,
    competition: m.competition?.name || '',
  }
}

export async function fetchTeamData(teamId: number): Promise<FootballTeamData> {
  const team = await footballApi(`/teams/${teamId}`)
  const matches = await footballApi(`/teams/${teamId}/matches?status=SCHEDULED,LIVE,IN_PLAY,PAUSED,FINISHED&limit=10`)
  const allMatches: any[] = matches.matches || []
  const now = new Date()
  const past = allMatches.filter((m: any) => new Date(m.utcDate) < now && m.status === 'FINISHED')
  const upcoming = allMatches.filter((m: any) => new Date(m.utcDate) >= now || ['LIVE', 'IN_PLAY', 'PAUSED'].includes(m.status))
  const lastMatch = past.length > 0 ? mapMatch(past[past.length - 1]) : null
  const nextMatch = upcoming.length > 0 ? mapMatch(upcoming[0]) : null
  return {
    id: teamId,
    name: team.shortName || team.name,
    crest: team.crest,
    nextMatch,
    lastMatch,
  }
}

export async function searchTeams(query: string): Promise<Array<{ id: number; name: string; crest: string }>> {
  const data = await footballApi(`/teams?limit=10`)
  const teams: any[] = data.teams || []
  const q = query.toLowerCase()
  return teams
    .filter((t: any) => t.name.toLowerCase().includes(q) || (t.shortName || '').toLowerCase().includes(q))
    .slice(0, 5)
    .map((t: any) => ({ id: t.id, name: t.shortName || t.name, crest: t.crest }))
}
