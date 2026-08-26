#!/usr/bin/env node
/**
 * Backfill Fiber Data Script
 * 
 * This script updates existing foods and food_log entries with fiber data
 * by re-querying the USDA API for foods that have a usda_fdc_id.
 * 
 * Usage:
 *   node scripts/backfill-fiber.js
 * 
 * Requirements:
 *   - Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 *   - Or set SUPABASE_URL and SUPABASE_SERVICE_KEY for admin access
 */

const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env.local
require('dotenv').config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// USDA API config
const USDA_BASE_URL = 'https://api.nal.usda.gov/fdc/v1'
const USDA_API_KEY = 'DEMO_KEY' // Replace with your own key for better rate limits

/**
 * Fetch fiber data from USDA by FDC ID
 */
async function getFiberFromUSDA(fdcId) {
  try {
    const response = await fetch(`${USDA_BASE_URL}/food/${fdcId}?api_key=${USDA_API_KEY}`)
    
    if (!response.ok) {
      return null
    }
    
    const data = await response.json()
    
    // Find fiber nutrient (ID 1079)
    if (data.foodNutrients) {
      for (const nutrient of data.foodNutrients) {
        const id = nutrient.nutrientId || nutrient.nutrient?.id
        if (id === 1079) {
          return nutrient.value || nutrient.amount || 0
        }
      }
    }
    
    return 0 // No fiber data found
  } catch (error) {
    console.error(`  Error fetching USDA data for ${fdcId}:`, error.message)
    return null
  }
}

/**
 * Sleep helper to avoid rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Main backfill function
 */
async function backfillFiber() {
  console.log('🥦 Starting fiber backfill...\n')
  
  // Step 1: Get all foods with usda_fdc_id
  console.log('📦 Fetching foods with USDA FDC IDs...')
  const { data: usdaFoods, error: foodsError } = await supabase
    .from('foods')
    .select('id, name, usda_fdc_id, fiber')
    .not('usda_fdc_id', 'is', null)
  
  if (foodsError) {
    console.error('❌ Error fetching foods:', foodsError.message)
    process.exit(1)
  }
  
  console.log(`   Found ${usdaFoods.length} foods with USDA FDC IDs\n`)
  
  // Step 2: Update each food with fiber data from USDA
  let updatedFoods = 0
  let skippedFoods = 0
  
  for (const food of usdaFoods) {
    // Skip if already has fiber data
    if (food.fiber && food.fiber > 0) {
      console.log(`   ⏭️  Skipping "${food.name}" (already has fiber: ${food.fiber}g)`)
      skippedFoods++
      continue
    }
    
    console.log(`   🔍 Fetching fiber for "${food.name}" (FDC ID: ${food.usda_fdc_id})...`)
    
    const fiber = await getFiberFromUSDA(food.usda_fdc_id)
    
    if (fiber !== null) {
      const { error: updateError } = await supabase
        .from('foods')
        .update({ fiber: Math.round(fiber * 10) / 10 })
        .eq('id', food.id)
      
      if (updateError) {
        console.log(`   ❌ Error updating: ${updateError.message}`)
      } else {
        console.log(`   ✅ Updated with ${fiber}g fiber`)
        updatedFoods++
      }
    } else {
      console.log(`   ⚠️  Could not fetch fiber data`)
    }
    
    // Rate limiting - DEMO_KEY allows 30 requests/hour
    await sleep(200)
  }
  
  console.log(`\n📊 Foods summary: ${updatedFoods} updated, ${skippedFoods} skipped\n`)
  
  // Step 3: Update food_log entries based on food fiber data
  console.log('📝 Updating food_log entries...')
  
  // Get all food_log entries that have fiber = 0 or null
  const { data: logs, error: logsError } = await supabase
    .from('food_log')
    .select('id, food_id, servings, fiber')
    .or('fiber.is.null,fiber.eq.0')
  
  if (logsError) {
    console.error('❌ Error fetching food logs:', logsError.message)
    process.exit(1)
  }
  
  console.log(`   Found ${logs.length} food_log entries to update\n`)
  
  // Get unique food IDs from logs
  const foodIds = [...new Set(logs.map(log => log.food_id))]
  
  // Fetch fiber data for those foods
  const { data: foodsWithFiber, error: fiberError } = await supabase
    .from('foods')
    .select('id, fiber')
    .in('id', foodIds)
    .gt('fiber', 0)
  
  if (fiberError) {
    console.error('❌ Error fetching food fiber data:', fiberError.message)
    process.exit(1)
  }
  
  // Create lookup map
  const fiberMap = {}
  for (const food of foodsWithFiber) {
    fiberMap[food.id] = food.fiber
  }
  
  // Update logs
  let updatedLogs = 0
  for (const log of logs) {
    const foodFiber = fiberMap[log.food_id]
    if (foodFiber) {
      const logFiber = Math.round(foodFiber * log.servings * 10) / 10
      
      const { error: updateError } = await supabase
        .from('food_log')
        .update({ fiber: logFiber })
        .eq('id', log.id)
      
      if (!updateError) {
        updatedLogs++
      }
    }
  }
  
  console.log(`   ✅ Updated ${updatedLogs} food_log entries with fiber data\n`)
  
  console.log('🎉 Fiber backfill complete!')
  console.log(`   Foods updated: ${updatedFoods}`)
  console.log(`   Food logs updated: ${updatedLogs}`)
}

// Run the script
backfillFiber().catch(error => {
  console.error('❌ Script failed:', error)
  process.exit(1)
})
