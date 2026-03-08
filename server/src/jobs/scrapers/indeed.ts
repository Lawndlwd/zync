import { PlaywrightCrawler } from 'crawlee'
import { logger } from '../../lib/logger.js'
import type { JobSource } from '../types.js'

export interface ScrapedJob {
  external_id: string
  source: JobSource
  title: string
  company: string
  location: string
  salary: string | null
  description: string
  url: string
}

const COUNTRY_DOMAINS: Record<string, string> = {
  france: 'https://www.indeed.fr',
  uk: 'https://www.indeed.co.uk',
  'united kingdom': 'https://www.indeed.co.uk',
  germany: 'https://de.indeed.com',
  spain: 'https://www.indeed.es',
  italy: 'https://it.indeed.com',
  netherlands: 'https://www.indeed.nl',
  belgium: 'https://www.indeed.be',
  switzerland: 'https://www.indeed.ch',
  portugal: 'https://www.indeed.pt',
  canada: 'https://www.indeed.ca',
  australia: 'https://au.indeed.com',
}

export async function scrapeIndeed(query: string, location: string, country?: string, postedWithinDays?: number | null, maxPages = 3): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = []
  const baseUrl = (country && COUNTRY_DOMAINS[country.toLowerCase()]) || 'https://www.indeed.com'

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxPages * 20,
    maxConcurrency: 1,
    headless: true,
    requestHandlerTimeoutSecs: 45,
    launchContext: {
      launchOptions: {
        args: ['--disable-blink-features=AutomationControlled'],
      },
    },
    async requestHandler({ page, request }) {
      // Wait for job cards
      await page.waitForSelector('div.job_seen_beacon, div.jobsearch-ResultsList > div', { timeout: 15000 }).catch(() => {})

      // Scroll to load content
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 800))
        await page.waitForTimeout(600)
      }

      const cards = await page.$$('div.job_seen_beacon, div.jobsearch-ResultsList > div')
      for (const card of cards) {
        const title = await card.$eval('h2.jobTitle a, a[data-jk]', el => el.textContent?.trim() || '').catch(() => '')
        const jobKey = await card.$eval('h2.jobTitle a, a[data-jk]', el => {
          const jk = el.getAttribute('data-jk')
          if (jk) return jk
          const href = el.getAttribute('href') || ''
          const match = href.match(/jk=([^&]+)/)
          return match?.[1] || ''
        }).catch(() => '')

        if (!title || !jobKey) continue

        const company = await card.$eval('[data-testid="company-name"], span.companyName', el => el.textContent?.trim() || '').catch(() => '')
        const loc = await card.$eval('[data-testid="text-location"], div.companyLocation', el => el.textContent?.trim() || '').catch(() => '')
        const salary = await card.$eval('div.salary-snippet-container, div.metadata.salary-snippet-container', el => el.textContent?.trim() || '').catch(() => '') || null
        const snippet = await card.$eval('div.job-snippet, table.jobCardShelfContainer td', el => el.textContent?.trim() || '').catch(() => '')

        jobs.push({
          external_id: jobKey,
          source: 'indeed',
          title,
          company,
          location: loc,
          salary: salary || null,
          description: snippet,
          url: `${baseUrl}/viewjob?jk=${jobKey}`,
        })
      }

      // Pagination
      const currentPage = request.userData.page || 0
      if (currentPage < maxPages - 1) {
        const nextLink = await page.$eval(
          'a[data-testid="pagination-page-next"], a[aria-label="Next Page"]',
          el => el.getAttribute('href')
        ).catch(() => null)
        if (nextLink) {
          const nextUrl = nextLink.startsWith('http') ? nextLink : `${baseUrl}${nextLink}`
          await crawler.addRequests([{
            url: nextUrl,
            userData: { page: currentPage + 1 },
          }])
        }
      }
    },
    failedRequestHandler({ request }) {
      logger.warn({ url: request.url }, 'Indeed request failed')
    },
  })

  const encodedQuery = encodeURIComponent(query)
  const encodedLocation = encodeURIComponent(location)
  const dateParam = postedWithinDays ? `&fromage=${postedWithinDays}` : ''
  const startUrl = `${baseUrl}/jobs?q=${encodedQuery}&l=${encodedLocation}${dateParam}`

  await crawler.run([{ url: startUrl, userData: { page: 0 } }])

  logger.info({ count: jobs.length, query, location }, 'Indeed scrape complete')
  return jobs
}
