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

    const zai = await getZAI()

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
  } catch (error) {
    console.error('POST /api/recommend-size error:', error)
    return NextResponse.json({ error: 'Failed to recommend size' }, { status: 500 })
  }
}
