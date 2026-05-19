import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const item = await db.wishlistItem.findUnique({ where: { id } })
    if (!item) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 })
    }
    return NextResponse.json(item)
  } catch (error) {
    console.error('GET /api/items/[id] error:', error)
    return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()

    const data: Record<string, unknown> = {}
    const allowedFields = [
      'title', 'price', 'originalPrice', 'currency', 'brand', 'store',
      'description', 'images', 'sizeGuide', 'recommendedSize', 'sizeReason',
      'category', 'notes', 'purchased', 'priority', 'url',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'images') {
          data[field] = JSON.stringify(body[field])
        } else if (field === 'sizeReason' && body[field]) {
          data[field] = JSON.stringify(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    const item = await db.wishlistItem.update({
      where: { id },
      data,
    })

    return NextResponse.json(item)
  } catch (error) {
    console.error('PATCH /api/items/[id] error:', error)
    return NextResponse.json({ error: 'Failed to update item' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await db.wishlistItem.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/items/[id] error:', error)
    return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 })
  }
}
