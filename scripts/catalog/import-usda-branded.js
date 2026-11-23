#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')
const {
  calculateDataQuality,
  getCatalogClient,
  normalizeBarcode,
  numberOrZero,
  roundNutrient,
  upsertCatalogRows,
} = require('./shared')

const NUTRIENT_IDS = {
  calories: 1008,
  protein: 1003,
  fat: 1004,
  carbs: 1005,
  fiber: 1079,
}

function nutrientAmount(food, nutrientId) {
  const nutrient = (food.foodNutrients || []).find((item) => {
    const id = item.nutrient?.id || item.nutrientId
    return Number(id) === nutrientId
  })

  return numberOrZero(nutrient?.amount || nutrient?.value)
}

function labelAmount(food, key) {
  return numberOrZero(food.labelNutrients?.[key]?.value)
}

function transformUsdaFood(food) {
  const sourceId = food.fdcId || food.fdc_id
  const name = String(food.description || food.shortDescription || '').trim()
  if (!sourceId || !name) return null

  const marketCountry = String(food.marketCountry || 'US').toUpperCase()
  if (!['US', 'USA', 'UNITED STATES'].includes(marketCountry)) return null

  let servingSize = numberOrZero(food.servingSize)
  let servingUnit = String(food.servingSizeUnit || '').trim().toLowerCase()
  const hasLabelNutrients = labelAmount(food, 'calories') > 0
  let factor = 1

  if (!hasLabelNutrients) {
    if (servingSize > 0 && ['g', 'gram', 'grams'].includes(servingUnit)) {
      factor = servingSize / 100
    } else {
      servingSize = 100
      servingUnit = 'g'
    }
  }

  const nutrients = hasLabelNutrients
    ? {
        calories: labelAmount(food, 'calories'),
        protein: labelAmount(food, 'protein'),
        fat: labelAmount(food, 'fat'),
        carbs: labelAmount(food, 'carbohydrates'),
        fiber: labelAmount(food, 'fiber'),
      }
    : {
        calories: nutrientAmount(food, NUTRIENT_IDS.calories) * factor,
        protein: nutrientAmount(food, NUTRIENT_IDS.protein) * factor,
        fat: nutrientAmount(food, NUTRIENT_IDS.fat) * factor,
        carbs: nutrientAmount(food, NUTRIENT_IDS.carbs) * factor,
        fiber: nutrientAmount(food, NUTRIENT_IDS.fiber) * factor,
      }

  if (
    nutrients.calories <= 0 &&
    nutrients.protein <= 0 &&
    nutrients.fat <= 0 &&
    nutrients.carbs <= 0
  ) {
    return null
  }

  const row = {
    name,
    brand: String(food.brandName || food.brandOwner || '').trim() || null,
    barcode: normalizeBarcode(food.gtinUpc),
    serving_size: servingSize || 1,
    serving_unit: servingUnit || 'serving',
    serving_description: String(food.householdServingFullText || '').trim() || null,
    calories: roundNutrient(nutrients.calories),
    protein: roundNutrient(nutrients.protein),
    fat: roundNutrient(nutrients.fat),
    carbs: roundNutrient(nutrients.carbs),
    fiber: roundNutrient(nutrients.fiber),
    image_url: null,
    market_country: 'US',
    source: 'usda',
    source_id: String(sourceId),
    source_license: 'USDA public domain',
    last_synced_at: new Date().toISOString(),
  }

  row.data_quality = calculateDataQuality(row)
  return row
}

function createInputStream(filePath) {
  const fileStream = fs.createReadStream(filePath)
  return filePath.endsWith('.gz') ? fileStream.pipe(zlib.createGunzip()) : fileStream
}

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) {
    throw new Error(
      'Usage: npm run catalog:import:usda -- /path/to/FoodData_Central_branded_food_json.json[.gz]'
    )
  }

  const resolvedPath = path.resolve(inputPath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`USDA catalog file not found: ${resolvedPath}`)
  }

  const client = getCatalogClient()
  const [
    { chain },
    { parser },
    { pick },
    { streamArray },
  ] = await Promise.all([
    import('stream-chain'),
    import('stream-json'),
    import('stream-json/filters/pick.js'),
    import('stream-json/streamers/stream-array.js'),
  ])
  const pipeline = chain([
    createInputStream(resolvedPath),
    parser(),
    pick({ filter: 'BrandedFoods' }),
    streamArray(),
  ])

  let batch = []
  let read = 0
  let imported = 0
  let skipped = 0

  for await (const { value } of pipeline) {
    read += 1
    const row = transformUsdaFood(value)

    if (row) batch.push(row)
    else skipped += 1

    if (batch.length >= 500) {
      imported += await upsertCatalogRows(client, batch)
      batch = []
      process.stdout.write(`\rRead ${read.toLocaleString()} · imported ${imported.toLocaleString()}`)
    }
  }

  if (batch.length > 0) {
    imported += await upsertCatalogRows(client, batch)
  }

  console.log(
    `\nUSDA import complete: ${imported.toLocaleString()} imported, ` +
    `${skipped.toLocaleString()} skipped.`
  )
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`USDA catalog import failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = { transformUsdaFood }
