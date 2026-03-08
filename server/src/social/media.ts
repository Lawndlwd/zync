import { mkdirSync, writeFileSync, unlinkSync, existsSync } from 'fs'
import { resolve } from 'path'
import { randomUUID } from 'crypto'
// @ts-expect-error no types for heic-convert
import convert from 'heic-convert'
import { logger } from '../lib/logger.js'
import { insertMedia, deleteMediaRecord, getMediaById, type MediaRecord } from './db.js'

const MEDIA_DIR = resolve(import.meta.dirname, '../../data/social-media')

const HEIC_MIMES = new Set(['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'])
const HEIC_EXTS = new Set(['heic', 'heif'])

export function ensureMediaDir(): void {
  mkdirSync(MEDIA_DIR, { recursive: true })
}

export async function saveUploadedFile(file: {
  buffer: Buffer
  originalname: string
  mimetype: string
  size: number
}): Promise<MediaRecord> {
  ensureMediaDir()

  const origExt = (file.originalname.split('.').pop() || 'bin').toLowerCase()
  const isHeic = HEIC_MIMES.has(file.mimetype.toLowerCase()) || HEIC_EXTS.has(origExt)
  const isImage = file.mimetype.startsWith('image/') || isHeic

  let buffer = file.buffer
  let ext = origExt
  let mimeType = file.mimetype

  // Convert HEIC/HEIF to JPEG so browsers can display them
  if (isHeic) {
    try {
      const result = await convert({
        buffer: file.buffer,
        format: 'JPEG',
        quality: 0.9,
      })
      buffer = Buffer.from(result)
      ext = 'jpg'
      mimeType = 'image/jpeg'
      logger.info({ original: file.originalname }, 'Converted HEIC to JPEG')
    } catch (err) {
      logger.warn({ err, original: file.originalname }, 'HEIC conversion failed, saving as-is')
    }
  }

  const filename = `${randomUUID()}.${ext}`
  const storagePath = resolve(MEDIA_DIR, filename)

  writeFileSync(storagePath, buffer)

  const mediaType = !isImage ? 'video' : 'image'

  const id = insertMedia({
    filename,
    original_name: file.originalname,
    mime_type: mimeType,
    size_bytes: buffer.length,
    storage_path: storagePath,
    media_type: mediaType,
  })

  logger.info({ filename, mediaType, size: buffer.length, converted: isHeic }, 'Media file saved')

  return {
    id: id as number,
    filename,
    original_name: file.originalname,
    mime_type: mimeType,
    size_bytes: buffer.length,
    storage_path: storagePath,
    thumbnail_path: null,
    media_type: mediaType,
    analysis: null,
    created_at: new Date().toISOString(),
  }
}

export function getMediaUrl(filename: string): string {
  return `/api/social/media/file/${filename}`
}

export function deleteMediaFile(id: number): boolean {
  const record = getMediaById(id)
  if (!record) return false

  if (existsSync(record.storage_path)) {
    unlinkSync(record.storage_path)
  }
  if (record.thumbnail_path && existsSync(record.thumbnail_path)) {
    unlinkSync(record.thumbnail_path)
  }

  deleteMediaRecord(id)
  logger.info({ id, filename: record.filename }, 'Media file deleted')
  return true
}

export function getMediaDir(): string {
  ensureMediaDir()
  return MEDIA_DIR
}
