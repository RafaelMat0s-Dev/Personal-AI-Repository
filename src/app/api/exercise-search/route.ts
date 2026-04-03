import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get('name') || ''
  const muscle = searchParams.get('muscle') || ''

  const url = new URL('https://api.api-ninjas.com/v1/exercises')
  if (name) url.searchParams.set('name', name)
  if (muscle) url.searchParams.set('muscle', muscle)

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'X-Api-Key': process.env.NEXT_PUBLIC_API_NINJAS_KEY || '',
      },
      next: { revalidate: 3600 },
    })

    if (!res.ok) {
      return NextResponse.json([], { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Exercise proxy error:', err)
    return NextResponse.json([], { status: 500 })
  }
}
