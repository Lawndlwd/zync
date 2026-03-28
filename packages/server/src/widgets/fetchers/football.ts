// ESPN hidden API — free, no API key, no auth
// Scoreboard: https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard
// Teams:      https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/teams

export const LEAGUES = [
  { slug: 'eng.1', name: 'Premier League' },
  { slug: 'esp.1', name: 'La Liga' },
  { slug: 'fra.1', name: 'Ligue 1' },
  { slug: 'ger.1', name: 'Bundesliga' },
  { slug: 'ita.1', name: 'Serie A' },
  { slug: 'uefa.champions', name: 'Champions League' },
  { slug: 'uefa.europa', name: 'Europa League' },
  { slug: 'fifa.world', name: 'World Cup' },
] as const

export interface FootballMatch {
  homeTeam: string
  homeLogo: string
  awayTeam: string
  awayLogo: string
  homeScore: number | null
  awayScore: number | null
  status: string // pre | in | post
  statusDetail: string
  date: string
  competition: string
}

export interface FootballData {
  league: string
  leagueSlug: string
  matches: FootballMatch[]
}

async function espn(path: string): Promise<any> {
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${path}`)
  if (!res.ok) throw new Error(`ESPN API error: ${res.status}`)
  return res.json()
}

export async function fetchLeagueScores(leagueSlug: string): Promise<FootballData> {
  const data = await espn(`${leagueSlug}/scoreboard`)

  const leagueName = data.leagues?.[0]?.name || leagueSlug
  const events: any[] = data.events || []

  const matches: FootballMatch[] = events.slice(0, 6).map((evt: any) => {
    const comp = evt.competitions?.[0]
    const home = comp?.competitors?.find((c: any) => c.homeAway === 'home')
    const away = comp?.competitors?.find((c: any) => c.homeAway === 'away')
    const status = comp?.status

    return {
      homeTeam: home?.team?.shortDisplayName || home?.team?.displayName || '?',
      homeLogo: home?.team?.logo || '',
      awayTeam: away?.team?.shortDisplayName || away?.team?.displayName || '?',
      awayLogo: away?.team?.logo || '',
      homeScore: home?.score != null ? parseInt(home.score, 10) : null,
      awayScore: away?.score != null ? parseInt(away.score, 10) : null,
      status: status?.type?.state || 'pre', // pre | in | post
      statusDetail: status?.type?.shortDetail || status?.type?.detail || '',
      date: evt.date || '',
      competition: leagueName,
    }
  })

  return { league: leagueName, leagueSlug, matches }
}

export async function searchTeams(
  query: string,
  leagueSlug = 'eng.1',
): Promise<Array<{ id: string; name: string; logo: string }>> {
  const data = await espn(`${leagueSlug}/teams`)
  const teams: any[] = data.sports?.[0]?.leagues?.[0]?.teams || []
  const q = query.toLowerCase()

  return teams
    .map((t: any) => t.team)
    .filter(
      (t: any) =>
        t.displayName?.toLowerCase().includes(q) ||
        t.shortDisplayName?.toLowerCase().includes(q) ||
        t.abbreviation?.toLowerCase().includes(q),
    )
    .slice(0, 8)
    .map((t: any) => ({
      id: t.id,
      name: t.shortDisplayName || t.displayName,
      logo: t.logos?.[0]?.href || '',
    }))
}
