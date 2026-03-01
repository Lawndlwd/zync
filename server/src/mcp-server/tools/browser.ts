import { z } from 'zod'
import { navigateAndExtract, takeScreenshot } from '../../agent/tools/browser.js'

export const browseSchema = z.object({
  url: z.string().describe('URL to navigate to and extract content from'),
})

export const screenshotSchema = z.object({
  url: z.string().describe('URL to take a screenshot of'),
})

export async function browseTool(args: z.infer<typeof browseSchema>): Promise<string> {
  const result = await navigateAndExtract(args.url)
  return `Title: ${result.title}\nURL: ${result.url}\n\nContent:\n${result.text}`
}

export async function screenshotTool(args: z.infer<typeof screenshotSchema>): Promise<string> {
  const buf = await takeScreenshot(args.url)
  return `Screenshot taken (${buf.length} bytes)`
}
