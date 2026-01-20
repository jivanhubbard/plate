'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { searchProducts } from '@/lib/openFoodFacts'
import { searchBrandedFoods } from '@/lib/usdaFoodData'
import styles from './AddFoodModal.module.css'

// Helper to auto-select meal type based on time
function getMealTypeFromTime(timeStr) {
  if (!timeStr) return ''
  const [hour, min] = timeStr.split(':').map(Number)
  const totalMinutes = hour * 60 + min
  
  // 6:00 AM - 11:59 AM = breakfast
  if (totalMinutes >= 360 && totalMinutes < 720) return 'breakfast'
  // 12:00 PM - 2:00 PM = lunch
  if (totalMinutes >= 720 && totalMinutes < 840) return 'lunch'
  // 2:00 PM - 4:59 PM = snack
  if (totalMinutes >= 840 && totalMinutes < 1020) return 'snack'
  // 5:00 PM - 8:00 PM = dinner
  if (totalMinutes >= 1020 && totalMinutes < 1200) return 'dinner'
  // Outside these times = no auto-select
  return ''
}

export default function AddFoodModal({ foods, selectedDate, userId, onClose, onFoodAdded }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFood, setSelectedFood] = useState(null)
  const [servings, setServings] = useState('1')
  const [loggedTime, setLoggedTime] = useState(() => {
    // Default to current time
    const now = new Date()
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })
  // Auto-select meal type based on current time
  const [mealType, setMealType] = useState(() => {
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    return getMealTypeFromTime(timeStr)
  })
  const [activeTab, setActiveTab] = useState('my-foods') // 'my-foods', 'brand-search', 'custom'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Brand search state
  const [brandSearchTerm, setBrandSearchTerm] = useState('')
  const [brandResults, setBrandResults] = useState([])
  const [brandSearching, setBrandSearching] = useState(false)
  const [brandSearchCount, setBrandSearchCount] = useState(0)

  // Custom food form state
  const [customFood, setCustomFood] = useState({
    name: '',
    serving_size: '1',
    serving_unit: 'serving',
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
  })

  // Filter and deduplicate foods by name (keep first occurrence)
  const filteredFoods = foods
    .filter((food) => food.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((food, index, self) => 
      index === self.findIndex((f) => f.name.toLowerCase() === food.name.toLowerCase())
    )

  // Debounced brand search - queries both Open Food Facts AND USDA
  useEffect(() => {
    if (activeTab !== 'brand-search' || brandSearchTerm.length < 2) {
      setBrandResults([])
      setBrandSearchCount(0)
      return
    }

    let cancelled = false
    setBrandSearching(true)

    const timeoutId = setTimeout(async () => {
      try {
        // Query both databases in parallel for better brand coverage
        const [offResult, usdaResult] = await Promise.all([
          searchProducts(brandSearchTerm),
          searchBrandedFoods(brandSearchTerm),
        ])

        // Don't update state if this request was cancelled
        if (cancelled) return

        // Merge results, prioritizing USDA for US brands
        const combined = []
        const seen = new Set()

        // Add USDA results first (often better for US brands)
        for (const product of usdaResult.products) {
          const key = product.name.toLowerCase().replace(/\s+/g, '')
          if (!seen.has(key)) {
            seen.add(key)
            combined.push(product)
          }
        }

        // Add Open Food Facts results (good for international products)
        for (const product of offResult.products) {
          const key = product.name.toLowerCase().replace(/\s+/g, '')
          if (!seen.has(key)) {
            seen.add(key)
            combined.push(product)
          }
        }

        setBrandResults(combined)
        setBrandSearchCount(offResult.count + usdaResult.totalHits)
      } catch (err) {
        if (!cancelled) {
          console.error('Brand search error:', err)
        }
      } finally {
        if (!cancelled) {
          setBrandSearching(false)
        }
      }
    }, 300) // Reduced debounce from 400ms to 300ms

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      setBrandSearching(false)
    }
  }, [brandSearchTerm, activeTab])

  const handleSelectFood = (food) => {
    setSelectedFood(food)
    setSearchTerm('')
    setBrandSearchTerm('')
  }

  const handleSelectBrandFood = (food) => {
    // Mark as brand food so we know to save it to DB first
    setSelectedFood({ ...food, isBrandFood: true })
    setBrandSearchTerm('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let foodId = selectedFood?.id
      let food = selectedFood

      // If creating custom food
      if (activeTab === 'custom') {
        const { data: newFood, error: foodError } = await supabase
          .from('foods')
          .insert({
            name: customFood.name,
            serving_size: customFood.serving_size,
            serving_unit: customFood.serving_unit,
            calories: parseFloat(customFood.calories),
            protein: parseFloat(customFood.protein) || 0,
            fat: parseFloat(customFood.fat) || 0,
            carbs: parseFloat(customFood.carbs) || 0,
            is_custom: true,
            user_id: userId,
          })
          .select()
          .single()

        if (foodError) throw foodError
        foodId = newFood.id
        food = customFood
      }
      // If selecting a brand food, check if it exists first, then save if not
      else if (selectedFood?.isBrandFood) {
        // Check if this food already exists for this user (match by name)
        const { data: existingFood } = await supabase
          .from('foods')
          .select('id')
          .eq('user_id', userId)
          .eq('name', selectedFood.name)
          .single()

        if (existingFood) {
          // Food already exists, use it
          foodId = existingFood.id
        } else {
          // Create new food entry
          const { data: newFood, error: foodError } = await supabase
            .from('foods')
            .insert({
              name: selectedFood.name,
              serving_size: selectedFood.serving_size,
              serving_unit: selectedFood.serving_unit,
              calories: selectedFood.calories,
              protein: selectedFood.protein || 0,
              fat: selectedFood.fat || 0,
              carbs: selectedFood.carbs || 0,
              is_custom: true,
              user_id: userId,
            })
            .select()
            .single()

          if (foodError) throw foodError
          foodId = newFood.id
        }
      }

      if (!foodId) {
        throw new Error('Please select or create a food')
      }

      const servingsNum = parseFloat(servings) || 1

      // Calculate macros based on servings
      const calories = (parseFloat(food.calories) || 0) * servingsNum
      const protein = (parseFloat(food.protein) || 0) * servingsNum
      const fat = (parseFloat(food.fat) || 0) * servingsNum
      const carbs = (parseFloat(food.carbs) || 0) * servingsNum

      const { error: logError } = await supabase
        .from('food_log')
        .insert({
          user_id: userId,
          food_id: foodId,
          date: selectedDate,
          meal_type: mealType || null,
          servings: servingsNum,
          calories,
          protein,
          fat,
          carbs,
          logged_at: loggedTime + ':00', // Add seconds for TIME format
        })

      if (logError) throw logError

      onFoodAdded()
    } catch (error) {
      setError(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Add Food</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'my-foods' ? styles.active : ''}`}
            onClick={() => { setActiveTab('my-foods'); setSelectedFood(null) }}
          >
            My Foods
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'brand-search' ? styles.active : ''}`}
            onClick={() => { setActiveTab('brand-search'); setSelectedFood(null) }}
          >
            Brand Search
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'custom' ? styles.active : ''}`}
            onClick={() => { setActiveTab('custom'); setSelectedFood(null) }}
          >
            Custom
          </button>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* My Foods Tab */}
          {activeTab === 'my-foods' && (
            <>
              <div className={styles.inputGroup}>
                <label>Search My Foods</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search your saved foods..."
                  className={styles.searchInput}
                />
                {searchTerm && filteredFoods.length > 0 && (
                  <div className={styles.foodList}>
                    {filteredFoods.slice(0, 10).map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        onClick={() => handleSelectFood(food)}
                        className={styles.foodItem}
                      >
                        <div>
                          <div className={styles.foodName}>{food.name}</div>
                          <div className={styles.foodDetails}>
                            {food.serving_size} {food.serving_unit} • {food.calories} kcal
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchTerm && filteredFoods.length === 0 && (
                  <div className={styles.noResults}>
                    No matches found. Try <button type="button" onClick={() => setActiveTab('brand-search')} className={styles.linkButton}>Brand Search</button> or <button type="button" onClick={() => setActiveTab('custom')} className={styles.linkButton}>add custom food</button>.
                  </div>
                )}
              </div>
            </>
          )}

          {/* Brand Search Tab */}
          {activeTab === 'brand-search' && (
            <>
              <div className={styles.inputGroup}>
                <label>Search Brand Foods</label>
                <div className={styles.searchWithIcon}>
                  <input
                    type="text"
                    value={brandSearchTerm}
                    onChange={(e) => setBrandSearchTerm(e.target.value)}
                    placeholder="Search Doritos, Tillamook, Beecher's..."
                    className={styles.searchInput}
                  />
                  {brandSearching && <span className={styles.searchSpinner}></span>}
                </div>
                {brandSearchTerm.length > 0 && brandSearchTerm.length < 2 && (
                  <div className={styles.searchHint}>Type at least 2 characters...</div>
                )}
                {brandResults.length > 0 && (
                  <div className={styles.foodList}>
                    {brandResults.slice(0, 15).map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        onClick={() => handleSelectBrandFood(food)}
                        className={styles.foodItem}
                      >
                        <div className={styles.brandFoodContent}>
                          {food.image_url && (
                            <img 
                              src={food.image_url} 
                              alt="" 
                              className={styles.foodImage}
                              onError={(e) => e.target.style.display = 'none'}
                            />
                          )}
                          <div>
                            <div className={styles.foodName}>{food.name}</div>
                            <div className={styles.foodDetails}>
                              {food.serving_size}{food.serving_unit} • {food.calories} kcal • P:{food.protein}g F:{food.fat}g C:{food.carbs}g
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {brandSearchTerm.length >= 2 && !brandSearching && brandResults.length === 0 && (
                  <div className={styles.noResults}>
                    No brand foods found. Try a different search or <button type="button" onClick={() => setActiveTab('custom')} className={styles.linkButton}>add custom food</button>.
                  </div>
                )}
                {brandSearchCount > 15 && (
                  <div className={styles.resultCount}>Showing 15 of {brandSearchCount} results</div>
                )}
              </div>
              <div className={styles.poweredBy}>
                Powered by <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a> & <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>
              </div>
            </>
          )}

          {/* Custom Food Tab */}
          {activeTab === 'custom' && (
            <div className={styles.customForm}>
              <div className={styles.inputGroup}>
                <label>Food Name *</label>
                <input
                  type="text"
                  value={customFood.name}
                  onChange={(e) => setCustomFood({ ...customFood, name: e.target.value })}
                  required
                  placeholder="e.g., Grilled Chicken Breast"
                />
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Serving Size *</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customFood.serving_size}
                    onChange={(e) => setCustomFood({ ...customFood, serving_size: e.target.value })}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Unit *</label>
                  <input
                    type="text"
                    value={customFood.serving_unit}
                    onChange={(e) => setCustomFood({ ...customFood, serving_unit: e.target.value })}
                    required
                    placeholder="e.g., cup, oz, g"
                  />
                </div>
              </div>

              <div className={styles.inputGroup}>
                <label>Calories *</label>
                <input
                  type="number"
                  step="0.1"
                  value={customFood.calories}
                  onChange={(e) => setCustomFood({ ...customFood, calories: e.target.value })}
                  required
                />
              </div>

              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label>Protein (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customFood.protein}
                    onChange={(e) => setCustomFood({ ...customFood, protein: e.target.value })}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Fat (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customFood.fat}
                    onChange={(e) => setCustomFood({ ...customFood, fat: e.target.value })}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Carbs (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customFood.carbs}
                    onChange={(e) => setCustomFood({ ...customFood, carbs: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Selected food display (for my-foods and brand-search tabs) */}
          {selectedFood && activeTab !== 'custom' && (
            <div className={styles.selectedFood}>
              <strong>{selectedFood.name}</strong>
              <div className={styles.foodMacros}>
                {selectedFood.serving_size} {selectedFood.serving_unit}: {selectedFood.calories} kcal, 
                P: {selectedFood.protein}g, F: {selectedFood.fat}g, C: {selectedFood.carbs}g
              </div>
              {selectedFood.isBrandFood && (
                <div className={styles.brandNote}>This food will be saved to your foods</div>
              )}
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.inputGroup}>
              <label>Servings</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label>Time</label>
              <input
                type="time"
                value={loggedTime}
                onChange={(e) => setLoggedTime(e.target.value)}
                className={styles.timeInput}
              />
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label>Meal Type (optional)</label>
            <select
              value={mealType}
              onChange={(e) => setMealType(e.target.value)}
              className={styles.select}
            >
              <option value="">None</option>
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snack</option>
            </select>
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Adding...' : 'Add Food'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

