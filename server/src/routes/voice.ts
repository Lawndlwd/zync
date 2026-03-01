import { Router } from 'express'
import multer from 'multer'
import { transcribeAudio } from '../voice/transcribe.js'

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } })

export const voiceRouter = Router()

voiceRouter.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No audio file provided' })
      return
    }
    const text = await transcribeAudio(req.file.buffer, req.body?.format || 'ogg')
    res.json({ text })
  } catch (err) {
    console.error('Transcription error:', err)
    res.status(500).json({ error: 'Transcription failed' })
  }
})
