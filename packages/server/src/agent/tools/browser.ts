import { type Browser, chromium } from 'playwright'

let browser: Browser | null = null

async function getBrowser(): Promise<Browser> {
  if (!browser?.isConnected()) {
    browser = await chromium.launch({ headless: true })
  }
  return browser
}

export async function navigateAndExtract(url: string): Promise<{ title: string; text: string; url: string }> {
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url)) {
    throw new Error('Navigation to localhost is not allowed')
  }

  const b = await getBrowser()
  const page = await b.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const title = await page.title()
    const text = await page.evaluate(() => {
      const el = document.body
      return el ? el.innerText.slice(0, 50_000) : ''
    })
    return { title, text, url: page.url() }
  } finally {
    await page.close()
  }
}

export async function takeScreenshot(url: string): Promise<Buffer> {
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(url)) {
    throw new Error('Navigation to localhost is not allowed')
  }

  const b = await getBrowser()
  const page = await b.newPage()
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    return (await page.screenshot({ type: 'png', fullPage: false })) as Buffer
  } finally {
    await page.close()
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close()
    browser = null
  }
}
