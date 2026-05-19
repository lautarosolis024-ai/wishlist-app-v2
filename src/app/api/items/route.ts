import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const store = searchParams.get('store') || ''
    const purchased = searchParams.get('purchased')

    const where: Record<string, unknown> = {}

    if (search) {
      where.OR = [
        { title: { contains: search } },
        { brand: { contains: search } },
        { store: { contains: search } },
      ]
    }

    if (category && category !== 'all') {
      where.category = category
    }

    if (store && store !== 'all') {
      where.store = { contains: store }
    }

    if (purchased !== null && purchased !== '') {
      where.purchased = purchased === 'true'
    }

    const items = await db.wishlistItem.findMany({
      where,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json(items)
  } catch (error) {
    console.error('GET /api/items error:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const item = await db.wishlistItem.create({
      data: {
        url: body.url,
        title: body.title,
        price: body.price ?? null,
        originalPrice: body.originalPrice ?? null,
        currency: body.currency || 'ARS',
        brand: body.brand || null,
        store: body.store || null,
        description: body.description || null,
        images: JSON.stringify(body.images || []),
        sizeGuide: body.sizeGuide || null,
        recommendedSize: body.recommendedSize || null,
        sizeReason: body.sizeReason ? JSON.stringify(body.sizeReason) : null,
        category: body.category || 'otros',
        notes: body.notes || null,
        purchased: body.purchased || false,
        priority: body.priority || 0,
      },
    })

    return NextResponse.json(item, { status: 201 })
  } catch (error) {
    console.error('POST /api/items error:', error)
    return NextResponse.json({ error: 'Failed to create item' }, { status: 500 })
  }
}
