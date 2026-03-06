import Database from 'better-sqlite3'
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { logger } from '../lib/logger.js'
import type { Campaign, CampaignStatus, RemotePreference, ExperienceLevel, Profile, Job, JobStatus, JobSource, GeneratedDoc, DocType, JobStats } from './types.js'

const DB_PATH = resolve('data/jobs.db')

let db: Database.Database | null = null

export function getJobsDb(): Database.Database {
  if (!db) {
    mkdirSync(resolve('data'), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
  }
  return db
}

export function initJobsDb(): void {
  const db = getJobsDb()

  // Drop old campaigns table (new schema, no migration needed)
  db.exec(`DROP TABLE IF EXISTS campaigns`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      country TEXT NOT NULL DEFAULT '',
      salary_min INTEGER,
      salary_max INTEGER,
      remote TEXT NOT NULL DEFAULT 'any',
      experience_level TEXT NOT NULL DEFAULT 'any',
      max_results INTEGER NOT NULL DEFAULT 5,
      posted_within_days INTEGER,
      status TEXT NOT NULL DEFAULT 'idle',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL DEFAULT '',
      summary TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '[]',
      experience TEXT NOT NULL DEFAULT '',
      education TEXT NOT NULL DEFAULT '',
      languages TEXT NOT NULL DEFAULT '[]',
      raw_text TEXT NOT NULL DEFAULT '',
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      external_id TEXT NOT NULL,
      source TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      salary TEXT,
      description TEXT NOT NULL DEFAULT '',
      url TEXT NOT NULL DEFAULT '',
      score REAL,
      score_reasons TEXT,
      company_insight TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(external_id, source),
      FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_campaign ON jobs(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_score ON jobs(score);

    CREATE TABLE IF NOT EXISTS generated_docs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_docs_job ON generated_docs(job_id);
  `)

  // Add company_insight column if missing (for existing databases)
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN company_insight TEXT`)
  } catch {
    // Column already exists
  }

  // Add new profile columns (for existing databases)
  const newProfileCols: [string, string][] = [
    ['email', 'TEXT'],
    ['phone', 'TEXT'],
    ['location', 'TEXT'],
    ['linkedin', 'TEXT'],
    ['website', 'TEXT'],
    ['experiences', "TEXT NOT NULL DEFAULT '[]'"],
    ['educations', "TEXT NOT NULL DEFAULT '[]'"],
    ['projects', "TEXT NOT NULL DEFAULT '[]'"],
    ['cv_theme', 'TEXT'],
  ]
  for (const [col, type] of newProfileCols) {
    try { db.exec(`ALTER TABLE profile ADD COLUMN ${col} ${type}`) } catch {}
  }

  logger.info('Jobs database initialized')
}

// ── Campaign CRUD ──

export function getCampaigns(): Campaign[] {
  return getJobsDb().prepare('SELECT * FROM campaigns ORDER BY updated_at DESC').all() as Campaign[]
}

export function getCampaign(id: number): Campaign | null {
  return getJobsDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as Campaign | null
}

export function createCampaign(data: {
  name: string
  role: string
  city: string
  country: string
  salary_min?: number | null
  salary_max?: number | null
  remote?: RemotePreference
  experience_level?: ExperienceLevel
  max_results?: number
  posted_within_days?: number | null
}): Campaign {
  const result = getJobsDb().prepare(
    `INSERT INTO campaigns (name, role, city, country, salary_min, salary_max, remote, experience_level, max_results, posted_within_days)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.name,
    data.role,
    data.city,
    data.country,
    data.salary_min ?? null,
    data.salary_max ?? null,
    data.remote ?? 'any',
    data.experience_level ?? 'any',
    data.max_results ?? 5,
    data.posted_within_days ?? null,
  )
  return getCampaign(result.lastInsertRowid as number)!
}

export function updateCampaignStatus(id: number, status: CampaignStatus): Campaign | null {
  getJobsDb().prepare(
    `UPDATE campaigns SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id)
  return getCampaign(id)
}

export function deleteCampaign(id: number): void {
  getJobsDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id)
}

// ── Profile CRUD ──

export function getProfile(): Profile | null {
  const row = getJobsDb().prepare('SELECT * FROM profile WHERE id = 1').get() as any
  if (!row) return null
  return {
    ...row,
    skills: JSON.parse(row.skills),
    languages: JSON.parse(row.languages),
    experiences: JSON.parse(row.experiences || '[]'),
    educations: JSON.parse(row.educations || '[]'),
    projects: JSON.parse(row.projects || '[]'),
    cv_theme: row.cv_theme ? JSON.parse(row.cv_theme) : undefined,
  }
}

export function upsertProfile(data: Partial<Omit<Profile, 'id' | 'updated_at'>>): Profile {
  const existing = getProfile()
  const merged = {
    name: data.name ?? existing?.name ?? '',
    title: data.title ?? existing?.title ?? '',
    summary: data.summary ?? existing?.summary ?? '',
    email: data.email ?? existing?.email ?? null,
    phone: data.phone ?? existing?.phone ?? null,
    location: data.location ?? existing?.location ?? null,
    linkedin: data.linkedin ?? existing?.linkedin ?? null,
    website: data.website ?? existing?.website ?? null,
    skills: JSON.stringify(data.skills ?? existing?.skills ?? []),
    experience: data.experience ?? existing?.experience ?? '',
    experiences: JSON.stringify(data.experiences ?? existing?.experiences ?? []),
    education: data.education ?? existing?.education ?? '',
    educations: JSON.stringify(data.educations ?? existing?.educations ?? []),
    projects: JSON.stringify(data.projects ?? existing?.projects ?? []),
    languages: JSON.stringify(data.languages ?? existing?.languages ?? []),
    raw_text: data.raw_text ?? existing?.raw_text ?? '',
    cv_theme: data.cv_theme ? JSON.stringify(data.cv_theme) : (existing?.cv_theme ? JSON.stringify(existing.cv_theme) : null),
  }

  getJobsDb().prepare(`
    INSERT INTO profile (id, name, title, summary, email, phone, location, linkedin, website, skills, experience, experiences, education, educations, projects, languages, raw_text, cv_theme, updated_at)
    VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, title = excluded.title, summary = excluded.summary,
      email = excluded.email, phone = excluded.phone, location = excluded.location,
      linkedin = excluded.linkedin, website = excluded.website,
      skills = excluded.skills, experience = excluded.experience, experiences = excluded.experiences,
      education = excluded.education, educations = excluded.educations, projects = excluded.projects,
      languages = excluded.languages, raw_text = excluded.raw_text, cv_theme = excluded.cv_theme,
      updated_at = datetime('now')
  `).run(
    merged.name, merged.title, merged.summary,
    merged.email, merged.phone, merged.location, merged.linkedin, merged.website,
    merged.skills, merged.experience, merged.experiences,
    merged.education, merged.educations, merged.projects,
    merged.languages, merged.raw_text, merged.cv_theme
  )

  return getProfile()!
}

// ── Job CRUD ──

export function upsertJob(job: {
  campaign_id: number
  external_id: string
  source: JobSource
  title: string
  company: string
  location: string
  salary?: string | null
  description: string
  url: string
}): number {
  const result = getJobsDb().prepare(`
    INSERT INTO jobs (campaign_id, external_id, source, title, company, location, salary, description, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(external_id, source) DO UPDATE SET
      title = excluded.title, company = excluded.company, location = excluded.location,
      salary = excluded.salary, description = excluded.description, url = excluded.url,
      updated_at = datetime('now')
  `).run(job.campaign_id, job.external_id, job.source, job.title, job.company, job.location, job.salary ?? null, job.description, job.url)
  return result.lastInsertRowid as number
}

export function getJobsByCampaign(campaignId: number, status?: JobStatus, sortByScore = true): Job[] {
  let sql = 'SELECT * FROM jobs WHERE campaign_id = ?'
  const params: any[] = [campaignId]
  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  sql += sortByScore ? ' ORDER BY score DESC NULLS LAST, created_at DESC' : ' ORDER BY created_at DESC'
  return getJobsDb().prepare(sql).all(...params) as Job[]
}

export function getJob(id: number): Job | null {
  return getJobsDb().prepare('SELECT * FROM jobs WHERE id = ?').get(id) as Job | null
}

export function updateJobStatus(id: number, status: JobStatus): Job | null {
  getJobsDb().prepare(
    `UPDATE jobs SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, id)
  return getJob(id)
}

export function updateJobScore(id: number, score: number, reasons: string): void {
  getJobsDb().prepare(
    `UPDATE jobs SET score = ?, score_reasons = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(score, reasons, id)
}

export function updateJobCuration(id: number, score: number, reasons: string, companyInsight: string): void {
  getJobsDb().prepare(
    `UPDATE jobs SET score = ?, score_reasons = ?, company_insight = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(score, reasons, companyInsight, id)
}

export function getUnscoredJobs(campaignId: number): Job[] {
  return getJobsDb().prepare(
    'SELECT * FROM jobs WHERE campaign_id = ? AND score IS NULL'
  ).all(campaignId) as Job[]
}

// ── Generated Docs ──

export function insertGeneratedDoc(jobId: number, docType: DocType, content: string): GeneratedDoc {
  const result = getJobsDb().prepare(
    'INSERT INTO generated_docs (job_id, doc_type, content) VALUES (?, ?, ?)'
  ).run(jobId, docType, content)
  return getJobsDb().prepare('SELECT * FROM generated_docs WHERE id = ?').get(result.lastInsertRowid) as GeneratedDoc
}

export function getGeneratedDocs(jobId: number): GeneratedDoc[] {
  return getJobsDb().prepare(
    'SELECT * FROM generated_docs WHERE job_id = ? ORDER BY created_at DESC'
  ).all(jobId) as GeneratedDoc[]
}

// ── Stats ──

export function getJobStats(campaignId?: number): JobStats {
  const db = getJobsDb()
  const where = campaignId ? 'WHERE campaign_id = ?' : ''
  const params = campaignId ? [campaignId] : []

  const total = (db.prepare(`SELECT COUNT(*) as c FROM jobs ${where}`).get(...params) as any).c
  const avg = (db.prepare(`SELECT AVG(score) as a FROM jobs ${where} AND score IS NOT NULL`.replace('AND', where ? 'AND' : 'WHERE')).get(...params) as any).a

  const sourceRows = db.prepare(
    `SELECT source, COUNT(*) as c FROM jobs ${where} GROUP BY source`
  ).all(...params) as any[]
  const by_source: Record<string, number> = {}
  for (const r of sourceRows) by_source[r.source] = r.c

  const statusRows = db.prepare(
    `SELECT status, COUNT(*) as c FROM jobs ${where} GROUP BY status`
  ).all(...params) as any[]
  const by_status: Record<string, number> = {}
  for (const r of statusRows) by_status[r.status] = r.c

  return {
    total_jobs: total,
    avg_score: avg ? Math.round(avg * 10) / 10 : null,
    by_source,
    by_status,
    shortlisted_count: by_status['shortlisted'] || 0,
  }
}
