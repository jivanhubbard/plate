'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './AddFoodModal.module.css'

export default function AddFoodModal({ foods, selectedDate, userId, onClose, onFoodAdded }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFood, setSelectedFood] = useState(null)
  const [servings, setServings] = useState('1')
  const [mealType, setMealType] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

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

  const filteredFoods = foods.filter((food) =>
    food.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSelectFood = (food) => {
    setSelectedFood(food)
    setSearchTerm('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      let foodId = selectedFood?.id

      // If creating custom food
      if (showCustomForm) {
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
      }

      if (!foodId) {
        throw new Error('Please select or create a food')
      }

      const food = showCustomForm
        ? customFood
        : selectedFood

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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Add Food</h2>
          <button onClick={onClose} className={styles.closeButton}>×</button>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${!showCustomForm ? styles.active : ''}`}
            onClick={() => setShowCustomForm(false)}
          >
            Search Foods
          </button>
          <button
            className={`${styles.tab} ${showCustomForm ? styles.active : ''}`}
            onClick={() => setShowCustomForm(true)}
          >
            Custom Food
          </button>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          {!showCustomForm ? (
            <>
              <div className={styles.inputGroup}>
                <label>Search Foods</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search for a food..."
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
              </div>

              {selectedFood && (
                <div className={styles.selectedFood}>
                  <strong>{selectedFood.name}</strong>
                  <div className={styles.foodMacros}>
                    {selectedFood.serving_size} {selectedFood.serving_unit}: {selectedFood.calories} kcal, 
                    P: {selectedFood.protein}g, F: {selectedFood.fat}g, C: {selectedFood.carbs}g
                  </div>
                </div>
              )}
            </>
          ) : (
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

