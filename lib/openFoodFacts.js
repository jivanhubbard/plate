// Open Food Facts API integration
// https://world.openfoodfacts.org/data
// Free and open-source food database

const BASE_URL = 'https://world.openfoodfacts.org'

/**
 * Search for products by name
 * @param {string} query - Search term
 * @param {number} page - Page number (starts at 1)
 * @param {number} pageSize - Number of results per page
 * @returns {Promise<{products: Array, count: number}>}
 */
export async function searchProducts(query, page = 1, pageSize = 20) {
  try {
    const url = new URL(`${BASE_URL}/cgi/search.pl`)
    url.searchParams.set('search_terms', query)
    url.searchParams.set('search_simple', '1')
    url.searchParams.set('action', 'process')
    url.searchParams.set('json', '1')
    url.searchParams.set('page', page.toString())
    url.searchParams.set('page_size', pageSize.toString())
    // Focus on products with nutrition data
    url.searchParams.set('fields', 'code,product_name,brands,serving_size,serving_quantity,nutriments,image_small_url')

    const response = await fetch(url.toString())

    if (!response.ok) {
      throw new Error('Failed to fetch from Open Food Facts')
    }

    const data = await response.json()
    
    // Transform to our app's format
    const products = (data.products || [])
      .filter(product => product.product_name && product.nutriments)
      .map(product => transformProduct(product))
      .filter(product => product !== null)

    return {
      products,
      count: data.count || 0,
      page: data.page || 1,
    }
  } catch (error) {
    console.error('Open Food Facts search error:', error)
    return { products: [], count: 0, page: 1 }
  }
}

/**
 * Look up a product by barcode (UPC/EAN)
 * @param {string} barcode - The product barcode
 * @returns {Promise<object|null>}
 */
export async function getProductByBarcode(barcode) {
  try {
    const response = await fetch(`${BASE_URL}/api/v2/product/${barcode}.json`)

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    
    if (data.status !== 1 || !data.product) {
      return null
    }

    return transformProduct(data.product)
  } catch (error) {
    console.error('Open Food Facts barcode lookup error:', error)
    return null
  }
}

/**
 * Transform Open Food Facts product to our app's format
 * @param {object} product - Raw product from API
 * @returns {object|null}
 */
function transformProduct(product) {
  if (!product || !product.nutriments) return null

  const nutriments = product.nutriments
  
  // Get serving size - prefer serving quantity, fallback to 100g
  let servingSize = '100'
  let servingUnit = 'g'
  
  if (product.serving_quantity) {
    servingSize = product.serving_quantity.toString()
    servingUnit = 'g'
  } else if (product.serving_size) {
    // Try to parse serving size string like "28g" or "1 cup (240ml)"
    const match = product.serving_size.match(/^([\d.]+)\s*(\w+)?/)
    if (match) {
      servingSize = match[1]
      servingUnit = match[2] || 'serving'
    } else {
      servingSize = '1'
      servingUnit = product.serving_size
    }
  }

  // Get nutrients per serving if available, otherwise per 100g
  const hasServingNutrients = nutriments['energy-kcal_serving'] !== undefined
  const suffix = hasServingNutrients ? '_serving' : '_100g'
  
  // Calories - try kcal first, then convert from kJ if needed
  let calories = nutriments[`energy-kcal${suffix}`] || 0
  if (!calories && nutriments[`energy${suffix}`]) {
    // Convert kJ to kcal (1 kcal = 4.184 kJ)
    calories = nutriments[`energy${suffix}`] / 4.184
  }
  
  // If using 100g values but we have a different serving size, adjust
  if (!hasServingNutrients && servingSize !== '100') {
    const factor = parseFloat(servingSize) / 100
    calories = calories * factor
  }

  const protein = nutriments[`proteins${suffix}`] || nutriments[`protein${suffix}`] || 0
  const fat = nutriments[`fat${suffix}`] || 0
  const carbs = nutriments[`carbohydrates${suffix}`] || 0
  const fiber = nutriments[`fiber${suffix}`] || 0

  // Skip products without meaningful nutrition data
  if (calories === 0 && protein === 0 && fat === 0 && carbs === 0) {
    return null
  }

  // Construct product name with brand
  let name = product.product_name || 'Unknown Product'
  if (product.brands) {
    // Take first brand if multiple
    const brand = product.brands.split(',')[0].trim()
    if (!name.toLowerCase().includes(brand.toLowerCase())) {
      name = `${brand} ${name}`
    }
  }

  // Adjust macros if using 100g values
  let adjustedProtein = protein
  let adjustedFat = fat
  let adjustedCarbs = carbs
  let adjustedFiber = fiber
  
  if (!hasServingNutrients && servingSize !== '100') {
    const factor = parseFloat(servingSize) / 100
    adjustedProtein = protein * factor
    adjustedFat = fat * factor
    adjustedCarbs = carbs * factor
    adjustedFiber = fiber * factor
  }

  return {
    id: `off_${product.code}`, // Prefix to identify Open Food Facts products
    name: name.trim(),
    barcode: product.code,
    serving_size: servingSize,
    serving_unit: servingUnit,
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(adjustedProtein * 10) / 10,
    fat: Math.round(adjustedFat * 10) / 10,
    carbs: Math.round(adjustedCarbs * 10) / 10,
    fiber: Math.round(adjustedFiber * 10) / 10,
    image_url: product.image_small_url || null,
    source: 'openfoodfacts',
  }
}

