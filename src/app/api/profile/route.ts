import { db } from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    let profile = await db.userProfile.findUnique({ where: { id: 'default' } })
    if (!profile) {
      profile = await db.userProfile.create({
        data: { id: 'default' },
      })
    }
    return NextResponse.json(profile)
  } catch (error) {
    console.error('GET /api/profile error:', error)
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()

    const data: Record<string, unknown> = {}
    const fields = [
      'chest', 'waist', 'hips', 'shoulderWidth', 'armLength',
      'inseam', 'height', 'weight', 'shoeSize', 'notes',
    ]
    for (const field of fields) {
      if (body[field] !== undefined) {
        data[field] = body[field] === '' ? null : body[field]
      }
    }

    const profile = await db.userProfile.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    })

    return NextResponse.json(profile)
  } catch (error) {
    console.error('PUT /api/profile error:', error)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
