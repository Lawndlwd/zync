import { PlaywrightCrawler } from 'crawlee'
import { logger } from '../../lib/logger.js'
import type { ScrapedJob } from './indeed.js'

export async function scrapeWTTJ(query: string, location: string, _country?: string, postedWithinDays?: number | null, maxPages = 3): Promise<ScrapedJob[]> {
  const jobs: ScrapedJob[] = []

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: maxPages * 30,
    maxConcurrency: 1,
    headless: true,
    requestHandlerTimeoutSecs: 60,
    async requestHandler({ page, request }) {
      // Wait for job list to load
      await page.waitForSelector('[data-testid="search-results-list-item-wrapper"], li[class*="ais-Hits"]', { timeout: 15000 }).catch(() => {})

      // Scroll to load more
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => window.scrollBy(0, 1000))
        await page.waitForTimeout(600)
      }

      const cards = await page.$$('[data-testid="search-results-list-item-wrapper"] a, ul[class*="ais-Hits"] li a[href*="/jobs/"]')
      for (const card of cards) {
        const href = await card.getAttribute('href') || ''
        if (!href.includes('/jobs/')) continue

        const titleEl = await card.$('h4, [data-testid="job-title"]')
        const title = titleEl ? await titleEl.textContent() || '' : ''

        const companyEl = await card.$('p[class*="company"], span[class*="company"], [data-testid="company-name"]')
        const company = companyEl ? await companyEl.textContent() || '' : ''

        const locEl = await card.$('p[class*="location"], span[class*="location"], [data-testid="job-location"]')
        const loc = locEl ? await locEl.textContent() || '' : ''

        const salaryEl = await card.$('p[class*="salary"], span[class*="salary"]')
        const salary = salaryEl ? await salaryEl.textContent() || null : null

        if (!title.trim()) continue

        // Extract slug/ID from URL
        const slug = href.split('/jobs/')[1]?.split('?')[0]?.split('/').pop() || href
        const fullUrl = href.startsWith('http') ? href : `https://www.welcometothejungle.com${href}`

        jobs.push({
          external_id: slug,
          source: 'wttj',
          title: title.trim(),
          company: company.trim(),
          location: loc.trim(),
          salary: salary?.trim() || null,
          description: '',
          url: fullUrl,
        })
      }

      // Pagination
      const currentPage = request.userData.page || 1
      if (currentPage < maxPages) {
        const nextBtn = await page.$('a[rel="next"], button[aria-label="Next"]')
        if (nextBtn) {
          const nextHref = await nextBtn.getAttribute('href')
          if (nextHref) {
            const nextUrl = nextHref.startsWith('http') ? nextHref : `https://www.welcometothejungle.com${nextHref}`
            await crawler.addRequests([{
              url: nextUrl,
              userData: { page: currentPage + 1 },
            }])
          }
        }
      }
    },
    failedRequestHandler({ request }) {
      logger.warn({ url: request.url }, 'WTTJ request failed')
    },
  })

  const encodedQuery = encodeURIComponent(query)
  // WTTJ uses city for its filter — extract city (first part before comma)
  const city = location.split(',')[0].trim()
  const encodedCity = encodeURIComponent(city)
  // WTTJ date filter: number of days
  const dateParam = postedWithinDays ? `&aroundLatLngViaIP=false&page=1&sortBy=mostRecent` : ''
  const startUrl = `https://www.welcometothejungle.com/en/jobs?query=${encodedQuery}&refinementList%5Boffices.city%5D%5B%5D=${encodedCity}${dateParam}`

  await crawler.run([{ url: startUrl, userData: { page: 1 } }])

  logger.info({ count: jobs.length, query, location }, 'WTTJ scrape complete')
  return jobs
}
