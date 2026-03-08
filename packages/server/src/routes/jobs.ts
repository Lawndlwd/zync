import { Router } from 'express'
import multer from 'multer'
import { PDFParse } from 'pdf-parse'
import { validate } from '../lib/validate.js'
import { errorResponse } from '../lib/errors.js'
import {
  CampaignCreateSchema, CampaignStatusSchema,
  JobStatusSchema, ProfileUpdateSchema,
} from '@zync/shared/schemas'
import {
  getCampaigns, getCampaign, createCampaign, updateCampaignStatus, deleteCampaign,
  getProfile, upsertProfile,
  getJobsByCampaign, getJob, updateJobStatus,
  insertGeneratedDoc, getGeneratedDocs,
  getJobStats,
} from '../jobs/db.js'
import { parseResume, scoreJobs, curateJobs, generateCoverLetter, generateInterviewPrep } from '../jobs/ai.js'
import { runScrapers } from '../jobs/scrapers/index.js'
import { scheduleJobScraping, stopJobScraping, getScrapeCron, getScrapeTz } from '../jobs/scheduler.js'
import { logger } from '../lib/logger.js'
import type { CampaignStatus, JobStatus } from '../jobs/types.js'

export const jobsRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Valid campaign status transitions
const VALID_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  idle: ['hunting'],
  hunting: ['curated', 'idle'],
  curated: ['applying', 'idle'],
  applying: ['closed', 'idle'],
  closed: ['idle'],
}

// ── Campaigns ──

jobsRouter.get('/campaigns', (_req, res) => {
  try {
    res.json(getCampaigns())
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.post('/campaigns', validate(CampaignCreateSchema), (req, res) => {
  try {
    const campaign = createCampaign(req.body)
    res.json(campaign)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.patch('/campaigns/:id/status', validate(CampaignStatusSchema), (req, res) => {
  try {
    const id = parseInt(req.params.id as string)
    const { status } = req.body as { status: CampaignStatus }
    const campaign = getCampaign(id)
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return }

    const allowed = VALID_TRANSITIONS[campaign.status]
    if (!allowed?.includes(status)) {
      res.status(400).json({ error: `Cannot transition from '${campaign.status}' to '${status}'` })
      return
    }

    const wasHunting = campaign.status === 'hunting'
    const updated = updateCampaignStatus(id, status)

    // Start/stop scheduler based on status
    if (status === 'hunting') {
      scheduleJobScraping(true) // run immediate scrape
    } else if (wasHunting) {
      stopJobScraping()
    }

    res.json(updated)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.delete('/campaigns/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id as string)
    const campaign = getCampaign(id)
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return }
    deleteCampaign(id)
    res.json({ success: true })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Campaign Jobs ──

jobsRouter.get('/campaigns/:id/jobs', (req, res) => {
  try {
    const id = parseInt(req.params.id as string)
    const campaign = getCampaign(id)
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return }
    const status = req.query.status as JobStatus | undefined
    const jobs = getJobsByCampaign(id, status)
    res.json(jobs)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.post('/campaigns/:id/scrape', async (req, res) => {
  try {
    const id = parseInt(req.params.id as string)
    const campaign = getCampaign(id)
    if (!campaign) { res.status(404).json({ error: 'Campaign not found' }); return }

    // Run scrapers in background
    res.json({ status: 'started', message: 'Scraping initiated' })

    const inserted = await runScrapers(campaign)
    logger.info({ campaignId: id, inserted }, 'Manual scrape complete')

    // Curate new jobs if profile exists
    const profile = getProfile()
    if (profile) {
      const { getUnscoredJobs } = await import('../jobs/db.js')
      const unscored = getUnscoredJobs(id)
      if (unscored.length > 0) {
        curateJobs(unscored, campaign, profile).catch(err =>
          logger.error({ err }, 'Curation failed after scrape')
        )
      }
    }
  } catch (err) {
    logger.error({ err }, 'Scrape trigger failed')
  }
})

// ── Profile ──

jobsRouter.get('/profile', (_req, res) => {
  try {
    const profile = getProfile()
    res.json(profile || null)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.post('/profile/upload', upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }

    const parser = new PDFParse({ data: req.file.buffer })
    const pdfData = await parser.getText()
    const rawText = pdfData.text
    await parser.destroy()

    if (!rawText.trim()) {
      res.status(400).json({ error: 'Could not extract text from PDF. Scanned/image PDFs are not supported.' })
      return
    }

    // Parse resume with LLM
    const parsed = await parseResume(rawText)
    const profile = upsertProfile({ ...parsed, raw_text: rawText })
    res.json(profile)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.put('/profile', validate(ProfileUpdateSchema), (req, res) => {
  try {
    const profile = upsertProfile(req.body)
    res.json(profile)
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Jobs ──

jobsRouter.get('/jobs/:id', (req, res) => {
  try {
    const job = getJob(parseInt(req.params.id as string))
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    res.json(job)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.patch('/jobs/:id/status', validate(JobStatusSchema), (req, res) => {
  try {
    const id = parseInt(req.params.id as string)
    const { status } = req.body as { status: JobStatus }
    const updated = updateJobStatus(id, status)
    if (!updated) { res.status(404).json({ error: 'Job not found' }); return }
    res.json(updated)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.post('/jobs/:id/cover-letter', async (req, res) => {
  try {
    const job = getJob(parseInt(req.params.id as string))
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    const profile = getProfile()
    if (!profile) { res.status(400).json({ error: 'No profile found. Upload a resume first.' }); return }

    const content = await generateCoverLetter(job, profile)
    const doc = insertGeneratedDoc(job.id, 'cover_letter', content)
    res.json(doc)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.post('/jobs/:id/interview-prep', async (req, res) => {
  try {
    const job = getJob(parseInt(req.params.id as string))
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    const profile = getProfile()
    if (!profile) { res.status(400).json({ error: 'No profile found. Upload a resume first.' }); return }

    const content = await generateInterviewPrep(job, profile)
    const doc = insertGeneratedDoc(job.id, 'interview_prep', content)
    res.json(doc)
  } catch (err) {
    errorResponse(res, err)
  }
})

jobsRouter.get('/jobs/:id/docs', (req, res) => {
  try {
    const docs = getGeneratedDocs(parseInt(req.params.id as string))
    res.json(docs)
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Schedule info ──

jobsRouter.get('/schedule', (_req, res) => {
  try {
    const cronExpr = getScrapeCron()
    const tz = getScrapeTz()
    // Parse "0 8,20 * * *" into human-readable times
    const hourField = cronExpr.split(' ')[1] || ''
    const hours = hourField.split(',').map(h => `${h.padStart(2, '0')}:00`).join(', ')
    res.json({ cron: cronExpr, timezone: tz, times: hours })
  } catch (err) {
    errorResponse(res, err)
  }
})

// ── Stats ──

jobsRouter.get('/stats', (req, res) => {
  try {
    const campaignId = req.query.campaign_id ? parseInt(req.query.campaign_id as string) : undefined
    res.json(getJobStats(campaignId))
  } catch (err) {
    errorResponse(res, err)
  }
})
