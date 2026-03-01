import { z } from 'zod'
import { readFileTool, writeFileTool, deleteFileTool, listFilesTool, searchFilesTool } from '../../agent/tools/files.js'

export const readFileSchema = z.object({
  path: z.string().describe('Path to the file to read'),
})

export const writeFileSchema = z.object({
  path: z.string().describe('Path to the file to write'),
  content: z.string().describe('Content to write'),
})

export const deleteFileSchema = z.object({
  path: z.string().describe('Path to the file to delete'),
})

export const listFilesSchema = z.object({
  path: z.string().describe('Directory path to list'),
  recursive: z.boolean().optional().describe('List files recursively'),
})

export const searchFilesSchema = z.object({
  path: z.string().describe('Directory to search in'),
  pattern: z.string().describe('Regex pattern to match file names'),
})

export async function readFileMcp(args: z.infer<typeof readFileSchema>): Promise<string> {
  return readFileTool(args.path)
}

export async function writeFileMcp(args: z.infer<typeof writeFileSchema>): Promise<string> {
  writeFileTool(args.path, args.content)
  return `Written ${args.content.length} bytes to ${args.path}`
}

export async function deleteFileMcp(args: z.infer<typeof deleteFileSchema>): Promise<string> {
  deleteFileTool(args.path)
  return `Deleted ${args.path}`
}

export async function listFilesMcp(args: z.infer<typeof listFilesSchema>): Promise<string> {
  const files = listFilesTool(args.path, args.recursive)
  return files.join('\n') || '(empty directory)'
}

export async function searchFilesMcp(args: z.infer<typeof searchFilesSchema>): Promise<string> {
  const files = searchFilesTool(args.path, args.pattern)
  return files.join('\n') || '(no matches)'
}
