/**
 * Standalone web scraper — no ZAI SDK dependency.
 * Works on Vercel serverless functions using direct fetch().
 */

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'

const FETCH_TIMEOUT = 15000 // 15 seconds

export interface ScrapePageResult {
  html: string
  title: string
  finalUrl: string
}

/**
 * Fetch a web page and return its HTML content.
 * Uses direct fetch() — no ZAI page_reader needed.
 */
export async function scrapePage(url: string): Promise<ScrapePageResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-AR,es;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const html = await response.text()
    const finalUrl = response.url || url

    // Extract title from HTML
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || ''

    return { html, title, finalUrl }
  } finally {
    clearTimeout(timeout)
  }
}
