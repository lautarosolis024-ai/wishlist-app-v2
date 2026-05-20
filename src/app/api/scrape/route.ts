import { getZAI } from '@/lib/zai'
import { scrapePage } from '@/lib/scraper'
import { NextRequest, NextResponse } from 'next/server'

interface ScrapeResult {
  title: string
  price: number | null
  originalPrice: number | null
  currency: string
  brand: string | null
  store: string | null
  description: string | null
  images: string[]
  sizeGuide: string | null
  category: string
  color: string | null
}

function extractSlugFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const pathParts = parsed.pathname.split('/').filter(Boolean)
    const lastPart = pathParts[pathParts.length - 1] || ''
    return lastPart.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').toLowerCase()
  } catch {
    return ''
  }
}

function extractStoreFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace('www.', '')
    const storeMap: Record<string, string> = {
      'mercadolibre.com.ar': 'MercadoLibre',
      'tiendanube.com': 'TiendaNube',
      'mitiendanube.com': 'TiendaNube',
      'midway.com.ar': 'Midway',
      'zara.com': 'Zara',
      'nike.com': 'Nike',
      'adidas.com.ar': 'Adidas',
      'puma.com': 'Puma',
      'c-and.com': 'C&A',
      'falabella.com.ar': 'Falabella',
      'hm.com': 'H&M',
      'amazon.com': 'Amazon',
      'amazon.com.ar': 'Amazon',
      'shein.com': 'Shein',
      'aliexpress.com': 'AliExpress',
    }
    for (const [domain, name] of Object.entries(storeMap)) {
      if (hostname.includes(domain)) return name
    }
    const parts = hostname.split('.')
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1)
  } catch {
    return 'Desconocido'
  }
}

function extractDescriptionFromHtml(html: string): string | null {
  const patterns = [
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i,
    /<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return match[1].trim()
  }
  return null
}

function extractProductImages(html: string, url: string): string[] {
  const slug = extractSlugFromUrl(url)
  const isTiendaNube = url.includes('tiendanube') || url.includes('mitiendanube')
  const allImages = new Set<string>()

  // 1. Find product container
  let productHtml = html
  const containerPatterns = [
    /<div[^>]*(?:id=["'][^"']*product[^"']*["']|class=["'][^"']*product[^"']*["'])[^>]*>[\s\S]*?<\/div>\s*(?=<div[^>]*(?:id=|class=)|$)/i,
    /<section[^>]*(?:class=["'][^"']*product[^"']*["'])[^>]*>[\s\S]*?<\/section>/i,
    /<main[^>]*>[\s\S]*?<\/main>/i,
  ]
  for (const pattern of containerPatterns) {
    const match = html.match(pattern)
    if (match) {
      productHtml = match[0]
      break
    }
  }

  // 2. Extract og:image and twitter:image from head
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i)
  const headHtml = headMatch?.[0] || ''
  const ogPattern = /<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/gi
  const twitterPattern = /<meta\s+(?:property|name)=["']twitter:image["']\s+content=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = ogPattern.exec(headHtml)) !== null) {
    if (m[1]) allImages.add(m[1])
  }
  while ((m = twitterPattern.exec(headHtml)) !== null) {
    if (m[1]) allImages.add(m[1])
  }

  // 3. Extract from JSON-LD
  const jsonLdPattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  while ((m = jsonLdPattern.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1])
      if (json.image) {
        if (Array.isArray(json.image)) {
          json.image.forEach((img: unknown) => {
            if (typeof img === 'string') allImages.add(img)
            else if (typeof img === 'object' && img !== null && 'url' in (img as Record<string, unknown>)) {
              allImages.add((img as { url: string }).url)
            }
          })
        } else if (typeof json.image === 'string') {
          allImages.add(json.image)
        } else if (typeof json.image === 'object' && json.image !== null && 'url' in (json.image as Record<string, unknown>)) {
          allImages.add((json.image as { url: string }).url)
        }
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  // 4. Extract from variant JSON in product container only
  const variantPattern = /"image_url"\s*:\s*"([^"]+)"/gi
  while ((m = variantPattern.exec(productHtml)) !== null) {
    if (m[1]) allImages.add(m[1])
  }

  // 5. Extract from gallery images in product container
  const imgPatterns = [
    /(?:src|data-src)=["']([^"']*\.(?:jpg|jpeg|png|webp|avif)[^"']*)["']/gi,
  ]
  for (const pattern of imgPatterns) {
    while ((m = pattern.exec(productHtml)) !== null) {
      if (m[1]) allImages.add(m[1])
    }
  }

  // 6. Collect and filter images
  let images = Array.from(allImages).filter(img => {
    if (!img || img.length < 10) return false
    if (img.startsWith('data:')) return false
    const lower = img.toLowerCase()
    const excludePatterns = [
      'logo', 'icon', 'banner', 'sprite', 'pixel', '1x1', 'spacer',
      'avatar', 'social', 'share', 'payment', 'flag', 'whatsapp',
      'instagram', 'facebook', 'tiktok', 'favicon', 'loader',
      'placeholder', 'related', 'crossell', 'recommend', 'upsell',
      'newsletter', 'badge', 'secure', 'visa', 'mastercard',
      'amex', 'paypal', 'mercadopago', 'arrow', 'chevron',
      'close', 'menu', 'hamburger', 'cart-empty', 'empty-cart',
      'no-image', 'thumb-default', 'sprite', 'emoji', 'sticker',
    ]
    return !excludePatterns.some(p => lower.includes(p))
  })

  // 7. TiendaNube thumbnail upgrade
  if (isTiendaNube) {
    images = images.map(img =>
      img.replace(/-\d+-\d+(\.(?:jpg|jpeg|png|webp))/i, '-1024-1024$1')
    )
  }

  // 8. Resolve relative URLs
  try {
    const baseUrl = new URL(url).origin
    images = images.map(img => {
      if (img.startsWith('//')) return `https:${img}`
      if (img.startsWith('/')) return `${baseUrl}${img}`
      return img
    })
  } catch { /* skip URL resolution */ }

  // 9. Filter by product path or slug
  const productPathImages = images.filter(img => {
    const lower = img.toLowerCase()
    return lower.includes('/products/') || lower.includes('/product/') || lower.includes('/p/')
  })

  if (productPathImages.length >= 2) {
    // Try to filter by variant basename if possible
    const variantBasenames = new Set<string>()
    const variantUrlPattern = /"image_url"\s*:\s*"([^"]+)"/gi
    let vm: RegExpExecArray | null
    while ((vm = variantUrlPattern.exec(productHtml)) !== null) {
      if (vm[1]) {
        const parts = vm[1].split('/')
        const filename = parts[parts.length - 1]?.replace(/\.[^.]+$/, '') || ''
        if (filename) variantBasenames.add(filename.toLowerCase())
      }
    }

    if (variantBasenames.size > 0) {
      const filtered = productPathImages.filter(img => {
        const parts = img.split('/')
        const filename = parts[parts.length - 1]?.replace(/\.[^.]+$/, '') || ''
        return variantBasenames.has(filename.toLowerCase())
      })
      if (filtered.length >= 1) return filtered.slice(0, 10)
    }

    // Filter by slug
    if (slug) {
      const slugFiltered = productPathImages.filter(img =>
        img.toLowerCase().includes(slug.replace(/ /g, '-')) ||
        img.toLowerCase().includes(slug.replace(/ /g, '_'))
      )
      if (slugFiltered.length >= 1) return slugFiltered.slice(0, 10)
    }

    return productPathImages.slice(0, 10)
  }

  // 10. Fallback: return all filtered images
  return images.slice(0, 10)
}

function extractSizeGuideFromHtml(html: string): string | null {
  const patterns = [
    /(<div[^>]*(?:class=["'][^"']*size[^"']*chart|id=["'][^"']*size[^"']*guide)[^>]*>[\s\S]*?<\/div>)/i,
    /(<table[^>]*(?:class=["'][^"']*size|id=["'][^"']*size)[^>]*>[\s\S]*?<\/table>)/i,
    /(<div[^>]*(?:class=["'][^"']*talles|id=["'][^"']*talles)[^>]*>[\s\S]*?<\/div>)/i,
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1] && match[1].length > 50) return match[1]
  }
  return null
}

function extractRelevantHtml(html: string): string {
  const headMatch = html.match(/<head[\s\S]*?<\/head>/i)
  const head = headMatch?.[0]?.substring(0, 5000) || ''

  let productSection = ''
  const productPatterns = [
    /(<div[^>]*(?:id=["'][^"']*product[^"']*["']|class=["'][^"']*(?:product-container|product-detail|product-info|js-product)[^"']*["'])[^>]*>[\s\S]{0,30000}<\/div>)/i,
    /(<main[^>]*>[\s\S]{0,40000}<\/main>)/i,
  ]
  for (const pattern of productPatterns) {
    const match = html.match(pattern)
    if (match) {
      productSection = match[1].substring(0, 20000)
      break
    }
  }

  const sizeGuide = extractSizeGuideFromHtml(html)?.substring(0, 5000) || ''
  const jsonLdMatches = html.match(/<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  const jsonLd = jsonLdMatches?.map(m => m.substring(0, 3000)).join('\n') || ''

  return [head, productSection, sizeGuide, jsonLd].filter(Boolean).join('\n---SECTION---\n').substring(0, 20000)
}

/**
 * Regex-based fallback extraction when LLM is unavailable.
 * Extracts basic product data from HTML meta tags and JSON-LD.
 */
function extractProductDataRegex(
  html: string,
  url: string,
  pageTitle: string
): Omit<ScrapeResult, 'images'> {
  const store = extractStoreFromUrl(url)
  const metaDescription = extractDescriptionFromHtml(html)

  // Try JSON-LD first
  let title = pageTitle
  let price: number | null = null
  let originalPrice: number | null = null
  let currency = 'ARS'
  let brand: string | null = null
  let description: string | null = metaDescription
  let category = 'otros'
  let color: string | null = null
  let sizeGuideText: string | null = null

  const jsonLdPattern = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = jsonLdPattern.exec(html)) !== null) {
    try {
      const json = JSON.parse(m[1])
      if (json['@type'] === 'Product' || json.name) {
        if (json.name) title = json.name
        if (json.brand?.name) brand = json.brand.name
        if (json.description) description = json.description.substring(0, 500)
        if (json.color) color = json.color

        // Extract offers
        const offers = json.offers || json.offers
        if (offers) {
          const offerList = Array.isArray(offers) ? offers : [offers]
          for (const offer of offerList) {
            if (offer.price && !price) {
              price = parseFloat(offer.price)
              currency = offer.priceCurrency || 'ARS'
            }
            if (offer.highPrice && !originalPrice) {
              originalPrice = parseFloat(offer.highPrice)
            }
          }
        }

        // Extract images from JSON-LD
        if (json.image) {
          // Already handled in extractProductImages
        }
      }
    } catch { /* skip invalid JSON-LD */ }
  }

  // Try meta price tags
  if (!price) {
    const pricePatterns = [
      /<meta\s+(?:property|itemprop)=["'](?:product:price:amount|price)["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+(?:property|itemprop)=["'](?:product:price:amount|price)["']/i,
    ]
    for (const pattern of pricePatterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        price = parseFloat(match[1].replace(/[^\d.,]/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.'))
        break
      }
    }
  }

  // Try meta currency
  const currencyPatterns = [
    /<meta\s+(?:property|itemprop)=["'](?:product:price:currency|priceCurrency)["']\s+content=["']([^"']+)["']/i,
    /<meta\s+content=["']([^"']+)["']\s+(?:property|itemprop)=["'](?:product:price:currency|priceCurrency)["']/i,
  ]
  for (const pattern of currencyPatterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      currency = match[1]
      break
    }
  }

  // Try brand from meta
  if (!brand) {
    const brandPatterns = [
      /<meta\s+(?:property|itemprop)=["'](?:product:brand|brand)["']\s+content=["']([^"']+)["']/i,
      /<meta\s+content=["']([^"']+)["']\s+(?:property|itemprop)=["'](?:product:brand|brand)["']/i,
    ]
    for (const pattern of brandPatterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        brand = match[1]
        break
      }
    }
  }

  // Category detection from URL and title
  const lowerTitle = title.toLowerCase()
  const lowerUrl = url.toLowerCase()
  if (/zapatilla|zapato|bota|ojota|sneaker|shoe|boot|calzado/.test(lowerTitle + lowerUrl)) {
    category = 'calzado'
  } else if (/remera|camisa|pantalón|pantalon|jeans|shorts|campera|buzo|sweater|vestido|pollera|hoodie|jacket|shirt|dress|coat/.test(lowerTitle + lowerUrl)) {
    category = 'ropa'
  } else if (/celular|notebook|laptop|tablet|auriculares|smartwatch|cámara|camera|tech|tecnología/.test(lowerTitle + lowerUrl)) {
    category = 'tecnologia'
  } else if (/accesorio|accessory|reloj|watch|bolsito|bag|cartera|lentes|glasses|gorra|hat/.test(lowerTitle + lowerUrl)) {
    category = 'accesorios'
  } else if (/deporte|sport|gym|gimnasio|fitness|running|fútbol|soccer/.test(lowerTitle + lowerUrl)) {
    category = 'deportes'
  } else if (/mueble|furniture|silla|chair|mesa|table|sofá|sofa|cama|bed|hogar|home|decoración/.test(lowerTitle + lowerUrl)) {
    category = 'hogar'
  }

  // Size guide extraction
  const sizeGuideHtml = extractSizeGuideFromHtml(html)
  if (sizeGuideHtml) {
    sizeGuideText = sizeGuideHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000)
  }

  // Extract price from page content if still not found
  if (!price) {
    // Look for common price patterns in the HTML
    const priceContentPatterns = [
      /(?:precio|price|ARS|\$)\s*[:\s]*\$?\s*([\d.,]+)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>[\s\S]*?([\d.,]+)/i,
    ]
    for (const pattern of priceContentPatterns) {
      const match = html.match(pattern)
      if (match?.[1]) {
        const cleaned = match[1].replace(/\.(?=\d{3})/g, '').replace(',', '.')
        const parsed = parseFloat(cleaned)
        if (parsed > 0 && parsed < 10000000) {
          price = parsed
          break
        }
      }
    }
  }

  return {
    title: title || pageTitle,
    price,
    originalPrice,
    currency,
    brand,
    store,
    description,
    sizeGuide: sizeGuideText,
    category,
    color,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Step 1: Fetch the page using direct fetch (works on Vercel!)
    let html: string
    let pageTitle: string
    try {
      const pageResult = await scrapePage(url)
      html = pageResult.html
      pageTitle = pageResult.title
    } catch (fetchError) {
      console.error('[Scrape] Direct fetch failed:', fetchError)

      // Fallback: try ZAI page_reader if direct fetch fails
      try {
        const zai = await getZAI()
        if (zai) {
          const pageResult = await zai.functions.invoke('page_reader', { url })
          html = pageResult.data?.html || ''
          pageTitle = pageResult.data?.title || ''
        } else {
          return NextResponse.json(
            { error: `No se pudo acceder a la página. Verificá que la URL sea correcta y que el sitio esté accesible. (${fetchError instanceof Error ? fetchError.message : 'Error desconocido'})` },
            { status: 422 }
          )
        }
      } catch (zaiError) {
        console.error('[Scrape] ZAI page_reader also failed:', zaiError)
        return NextResponse.json(
          { error: `No se pudo acceder a la página. Verificá que la URL sea correcta. (${fetchError instanceof Error ? fetchError.message : 'Error desconocido'})` },
          { status: 422 }
        )
      }
    }

    if (!html || html.length < 100) {
      return NextResponse.json({ error: 'No se pudo obtener el contenido de la página.' }, { status: 422 })
    }

    // Step 2: Extract images using regex-based strategy
    const images = extractProductImages(html, url)

    // Step 3: Try LLM extraction first, fall back to regex
    let result: ScrapeResult

    try {
      const zai = await getZAI()
      if (zai) {
        // LLM-powered extraction
        const store = extractStoreFromUrl(url)
        const metaDescription = extractDescriptionFromHtml(html)
        const sizeGuideHtml = extractSizeGuideFromHtml(html)
        const relevantHtml = extractRelevantHtml(html)

        const prompt = `You are a product data extraction expert. Extract product information from this HTML of a product page.

URL: ${url}
Page title: ${pageTitle}
Store: ${store}
Meta description: ${metaDescription || 'N/A'}

HTML content:
${relevantHtml}

Extract the following and return ONLY valid JSON (no markdown, no code fences):
{
  "title": "product title",
  "price": 12345.67 or null,
  "originalPrice": 15000.00 or null (if there's a sale/savings price),
  "currency": "ARS" or "USD" etc,
  "brand": "brand name or null",
  "description": "product description, cleaned and concise",
  "category": "one of: ropa, calzado, tecnologia, hogar, accesorios, deportes, otros",
  "color": "main color or null",
  "sizeGuideText": "the complete size guide text if found, including all measurements and sizes. Format as clean text with newlines. null if not found."
}

Rules:
- price must be a number (no currency symbol, no dots as thousands separator)
- If price uses Argentine format like "$25.990" it means 25990. Convert dots-as-thousands correctly.
- category must be one of the exact values listed above
- For ropa: remera, camisa, pantalón, jeans, shorts, campera, buzo, sweater, vestido, pollera
- For calzado: zapatillas, zapatos, botas, ojotas
- For tecnologia: celular, notebook, tablet, auriculares, smartwatch, cámara
- Return ONLY the JSON, nothing else.`

        const completion = await zai.chat.completions.create({
          messages: [
            { role: 'system', content: 'You are a precise data extraction assistant. Return only valid JSON, no markdown or explanation.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.1,
        })

        const llmResponse = completion.choices?.[0]?.message?.content || '{}'
        let extracted: Record<string, unknown>
        try {
          const jsonStr = llmResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
          extracted = JSON.parse(jsonStr)
        } catch {
          extracted = { title: pageTitle }
        }

        result = {
          title: (extracted.title as string) || pageTitle,
          price: (extracted.price as number) ?? null,
          originalPrice: (extracted.originalPrice as number) ?? null,
          currency: (extracted.currency as string) || 'ARS',
          brand: (extracted.brand as string) || null,
          store,
          description: (extracted.description as string) || metaDescription,
          images,
          sizeGuide: (extracted.sizeGuideText as string) || (sizeGuideHtml ? sizeGuideHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 5000) : null),
          category: (extracted.category as string) || 'otros',
          color: (extracted.color as string) || null,
        }
      } else {
        // No ZAI available — use regex fallback
        const regexResult = extractProductDataRegex(html, url, pageTitle)
        result = { ...regexResult, images }
      }
    } catch (llmError) {
      // LLM failed — fall back to regex extraction
      console.warn('[Scrape] LLM extraction failed, using regex fallback:', llmError)
      const regexResult = extractProductDataRegex(html, url, pageTitle)
      result = { ...regexResult, images }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('POST /api/scrape error:', error)
    const msg = error instanceof Error ? error.message : 'Failed to scrape URL'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
