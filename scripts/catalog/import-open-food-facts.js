#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')
const zlib = require('node:zlib')
const {
  calculateDataQuality,
  getCatalogClient,
  normalizeBarcode,
  numberOrZero,
  roundNutrient,
  upsertCatalogRows,
} = require('./shared')

function isNorthAmericanProduct(product) {
  const countries = product.countries_tags || []
  return countries.some((country) =>
    ['en:united-states', 'en:canada'].includes(String(country).toLowerCase())
  )
}

function parseServingUnit(servingDescription) {
  const match = String(servingDescription || '').match(
    /(?:^|\()\s*[\d.,]+\s*(g|gram|grams|ml|oz|fl oz)\b/i
  )
  return match ? match[1].toLowerCase() : 'g'
}

function nutrientValue(nutriments, key, suffix) {
  return numberOrZero(
    nutriments[`${key}_${suffix}`] ??
    nutriments[`${key.replace('-', '_')}_${suffix}`]
  )
}

function transformOpenFoodFactsProduct(product) {
  const barcode = normalizeBarcode(product.code)
  const name = String(product.product_name || '').trim()
  if (!barcode || !name || !isNorthAmericanProduct(product)) return null

  const nutriments = product.nutriments || {}
  let servingSize = numberOrZero(product.serving_quantity)
  let servingUnit = parseServingUnit(product.serving_size)
  const hasServingNutrition =
    nutrientValue(nutriments, 'energy-kcal', 'serving') > 0 ||
    nutrientValue(nutriments, 'proteins', 'serving') > 0 ||
    nutrientValue(nutriments, 'fat', 'serving') > 0 ||
    nutrientValue(nutriments, 'carbohydrates', 'serving') > 0

  let factor = 1
  let suffix = 'serving'

  if (!hasServingNutrition) {
    suffix = '100g'
    if (servingSize > 0) {
      factor = servingSize / 100
    } else {
      servingSize = 100
      servingUnit = 'g'
    }
  }

  const nutrients = {
    calories: nutrientValue(nutriments, 'energy-kcal', suffix) * factor,
    protein: nutrientValue(nutriments, 'proteins', suffix) * factor,
    fat: nutrientValue(nutriments, 'fat', suffix) * factor,
    carbs: nutrientValue(nutriments, 'carbohydrates', suffix) * factor,
    fiber: (
      nutrientValue(nutriments, 'fiber', suffix) ||
      nutrientValue(nutriments, 'fibers', suffix)
    ) * factor,
  }

  if (
    nutrients.calories <= 0 &&
    nutrients.protein <= 0 &&
    nutrients.fat <= 0 &&
    nutrients.carbs <= 0
  ) {
    return null
  }

  const countries = (product.countries_tags || []).map((value) => String(value).toLowerCase())
  const row = {
    name,
    brand: String(product.brands || '').split(',')[0].trim() || null,
    barcode,
    serving_size: servingSize || 1,
    serving_unit: servingUnit || 'serving',
    serving_description: String(product.serving_size || '').trim() || null,
    calories: roundNutrient(nutrients.calories),
    protein: roundNutrient(nutrients.protein),
    fat: roundNutrient(nutrients.fat),
    carbs: roundNutrient(nutrients.carbs),
    fiber: roundNutrient(nutrients.fiber),
    image_url: product.image_small_url || product.image_front_small_url || null,
    market_country: countries.includes('en:united-states') ? 'US' : 'CA',
    source: 'open_food_facts',
    source_id: barcode,
    source_license: 'Open Database License (ODbL)',
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
      'Usage: npm run catalog:import:off -- /path/to/openfoodfacts-products.jsonl[.gz]'
    )
  }

  const resolvedPath = path.resolve(inputPath)
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Open Food Facts catalog file not found: ${resolvedPath}`)
  }

  const client = getCatalogClient()
  const lines = readline.createInterface({
    input: createInputStream(resolvedPath),
    crlfDelay: Infinity,
  })

  let batch = []
  let read = 0
  let imported = 0
  let skipped = 0

  for await (const line of lines) {
    read += 1

    try {
      const row = transformOpenFoodFactsProduct(JSON.parse(line))
      if (row) batch.push(row)
      else skipped += 1
    } catch {
      skipped += 1
    }

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
    `\nOpen Food Facts import complete: ${imported.toLocaleString()} imported, ` +
    `${skipped.toLocaleString()} skipped.`
  )
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Open Food Facts catalog import failed: ${error.message}`)
    process.exit(1)
  })
}

module.exports = { transformOpenFoodFactsProduct }
