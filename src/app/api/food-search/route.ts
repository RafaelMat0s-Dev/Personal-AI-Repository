import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query') || ''

  if (!query.trim()) {
    return NextResponse.json({ products: [] })
  }

  // Try Open Food Facts v2 search API (more stable)
  try {
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&fields=product_name,brands,nutriments,serving_size&page_size=10&json=true`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PersonalOS/1.0 (personal productivity app)',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }
  } catch (err) {
    console.warn('OFF v2 failed, trying v1:', err)
  }

  // Fallback to v1 endpoint
  try {
    const url = `https://world.openfoodfacts.net/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10&fields=product_name,brands,nutriments,serving_size`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'PersonalOS/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }
  } catch (err) {
    console.warn('OFF v1 also failed:', err)
  }

  // Both failed — return empty so UI degrades gracefully
  return NextResponse.json({ products: [] })
}
