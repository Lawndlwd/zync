import { PlaywrightCrawler } from 'crawlee'
import { logger } from '../../lib/logger.js'
import type { ScrapedJob } from './indeed.js'

// LinkedIn f_TPR param: r86400 = 24h, r604800 = week, r2592000 = month
function linkedInDateFilter(days: number | null | undefined): string {
  if (!days) return ''
  if (days <= 1) return '&f_TPR=r86400'
  if (days <= 7) return '&f_TPR=r604800'
  if (days <= 30) return '&f_TPR=r2592000'
  return ''
}

export async function scrapeLinkedIn(query: string, location: string, _country?: string, postedWithinDays?: number | null, maxPages = 3): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = []

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxPages * 30,
    maxConcurrency: 1,
    headless: true,
    requestHandlerTimeoutSecs: 60,
    launchContext: {
      launchOptions: {
        args: ['--disable-blink-features=AutomationControlled'],
      },
    },
    async requestHandler({ page, request }) {
      // Wait for job cards to load
      await page.waitForSelector('div.base-search-card', { timeout: 15000 }).catch(() => {})

      // Scroll to load lazy content
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000))
        await page.waitForTimeout(800)
      }

      const cards = await page.$$('div.base-search-card')
      for (const card of cards) {
        const title = await card.$eval('h3.base-search-card__title', el => el.textContent?.trim() || '').catch(() => '')
        const company = await card.$eval('h4.base-search-card__subtitle a', el => el.textContent?.trim() || '').catch(() => '')
        const loc = await card.$eval('span.job-search-card__location', el => el.textContent?.trim() || '').catch(() => '')
        const link = await card.$eval('a.base-card__full-link', el => el.getAttribute('href') || '').catch(() => '')

        if (!title || !link) continue

        // Extract job ID from URL
        const idMatch = link.match(/(\d+)\??/)
        const externalId = idMatch?.[1] || link

        jobs.push({
          external_id: externalId,
          source: 'linkedin',
          title,
          company,
          location: loc,
          salary: null,
          description: '',
          url: link.split('?')[0],
        })
      }

      // Pagination
      const currentPage = request.userData.page || 0
      if (currentPage < maxPages - 1) {
        const nextStart = (currentPage + 1) * 25
        const nextUrl = new URL(request.url)
        nextUrl.searchParams.set('start', String(nextStart))
        await crawler.addRequests([{
          url: nextUrl.toString(),
          userData: { page: currentPage + 1 },
        }])
      }
    },
    failedRequestHandler({ request }) {
      logger.warn({ url: request.url }, 'LinkedIn request failed')
    },
  })

  const encodedQuery = encodeURIComponent(query)
  const encodedLocation = encodeURIComponent(location)
  const dateFilter = linkedInDateFilter(postedWithinDays)
  const startUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodedQuery}&location=${encodedLocation}${dateFilter}`

  await crawler.run([{ url: startUrl, userData: { page: 0 } }])

  logger.info({ count: jobs.length, query, location }, 'LinkedIn scrape complete')
  return jobs
}
