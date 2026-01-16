// USDA FoodData Central API integration
// https://fdc.nal.usda.gov/api-guide.html
// Free public food database with comprehensive brand coverage

const BASE_URL = 'https://api.nal.usda.gov/fdc/v1'

// Demo API key - works for moderate usage
// For production, get your own free key at: https://fdc.nal.usda.gov/api-key-signup.html
const API_KEY = 'DEMO_KEY'

/**
 * Search for branded foods by name
 * @param {string} query - Search term
 * @param {number} pageSize - Number of results per page
 * @returns {Promise<{products: Array, totalHits: number}>}
 */
export async function searchBrandedFoods(query, pageSize = 25) {
  try {
    const response = await fetch(`${BASE_URL}/foods/search?api_key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: query,
        dataType: ['Branded'], // Only search branded foods
        pageSize: pageSize,
        sortBy: 'dataType.keyword',
        sortOrder: 'asc',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to fetch from USDA FoodData Central')
    }

    const data = await response.json()

    // Transform to our app's format
    const products = (data.foods || [])
      .map(food => transformFood(food))
      .filter(food => food !== null)

    return {
      products,
      totalHits: data.totalHits || 0,
    }
  } catch (error) {
    console.error('USDA FoodData Central search error:', error)
    return { products: [], totalHits: 0 }
  }
}

/**
 * Get a specific food item by FDC ID
 * @param {number} fdcId - The FDC ID
 * @returns {Promise<object|null>}
 */
export async function getFoodById(fdcId) {
  try {
    const response = await fetch(`${BASE_URL}/food/${fdcId}?api_key=${API_KEY}`)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return transformFood(data)
  } catch (error) {
    console.error('USDA FoodData Central lookup error:', error)
    return null
  }
}

/**
 * Search for foods by UPC/GTIN barcode
 * @param {string} upc - The barcode
 * @returns {Promise<object|null>}
 */
export async function searchByUPC(upc) {
  try {
    const response = await fetch(`${BASE_URL}/foods/search?api_key=${API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: upc,
        dataType: ['Branded'],
        pageSize: 5,
      }),
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    // Find exact match by GTIN/UPC
    const match = (data.foods || []).find(food => 
      food.gtinUpc === upc || 
      food.gtinUpc === upc.padStart(14, '0') ||
      upc.includes(food.gtinUpc)
    )

    if (match) {
      return transformFood(match)
    }

    // Return first result if no exact match
    if (data.foods && data.foods.length > 0) {
      return transformFood(data.foods[0])
    }

    return null
  } catch (error) {
    console.error('USDA FoodData Central UPC lookup error:', error)
    return null
  }
}

/**
 * Transform USDA food data to our app's format
 * @param {object} food - Raw food from API
 * @returns {object|null}
 */
function transformFood(food) {
  if (!food) return null

  // Get nutrients from the food nutrients array
  const nutrients = {}
  if (food.foodNutrients) {
    food.foodNutrients.forEach(nutrient => {
      const id = nutrient.nutrientId || nutrient.nutrient?.id
      const value = nutrient.value || nutrient.amount || 0
      
      // Nutrient IDs in USDA:
      // 1008 = Energy (kcal)
      // 1003 = Protein
      // 1004 = Total Fat
      // 1005 = Carbohydrates
      if (id === 1008) nutrients.calories = value
      if (id === 1003) nutrients.protein = value
      if (id === 1004) nutrients.fat = value
      if (id === 1005) nutrients.carbs = value
    })
  }

  // Skip if no nutrition data
  if (!nutrients.calories && !nutrients.protein && !nutrients.fat && !nutrients.carbs) {
    return null
  }

  // Parse serving size
  let servingSize = '100'
  let servingUnit = 'g'
  
  if (food.servingSize) {
    servingSize = food.servingSize.toString()
    servingUnit = food.servingSizeUnit || 'g'
  } else if (food.householdServingFullText) {
    // Try to parse household serving like "1 cup" or "2 tbsp"
    const match = food.householdServingFullText.match(/^([\d.]+)\s*(.+)/)
    if (match) {
      servingSize = match[1]
      servingUnit = match[2].trim()
    } else {
      servingUnit = food.householdServingFullText
      servingSize = '1'
    }
  }

  // Construct product name with brand
  let name = food.description || food.lowercaseDescription || 'Unknown Product'
  if (food.brandOwner && !name.toLowerCase().includes(food.brandOwner.toLowerCase())) {
    name = `${food.brandOwner} ${name}`
  } else if (food.brandName && !name.toLowerCase().includes(food.brandName.toLowerCase())) {
    name = `${food.brandName} ${name}`
  }

  return {
    id: `usda_${food.fdcId}`,
    fdcId: food.fdcId,
    name: name.trim(),
    barcode: food.gtinUpc || null,
    serving_size: servingSize,
    serving_unit: servingUnit.toLowerCase(),
    calories: Math.round((nutrients.calories || 0) * 10) / 10,
    protein: Math.round((nutrients.protein || 0) * 10) / 10,
    fat: Math.round((nutrients.fat || 0) * 10) / 10,
    carbs: Math.round((nutrients.carbs || 0) * 10) / 10,
    brandOwner: food.brandOwner || null,
    source: 'usda',
  }
}

