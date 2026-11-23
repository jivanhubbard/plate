import { supabase } from './supabase'

function displayName(food) {
  if (!food.brand) return food.name
  if (food.name.toLowerCase().includes(food.brand.toLowerCase())) return food.name
  return `${food.brand} ${food.name}`
}

function transformCatalogFood(food) {
  return {
    id: `catalog_${food.id}`,
    catalogId: food.id,
    fdcId: food.source === 'usda' ? Number(food.source_id) || null : null,
    name: displayName(food),
    brand: food.brand || null,
    barcode: food.barcode || null,
    serving_size: String(food.serving_size || 1),
    serving_unit: food.serving_unit || 'serving',
    serving_description: food.serving_description || null,
    calories: Number(food.calories) || 0,
    protein: Number(food.protein) || 0,
    fat: Number(food.fat) || 0,
    carbs: Number(food.carbs) || 0,
    fiber: Number(food.fiber) || 0,
    image_url: food.image_url || null,
    source: food.source,
    sourceId: food.source_id,
    dataQuality: food.data_quality,
  }
}

export async function searchCatalogFoods(query, limit = 20) {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) {
    return { products: [], count: 0, available: true }
  }

  const { data, error } = await supabase.rpc('search_branded_foods', {
    search_query: normalizedQuery,
    result_limit: limit,
  })

  if (error) {
    return {
      products: [],
      count: 0,
      available: false,
      error,
    }
  }

  const products = (data || []).map(transformCatalogFood)
  return {
    products,
    count: products.length,
    available: true,
  }
}

export async function findCatalogFoodByBarcode(barcode) {
  const normalizedBarcode = String(barcode || '').replace(/\D/g, '')
  if (normalizedBarcode.length < 8) return null

  const { data, error } = await supabase
    .from('branded_foods')
    .select('*')
    .eq('barcode', normalizedBarcode)
    .order('data_quality', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return transformCatalogFood(data)
}
