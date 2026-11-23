'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { searchCatalogFoods } from '@/lib/brandedFoodCatalog'
import { searchProducts } from '@/lib/openFoodFacts'
import { searchBrandedFoods } from '@/lib/usdaFoodData'
import styles from './AddFoodModal.module.css'

// Helper to auto-select meal type based on time
function getMealTypeFromTime(timeStr) {
  if (!timeStr) return ''
  const [hour, min] = timeStr.split(':').map(Number)
  const totalMinutes = hour * 60 + min
  
  // 9:00 AM - 10:59 AM = breakfast
  if (totalMinutes >= 540 && totalMinutes < 660) return 'breakfast'
  // 11:00 AM - 1:59 PM = lunch
  if (totalMinutes >= 660 && totalMinutes < 840) return 'lunch'
  // 2:00 PM - 4:59 PM = snack
  if (totalMinutes >= 840 && totalMinutes < 1020) return 'snack'
  // 5:00 PM - 8:00 PM = dinner
  if (totalMinutes >= 1020 && totalMinutes < 1200) return 'dinner'
  // Outside these times = no auto-select
  return ''
}

export default function AddFoodModal({ foods, selectedDate, userId, onClose, onFoodAdded }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [pendingItems, setPendingItems] = useState([])
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
  const [mealTypeManuallySet, setMealTypeManuallySet] = useState(false)
  const [activeTab, setActiveTab] = useState('my-foods') // 'my-foods', 'brand-search', 'custom'
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Brand search state
  const [brandSearchTerm, setBrandSearchTerm] = useState('')
  const [brandResults, setBrandResults] = useState([])
  const [brandSearching, setBrandSearching] = useState(false)
  const [brandSearchCount, setBrandSearchCount] = useState(0)
  const [brandSearchSource, setBrandSearchSource] = useState('catalog')

  // Custom food form state
  const [customFood, setCustomFood] = useState({
    name: '',
    serving_size: '1',
    serving_unit: 'serving',
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
    fiber: '',
  })

  // Filter and deduplicate foods by name (keep first occurrence)
  const filteredFoods = foods
    .filter((food) => food.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((food, index, self) => 
      index === self.findIndex((f) => f.name.toLowerCase() === food.name.toLowerCase())
    )

  useEffect(() => {
    if (!mealTypeManuallySet) {
      setMealType(getMealTypeFromTime(loggedTime))
    }
  }, [loggedTime, mealTypeManuallySet])

  // Search our local catalog first. Third-party APIs are only a miss fallback.
  useEffect(() => {
    if (activeTab !== 'brand-search' || brandSearchTerm.length < 2) {
      setBrandResults([])
      setBrandSearchCount(0)
      setBrandSearchSource('catalog')
      return
    }

    let cancelled = false
    setBrandSearching(true)

    const timeoutId = setTimeout(async () => {
      try {
        const catalogResult = await searchCatalogFoods(brandSearchTerm, 20)
        if (cancelled) return

        if (catalogResult.products.length > 0) {
          setBrandResults(catalogResult.products)
          setBrandSearchCount(catalogResult.count)
          setBrandSearchSource('catalog')
          return
        }

        // Until the catalog is fully populated, preserve coverage on misses.
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
        setBrandSearchSource('live')
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

  const getItemKey = (food, source) => {
    if (source === 'saved') return `saved-${food.id}`
    if (source === 'brand') return `brand-${food.fdcId || food.id || food.name}`
    return `custom-${Date.now()}-${Math.random()}`
  }

  const addPendingItem = (food, source) => {
    const itemKey = getItemKey(food, source)

    setPendingItems((items) => {
      const existingIndex = items.findIndex((item) => item.key === itemKey)
      if (existingIndex === -1) {
        return [...items, { key: itemKey, food, source, servings: '1' }]
      }

      return items.map((item, index) =>
        index === existingIndex
          ? { ...item, servings: String((parseFloat(item.servings) || 0) + 1) }
          : item
      )
    })
    setError(null)
  }

  const handleSelectFood = (food) => {
    addPendingItem(food, 'saved')
    setSearchTerm('')
    setBrandSearchTerm('')
  }

  const handleSelectBrandFood = (food) => {
    addPendingItem(food, 'brand')
    setBrandSearchTerm('')
  }

  const handleAddCustomFood = () => {
    if (!customFood.name.trim() || !customFood.serving_size || !customFood.serving_unit.trim() || customFood.calories === '') {
      setError('Enter a name, serving size, unit, and calories for the custom food')
      return
    }

    addPendingItem({ ...customFood, name: customFood.name.trim() }, 'custom')
    setCustomFood({
      name: '',
      serving_size: '1',
      serving_unit: 'serving',
      calories: '',
      protein: '',
      fat: '',
      carbs: '',
      fiber: '',
    })
  }

  const updatePendingServings = (key, value) => {
    setPendingItems((items) =>
      items.map((item) => item.key === key ? { ...item, servings: value } : item)
    )
  }

  const removePendingItem = (key) => {
    setPendingItems((items) => items.filter((item) => item.key !== key))
  }

  const resolveFoodId = async (item) => {
    if (item.source === 'saved') return item.food.id

    if (item.source === 'brand') {
      const { data: existingFood, error: lookupError } = await supabase
        .from('foods')
        .select('id')
        .eq('user_id', userId)
        .eq('name', item.food.name)
        .maybeSingle()

      if (lookupError) throw lookupError
      if (existingFood) return existingFood.id
    }

    const food = item.food
    const { data: newFood, error: foodError } = await supabase
      .from('foods')
      .insert({
        name: food.name,
        serving_size: food.serving_size,
        serving_unit: food.serving_unit,
        calories: parseFloat(food.calories) || 0,
        protein: parseFloat(food.protein) || 0,
        fat: parseFloat(food.fat) || 0,
        carbs: parseFloat(food.carbs) || 0,
        fiber: parseFloat(food.fiber) || 0,
        is_custom: true,
        user_id: userId,
        usda_fdc_id: item.source === 'brand' ? (food.fdcId || null) : null,
        ...(food.catalogId
          ? {
              branded_food_id: food.catalogId,
              entry_source: 'catalog',
            }
          : {}),
      })
      .select('id')
      .single()

    if (foodError) throw foodError
    return newFood.id
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      if (pendingItems.length === 0) {
        throw new Error('Add at least one food to the list')
      }

      const invalidItem = pendingItems.find((item) => !(parseFloat(item.servings) > 0))
      if (invalidItem) {
        throw new Error(`Enter a valid serving amount for ${invalidItem.food.name}`)
      }

      const foodIds = await Promise.all(pendingItems.map(resolveFoodId))
      const logRows = pendingItems.map((item, index) => {
        const servingsNum = parseFloat(item.servings)
        const food = item.food

        return {
          user_id: userId,
          food_id: foodIds[index],
          date: selectedDate,
          meal_type: mealType || null,
          servings: servingsNum,
          calories: (parseFloat(food.calories) || 0) * servingsNum,
          protein: (parseFloat(food.protein) || 0) * servingsNum,
          fat: (parseFloat(food.fat) || 0) * servingsNum,
          carbs: (parseFloat(food.carbs) || 0) * servingsNum,
          fiber: (parseFloat(food.fiber) || 0) * servingsNum,
          logged_at: loggedTime ? `${loggedTime}:00` : null,
        }
      })

      const { error: logError } = await supabase
        .from('food_log')
        .insert(logRows)

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
          <h2>Add Foods</h2>
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
            type="button"
            onClick={() => setActiveTab('my-foods')}
          >
            My Foods
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'brand-search' ? styles.active : ''}`}
            type="button"
            onClick={() => setActiveTab('brand-search')}
          >
            Brand Search
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'custom' ? styles.active : ''}`}
            type="button"
            onClick={() => setActiveTab('custom')}
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
                        <div className={styles.foodItemContent}>
                          <div className={styles.foodName}>{food.name}</div>
                          <div className={styles.foodDetails}>
                            {food.serving_size} {food.serving_unit} • {food.calories} kcal
                          </div>
                        </div>
                        <span className={styles.addIcon} aria-hidden="true">+</span>
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
                              {food.serving_size}{food.serving_unit} • {food.calories} kcal • P:{food.protein}g F:{food.fat}g C:{food.carbs}g Fb:{food.fiber || 0}g
                            </div>
                          </div>
                          <span className={styles.addIcon} aria-hidden="true">+</span>
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
                {brandSearchSource === 'catalog'
                  ? 'Fast results from the Plate food catalog · '
                  : 'Live fallback · '}
                Data from <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer">USDA FoodData Central</a> & <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener noreferrer">Open Food Facts</a>
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
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label>Unit *</label>
                  <input
                    type="text"
                    value={customFood.serving_unit}
                    onChange={(e) => setCustomFood({ ...customFood, serving_unit: e.target.value })}
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
                <div className={styles.inputGroup}>
                  <label>Fiber (g)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={customFood.fiber}
                    onChange={(e) => setCustomFood({ ...customFood, fiber: e.target.value })}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCustomFood}
                className={styles.addToListButton}
              >
                + Add custom food to list
              </button>
            </div>
          )}

          <div className={styles.batchSection}>
            <div className={styles.batchHeader}>
              <div>
                <h3>Foods to add</h3>
                <p>Select as many foods as you need.</p>
              </div>
              <span className={styles.itemCount}>{pendingItems.length}</span>
            </div>

            {pendingItems.length === 0 ? (
              <div className={styles.emptyBatch}>Your food list is empty.</div>
            ) : (
              <div className={styles.batchList}>
                {pendingItems.map((item) => (
                  <div key={item.key} className={styles.batchItem}>
                    <div className={styles.batchItemInfo}>
                      <strong>{item.food.name}</strong>
                      <span>
                        {Math.round((parseFloat(item.food.calories) || 0) * (parseFloat(item.servings) || 0))} kcal
                      </span>
                    </div>
                    <label className={styles.servingsControl}>
                      <span>Servings</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={item.servings}
                        onChange={(e) => updatePendingServings(item.key, e.target.value)}
                        aria-label={`Servings for ${item.food.name}`}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => removePendingItem(item.key)}
                      className={styles.removeItemButton}
                      aria-label={`Remove ${item.food.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.mealSettings}>
            <div className={styles.inputGroup}>
              <label>Time</label>
              <input
                type="time"
                value={loggedTime}
                onChange={(e) => setLoggedTime(e.target.value)}
                className={styles.timeInput}
              />
            </div>

            <div className={styles.inputGroup}>
              <label>Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => {
                  setMealType(e.target.value)
                  setMealTypeManuallySet(true)
                }}
                className={styles.select}
              >
                <option value="">None</option>
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
              <span className={styles.autoHint}>
                {!mealTypeManuallySet && mealType ? 'Auto-selected from time' : 'You can override this'}
              </span>
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" onClick={onClose} className={styles.cancelButton}>
              Cancel
            </button>
            <button type="submit" disabled={loading || pendingItems.length === 0} className={styles.submitButton}>
              {loading
                ? `Adding ${pendingItems.length} food${pendingItems.length === 1 ? '' : 's'}...`
                : pendingItems.length > 0
                  ? `Add ${pendingItems.length} food${pendingItems.length === 1 ? '' : 's'}`
                  : 'Add foods'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

