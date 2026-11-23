const path = require('node:path')
const { createClient } = require('@supabase/supabase-js')

require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

function getCatalogClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      'Catalog imports require SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) ' +
      'and SUPABASE_SERVICE_ROLE_KEY in .env.local'
    )
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

function numberOrZero(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullableNumber(value) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : null
}

function roundNutrient(value) {
  return Math.round(numberOrZero(value) * 1000) / 1000
}

function normalizeBarcode(value) {
  const digits = String(value || '').replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}

function calculateDataQuality(food) {
  let score = 0

  if (food.name) score += 20
  if (food.brand) score += 10
  if (food.barcode) score += 15
  if (food.serving_size && food.serving_unit) score += 15
  if (food.calories > 0) score += 20
  if (food.protein > 0 || food.fat > 0 || food.carbs > 0) score += 15
  if (food.fiber > 0) score += 5

  return Math.min(score, 100)
}

async function upsertCatalogRows(client, rows, options = {}) {
  const batchSize = options.batchSize || 500
  let imported = 0

  for (let start = 0; start < rows.length; start += batchSize) {
    const batch = rows.slice(start, start + batchSize)
    const { error } = await client
      .from('branded_foods')
      .upsert(batch, { onConflict: 'source,source_id' })

    if (error) throw error
    imported += batch.length
  }

  return imported
}

module.exports = {
  calculateDataQuality,
  getCatalogClient,
  normalizeBarcode,
  nullableNumber,
  numberOrZero,
  roundNutrient,
  upsertCatalogRows,
}
