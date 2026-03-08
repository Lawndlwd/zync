import { resolve } from 'path'
import { logger } from '../../lib/logger.js'
import { upsertJob } from '../db.js'

// Redirect Crawlee storage to the writable data/ directory
process.env.CRAWLEE_STORAGE_DIR ??= resolve('data/crawlee')
import type { Campaign } from '../types.js'
import type { ScrapedJob } from './indeed.js'
import { scrapeIndeed } from './indeed.js'
import { scrapeLinkedIn } from './linkedin.js'
import { scrapeWTTJ } from './wttj.js'

export type ScraperName = 'indeed' | 'linkedin' | 'wttj'

const scrapers: Record<ScraperName, (query: string, location: string, country?: string, postedWithinDays?: number | null) => Promise<ScrapedJob[]>> = {
  indeed: scrapeIndeed,
  linkedin: scrapeLinkedIn,
  wttj: scrapeWTTJ,
}

// Words to ignore when extracting role keywords for title matching
const GENERIC_WORDS = new Set([
  'developer', 'engineer', 'manager', 'lead', 'senior', 'junior', 'mid',
  'level', 'staff', 'principal', 'head', 'chief', 'director', 'intern',
  'specialist', 'analyst', 'consultant', 'architect', 'associate',
  'of', 'and', 'the', 'a', 'an', 'in', 'at', 'for', 'with',
  'développeur', 'ingénieur', 'responsable',
])

function extractRoleKeywords(role: string): string[] {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1 && !GENERIC_WORDS.has(w))
}

function matchesLocation(jobLocation: string, city: string, country: string): boolean {
  const loc = jobLocation.toLowerCase()
  const cityMatch = city && loc.includes(city.toLowerCase())
  const countryMatch = country && loc.includes(country.toLowerCase())
  // Also accept "remote" locations
  const remoteMatch = loc.includes('remote') || loc.includes('télétravail')
  return cityMatch || countryMatch || remoteMatch
}

function matchesTitle(jobTitle: string, roleKeywords: string[]): boolean {
  if (roleKeywords.length === 0) return true
  const title = jobTitle.toLowerCase()
  return roleKeywords.some(kw => title.includes(kw))
}

export async function runScrapers(
  campaign: Campaign,
  enabledSources: ScraperName[] = ['indeed', 'linkedin', 'wttj'],
): Promise<number> {
  let totalInserted = 0
  const roleKeywords = extractRoleKeywords(campaign.role)
  const locationQuery = [campaign.city, campaign.country].filter(Boolean).join(', ')

  logger.info({ role: campaign.role, roleKeywords, city: campaign.city, country: campaign.country, postedWithinDays: campaign.posted_within_days }, 'Scraping with filters')

  for (const source of enabledSources) {
    const scraper = scrapers[source]
    if (!scraper) continue

    try {
      logger.info({ source, query: campaign.role, location: locationQuery }, 'Starting scraper')
      const jobs = await scraper(campaign.role, locationQuery, campaign.country, campaign.posted_within_days)

      let filtered = 0
      for (const job of jobs) {
        // Filter: location must match city or country
        if (!matchesLocation(job.location, campaign.city, campaign.country)) {
          filtered++
          continue
        }
        // Filter: title must contain at least one role keyword
        if (!matchesTitle(job.title, roleKeywords)) {
          filtered++
          continue
        }

        try {
          upsertJob({
            campaign_id: campaign.id,
            external_id: job.external_id,
            source: job.source,
            title: job.title,
            company: job.company,
            location: job.location,
            salary: job.salary,
            description: job.description,
            url: job.url,
          })
          totalInserted++
        } catch (err) {
          logger.debug({ external_id: job.external_id, source: job.source }, 'Job already exists, skipped')
        }
      }
      if (filtered > 0) {
        logger.info({ source, filtered, kept: jobs.length - filtered }, 'Post-scrape filtering applied')
      }
    } catch (err) {
      logger.error({ err, source, query: campaign.role }, 'Scraper failed')
    }
  }

  logger.info({ totalInserted, campaignId: campaign.id }, 'Scraping complete')
  return totalInserted
}
