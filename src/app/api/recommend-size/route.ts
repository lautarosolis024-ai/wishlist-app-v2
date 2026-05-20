import { getZAI } from '@/lib/zai'
import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { itemId } = await req.json()

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    const [item, profile] = await Promise.all([
      db.wishlistItem.findUnique({ where: { id: itemId } }),
      db.userProfile.findUnique({ where: { id: 'default' } }),
    ])

    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found. Please save your measurements first.' }, { status: 400 })
    }

    const hasMeasurements = [
      profile.chest, profile.waist, profile.hips,
      profile.shoeSize, profile.height, profile.weight,
    ].some(v => v !== null)

    if (!hasMeasurements) {
      return NextResponse.json({
        error: 'No measurements saved. Please add your measurements in the profile section.',
      }, { status: 400 })
    }

    const sizeGuide = item.sizeGuide
    if (!sizeGuide || sizeGuide.trim().length < 20) {
      return NextResponse.json({
        recommendedSize: null,
        confidence: 'baja',
        explanation: 'No se encontró guía de talles para este producto. No es posible recomendar un talle sin la tabla de medidas oficial del producto.',
        alternative: null,
      })
    }

    // Try LLM recommendation
    const zai = await getZAI()
    if (!zai) {
      // No LLM available — provide basic regex-based recommendation
      return regexSizeRecommendation(item.category, sizeGuide, profile)
    }

    try {
      const measurementsText = [
        profile.chest ? `Pecho: ${profile.chest} cm` : '',
        profile.waist ? `Cintura: ${profile.waist} cm` : '',
        profile.hips ? `Cadera: ${profile.hips} cm` : '',
        profile.shoulderWidth ? `Hombros: ${profile.shoulderWidth} cm` : '',
        profile.armLength ? `Brazo: ${profile.armLength} cm` : '',
        profile.inseam ? `Tiro: ${profile.inseam} cm` : '',
        profile.height ? `Altura: ${profile.height} cm` : '',
        profile.weight ? `Peso: ${profile.weight} kg` : '',
        profile.shoeSize ? `Pie: ${profile.shoeSize}` : '',
      ].filter(Boolean).join('\n')

      const prompt = `Eres un asesor de talles experto. Analiza las medidas del usuario y la guía de talles del producto para recomendar el talle ideal.

CATEGORÍA DEL PRODUCTO: ${item.category}
TÍTULO: ${item.title}

MEDIDAS DEL USUARIO:
${measurementsText}

GUÍA DE TALLES DEL PRODUCTO:
${sizeGuide}

INSTRUCCIONES:
1. Analiza la guía de talles del producto cuidadosamente
2. Compara con las medidas del usuario
3. Para ropa: prioriza pecho/cintura/cadera según tipo de prenda
4. Para calzado: usa la medida del pie
5. Si las medidas del usuario caen entre dos talles, recomienda el talle más grande

Responde SOLO con JSON válido (sin markdown ni code fences):
{
  "recommendedSize": "el talle recomendado (ej: M, 42, L)",
  "confidence": "alta" | "media" | "baja",
  "explanation": "explicación detallada de por qué se recomienda este talle, mencionando las medidas específicas que se compararon",
  "alternative": "talle alternativo si las medidas están entre dos talles, o null"
}`

      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: 'Eres un asesor de talles experto. Respondes solo con JSON válido.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
      })

      const llmResponse = completion.choices?.[0]?.message?.content || '{}'
      let recommendation: Record<string, unknown>
      try {
        const jsonStr = llmResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
        recommendation = JSON.parse(jsonStr)
      } catch {
        recommendation = {
          recommendedSize: null,
          confidence: 'baja',
          explanation: 'No se pudo procesar la recomendación de talle.',
          alternative: null,
        }
      }

      // Save recommendation to item
      await db.wishlistItem.update({
        where: { id: itemId },
        data: {
          recommendedSize: (recommendation.recommendedSize as string) || null,
          sizeReason: JSON.stringify(recommendation),
        },
      })

      return NextResponse.json(recommendation)
    } catch (llmError) {
      console.warn('[Recommend-Size] LLM failed, using regex fallback:', llmError)
      return regexSizeRecommendation(item.category, sizeGuide, profile)
    }
  } catch (error) {
    console.error('POST /api/recommend-size error:', error)
    return NextResponse.json({ error: 'Failed to recommend size' }, { status: 500 })
  }
}

/**
 * Basic regex-based size recommendation when LLM is unavailable.
 * Parses the size guide text and compares with user measurements.
 */
function regexSizeRecommendation(
  category: string,
  sizeGuide: string,
  profile: Record<string, unknown>
): NextResponse {
  // Clean the size guide for parsing
  const cleanGuide = sizeGuide.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  // Try to find size entries like "S: pecho 86-91" or "M (38-40)"
  const sizeEntries: { size: string; measurements: Record<string, [number, number]> }[] = []

  // Common patterns for size guides
  const sizePattern = /\b(X{0,3}S|M|L|X{0,3}L|XXL|XXXL|4XL)\s*[:\-=]?\s*([^|\n]+)/gi
  let match: RegExpExecArray | null
  while ((match = sizePattern.exec(cleanGuide)) !== null) {
    const size = match[1].toUpperCase()
    const range = match[2]
    const measurements: Record<string, [number, number]> = {}

    // Try to extract measurements like "pecho: 86-91" or "chest: 34-36"
    const chestMatch = range.match(/(?:pecho|chest|bust)[:\s]*(\d+)\s*[-–]\s*(\d+)/i)
    if (chestMatch) measurements.chest = [parseInt(chestMatch[1]), parseInt(chestMatch[2])]

    const waistMatch = range.match(/(?:cintura|waist)[:\s]*(\d+)\s*[-–]\s*(\d+)/i)
    if (waistMatch) measurements.waist = [parseInt(waistMatch[1]), parseInt(waistMatch[2])]

    const hipsMatch = range.match(/(?:cadera|hips?|hip)[:\s]*(\d+)\s*[-–]\s*(\d+)/i)
    if (hipsMatch) measurements.hips = [parseInt(hipsMatch[1]), parseInt(hipsMatch[2])]

    if (Object.keys(measurements).length > 0) {
      sizeEntries.push({ size, measurements })
    }
  }

  // Also try numeric sizes (38, 40, 42, etc.)
  const numericPattern = /\b(\d{2})\s*[:\-=]?\s*([^|\n]+)/gi
  while ((match = numericPattern.exec(cleanGuide)) !== null) {
    const size = match[1]
    const range = match[2]
    const measurements: Record<string, [number, number]> = {}

    const chestMatch = range.match(/(?:pecho|chest|bust)[:\s]*(\d+)\s*[-–]\s*(\d+)/i)
    if (chestMatch) measurements.chest = [parseInt(chestMatch[1]), parseInt(chestMatch[2])]

    const waistMatch = range.match(/(?:cintura|waist)[:\s]*(\d+)\s*[-–]\s*(\d+)/i)
    if (waistMatch) measurements.waist = [parseInt(waistMatch[1]), parseInt(waistMatch[2])]

    const hipsMatch = range.match(/(?:cadera|hips?|hip)[:\s]*(\d+)\s*[-–]\s*(\d+)/i)
    if (hipsMatch) measurements.hips = [parseInt(hipsMatch[1]), parseInt(hipsMatch[2])]

    if (Object.keys(measurements).length > 0) {
      sizeEntries.push({ size, measurements })
    }
  }

  if (sizeEntries.length === 0) {
    return NextResponse.json({
      recommendedSize: null,
      confidence: 'baja',
      explanation: 'No se pudo interpretar la guía de talles automáticamente. La IA no está disponible en este momento para analizarla.',
      alternative: null,
    })
  }

  // Find the best match based on user measurements
  let bestSize = sizeEntries[0]?.size || null
  let bestConfidence = 'baja'
  let explanation = ''

  const userChest = profile.chest as number | null
  const userWaist = profile.waist as number | null
  const userHips = profile.hips as number | null
  const userShoeSize = profile.shoeSize as number | null

  // For footwear
  if (category === 'calzado' && userShoeSize) {
    // Simple shoe size matching from the guide
    const shoePattern = new RegExp(`\\b(${Math.floor(userShoeSize)}(?:\\.5)?)\\b`)
    const shoeMatch = cleanGuide.match(shoePattern)
    if (shoeMatch) {
      bestSize = shoeMatch[1]
      bestConfidence = 'media'
      explanation = `Tu número de pie (${userShoeSize}) coincide con el talle ${bestSize} en la guía.`
    }
  } else {
    // For clothing: match based on chest/waist/hips
    let matchedMeasurements = 0
    for (const entry of sizeEntries) {
      let matches = 0
      let total = 0

      if (userChest && entry.measurements.chest) {
        total++
        if (userChest >= entry.measurements.chest[0] && userChest <= entry.measurements.chest[1]) {
          matches++
        }
      }
      if (userWaist && entry.measurements.waist) {
        total++
        if (userWaist >= entry.measurements.waist[0] && userWaist <= entry.measurements.waist[1]) {
          matches++
        }
      }
      if (userHips && entry.measurements.hips) {
        total++
        if (userHips >= entry.measurements.hips[0] && userHips <= entry.measurements.hips[1]) {
          matches++
        }
      }

      if (matches > matchedMeasurements) {
        matchedMeasurements = matches
        bestSize = entry.size
        bestConfidence = matches === total && total > 1 ? 'media' : 'baja'

        const matchedParts: string[] = []
        if (userChest && entry.measurements.chest) matchedParts.push(`pecho ${entry.measurements.chest[0]}-${entry.measurements.chest[1]}cm`)
        if (userWaist && entry.measurements.waist) matchedParts.push(`cintura ${entry.measurements.waist[0]}-${entry.measurements.waist[1]}cm`)
        if (userHips && entry.measurements.hips) matchedParts.push(`cadera ${entry.measurements.hips[0]}-${entry.measurements.hips[1]}cm`)
        explanation = `Tus medidas coinciden con el talle ${bestSize} para ${matchedParts.join(', ')}.`
      }
    }

    if (matchedMeasurements === 0) {
      bestConfidence = 'baja'
      explanation = 'Ninguno de tus medidas coincide exactamente con los rangos de la guía de talles. Se recomienda el talle más cercano.'
    }
  }

  return NextResponse.json({
    recommendedSize: bestSize,
    confidence: bestConfidence,
    explanation: explanation || 'Recomendación basada en análisis automático de la guía de talles.',
    alternative: null,
  })
}
