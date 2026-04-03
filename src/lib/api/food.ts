import { FoodSearchResult } from '@/types'

export async function searchFood(query: string): Promise<FoodSearchResult[]> {
  if (!query.trim()) return []
  try {
    const res = await fetch(`/api/food-search?query=${encodeURIComponent(query)}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const products: FoodSearchResult[] = data?.products || []
    return products
      .filter(p =>
        p.product_name &&
        p.nutriments?.['energy-kcal_100g'] !== undefined
      )
      .slice(0, 8)
  } catch (err) {
    console.error('Food search error:', err)
    return []
  }
}

export function calcNutrition(
  product: FoodSearchResult,
  grams: number
): { calories: number; protein: number; carbs: number; fat: number } {
  const ratio = grams / 100
  const n = product.nutriments
  return {
    calories: Math.round((n['energy-kcal_100g'] || 0) * ratio),
    protein: Math.round((n.proteins_100g || 0) * ratio * 10) / 10,
    carbs: Math.round((n.carbohydrates_100g || 0) * ratio * 10) / 10,
    fat: Math.round((n.fat_100g || 0) * ratio * 10) / 10,
  }
}
