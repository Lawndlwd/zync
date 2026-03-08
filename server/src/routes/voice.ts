import { Router } from 'express'
import multer from 'multer'
import { transcribeAudio } from '../voice/transcribe.js'
import { logger } from '../lib/logger.js'

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } })

export const voiceRouter = Router()

voiceRouter.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' })
      return
    }
    const format = req.body?.format || 'ogg'
    logger.info({ size: req.file.size, format, mimetype: req.file.mimetype }, '[voice] Transcribe request')
    const text = await transcribeAudio(req.file.buffer, format)
    logger.info({ text: text.slice(0, 100) }, '[voice] Transcribe result')
    res.json({ text })
  } catch (err) {
    logger.error({ err }, '[voice] Transcription error')
    res.status(500).json({ error: 'Transcription failed' })
  }
})
