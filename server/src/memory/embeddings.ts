// server/src/memory/embeddings.ts
import { logger } from '../lib/logger.js'

let embeddingModel: any = null

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2'

async function getEmbeddingPipeline(): Promise<any> {
  if (embeddingModel) return embeddingModel

  const { pipeline } = await import('@huggingface/transformers')
  embeddingModel = await pipeline('feature-extraction', MODEL_NAME, {
    dtype: 'q8' as any,
  })
  logger.info({ model: MODEL_NAME }, 'Embedding model loaded')
  return embeddingModel
}

export async function generateEmbedding(text: string): Promise<Float32Array> {
  const pipe = await getEmbeddingPipeline()
  const output = await pipe(text, { pooling: 'mean', normalize: true })
  return new Float32Array(output.data)
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export function embeddingToBuffer(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)
}

export function bufferToEmbedding(buf: Buffer): Float32Array {
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  return new Float32Array(ab)
}

export function getModelName(): string {
  return MODEL_NAME
}
