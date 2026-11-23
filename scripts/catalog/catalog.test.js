const test = require('node:test')
const assert = require('node:assert/strict')
const { transformUsdaFood } = require('./import-usda-branded')
const { transformOpenFoodFactsProduct } = require('./import-open-food-facts')

test('USDA labels use per-serving label nutrients when present', () => {
  const food = transformUsdaFood({
    fdcId: 123,
    description: 'Protein Bar',
    brandName: 'Plate Labs',
    gtinUpc: '00123456789012',
    marketCountry: 'United States',
    servingSize: 45,
    servingSizeUnit: 'g',
    householdServingFullText: '1 bar (45 g)',
    labelNutrients: {
      calories: { value: 190 },
      protein: { value: 20 },
      fat: { value: 6 },
      carbohydrates: { value: 18 },
      fiber: { value: 5 },
    },
  })

  assert.equal(food.calories, 190)
  assert.equal(food.protein, 20)
  assert.equal(food.serving_size, 45)
  assert.equal(food.barcode, '00123456789012')
})

test('USDA 100g nutrients are scaled to gram serving size', () => {
  const food = transformUsdaFood({
    fdcId: 456,
    description: 'Chicken Breast',
    marketCountry: 'US',
    servingSize: 50,
    servingSizeUnit: 'g',
    foodNutrients: [
      { nutrient: { id: 1008 }, amount: 200 },
      { nutrient: { id: 1003 }, amount: 30 },
      { nutrient: { id: 1004 }, amount: 4 },
    ],
  })

  assert.equal(food.calories, 100)
  assert.equal(food.protein, 15)
  assert.equal(food.fat, 2)
})

test('Open Food Facts uses serving nutrients when available', () => {
  const food = transformOpenFoodFactsProduct({
    code: '0123456789012',
    product_name: 'Granola',
    brands: 'Plate Pantry',
    countries_tags: ['en:united-states'],
    serving_quantity: 40,
    serving_size: '40 g',
    nutriments: {
      'energy-kcal_serving': 180,
      proteins_serving: 6,
      fat_serving: 7,
      carbohydrates_serving: 24,
      fiber_serving: 4,
    },
  })

  assert.equal(food.calories, 180)
  assert.equal(food.fiber, 4)
  assert.equal(food.market_country, 'US')
})

test('Open Food Facts scales 100g nutrients when serving values are absent', () => {
  const food = transformOpenFoodFactsProduct({
    code: '9988776655443',
    product_name: 'Cookie',
    countries_tags: ['en:canada'],
    serving_quantity: 25,
    serving_size: '1 cookie (25 g)',
    nutriments: {
      'energy-kcal_100g': 480,
      proteins_100g: 8,
      fat_100g: 20,
      carbohydrates_100g: 60,
      fiber_100g: 4,
    },
  })

  assert.equal(food.calories, 120)
  assert.equal(food.carbs, 15)
  assert.equal(food.market_country, 'CA')
})
