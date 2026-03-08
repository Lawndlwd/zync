import * as cron from 'node-cron'
import { getCampaigns, getProfile, getUnscoredJobs } from './db.js'
import { runScrapers } from './scrapers/index.js'
import { curateJobs } from './ai.js'
import { getConfig } from '../config/index.js'
import { logger } from '../lib/logger.js'

let scheduledTask: cron.ScheduledTask | null = null

export function getScrapeCron(): string {
  return getConfig('JOB_SCRAPE_CRON') || '0 8,20 * * *'
}

export function getScrapeTz(): string {
  return getConfig('SCHEDULE_TIMEZONE', 'Europe/Paris') || 'Europe/Paris'
}

export function scheduleJobScraping(runImmediately = false): void {
  stopJobScraping()

  const cronExpr = getScrapeCron()
  const tz = getScrapeTz()

  scheduledTask = cron.schedule(cronExpr, () => {
    runScheduledScrape().catch(err => logger.error({ err }, 'Scheduled job scrape failed'))
  }, { timezone: tz })

  logger.info({ cronExpr, tz }, 'Job scraping scheduled')

  if (runImmediately) {
    runScheduledScrape().catch(err => logger.error({ err }, 'Immediate scrape after start failed'))
  }
}

export function stopJobScraping(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('Job scraping stopped')
  }
}

async function runScheduledScrape(): Promise<void> {
  const campaigns = getCampaigns()
  const active = campaigns.find(c => c.status === 'hunting')
  if (!active) {
    logger.info('No active hunting campaign, skipping scrape')
    return
  }

  logger.info({ campaignId: active.id, name: active.name }, 'Running scheduled scrape')

  const inserted = await runScrapers(active)
  logger.info({ campaignId: active.id, inserted }, 'Scheduled scrape complete')

  // Curate new jobs if profile exists
  const profile = getProfile()
  if (profile) {
    const unscored = getUnscoredJobs(active.id)
    if (unscored.length > 0) {
      logger.info({ count: unscored.length }, 'Curating new jobs')
      await curateJobs(unscored, active, profile)
    }
  }
}
