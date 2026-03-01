import { readFileSync, writeFileSync, unlinkSync, readdirSync, statSync, existsSync } from 'fs'
import { resolve, join } from 'path'

const CONFIG_PATH = resolve(import.meta.dirname, '../../../data/tool-config.json')

function getAllowedPaths(): string[] {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    return (config.files?.allowed_paths || ['./data']).map((p: string) => resolve(import.meta.dirname, '../../../', p))
  } catch {
    return [resolve(import.meta.dirname, '../../../data')]
  }
}

function getMaxFileSize(): number {
  try {
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    return config.files?.max_file_size_bytes || 10 * 1024 * 1024
  } catch {
    return 10 * 1024 * 1024
  }
}

function isPathAllowed(filePath: string): boolean {
  const resolved = resolve(filePath)
  return getAllowedPaths().some(allowed => resolved.startsWith(allowed))
}

export function readFileTool(filePath: string): string {
  if (!isPathAllowed(filePath)) throw new Error(`Access denied: ${filePath}`)
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
  const stat = statSync(filePath)
  if (stat.size > getMaxFileSize()) throw new Error(`File too large: ${stat.size} bytes`)
  return readFileSync(filePath, 'utf-8')
}

export function writeFileTool(filePath: string, content: string): void {
  if (!isPathAllowed(filePath)) throw new Error(`Access denied: ${filePath}`)
  if (content.length > getMaxFileSize()) throw new Error(`Content too large: ${content.length} bytes`)
  writeFileSync(filePath, content, 'utf-8')
}

export function deleteFileTool(filePath: string): void {
  if (!isPathAllowed(filePath)) throw new Error(`Access denied: ${filePath}`)
  if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`)
  unlinkSync(filePath)
}

export function listFilesTool(dirPath: string, recursive = false): string[] {
  if (!isPathAllowed(dirPath)) throw new Error(`Access denied: ${dirPath}`)
  if (!existsSync(dirPath)) throw new Error(`Directory not found: ${dirPath}`)

  const results: string[] = []
  const entries = readdirSync(dirPath, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name)
    if (entry.isFile()) {
      results.push(fullPath)
    } else if (entry.isDirectory() && recursive) {
      results.push(...listFilesTool(fullPath, true))
    }
  }
  return results
}

export function searchFilesTool(dirPath: string, pattern: string): string[] {
  if (!isPathAllowed(dirPath)) throw new Error(`Access denied: ${dirPath}`)
  const regex = new RegExp(pattern, 'i')
  const allFiles = listFilesTool(dirPath, true)
  return allFiles.filter(f => regex.test(f))
}
