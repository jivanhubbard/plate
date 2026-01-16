'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './FoodLog.module.css'

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', null]
const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  null: 'Other',
}

// Helper to format time for display
function formatTimeDisplay(timeStr) {
  if (!timeStr) return null
  const [hour, min] = timeStr.split(':').map(Number)
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(min).padStart(2, '0')} ${period}`
}

// Check if a time is within the eating window
function isWithinEatingWindow(loggedAt, windowStart, windowEnd) {
  if (!loggedAt || !windowStart || !windowEnd) return null
  
  const [logHour, logMin] = loggedAt.split(':').map(Number)
  const [startHour, startMin] = windowStart.split(':').map(Number)
  const [endHour, endMin] = windowEnd.split(':').map(Number)
  
  const logMinutes = logHour * 60 + logMin
  const startMinutes = startHour * 60 + startMin
  const endMinutes = endHour * 60 + endMin
  
  return logMinutes >= startMinutes && logMinutes < endMinutes
}

export default function FoodLog({ logs, onDelete, onUpdate, eatingWindow }) {
  const [deletingId, setDeletingId] = useState(null)
  const [editingLog, setEditingLog] = useState(null)
  const [editForm, setEditForm] = useState({
    date: '',
    servings: '',
    meal_type: '',
  })
  const [saving, setSaving] = useState(false)

  // Group logs by meal type
  const groupedLogs = MEAL_ORDER.reduce((acc, mealType) => {
    const key = mealType === null ? 'null' : mealType
    const filtered = logs.filter((log) => {
      if (mealType === null) {
        return !log.meal_type || !MEAL_ORDER.slice(0, -1).includes(log.meal_type)
      }
      return log.meal_type === mealType
    })
    if (filtered.length > 0) {
      acc[key] = filtered
    }
    return acc
  }, {})

  const handleDelete = async (logId) => {
    if (!confirm('Are you sure you want to delete this entry?')) return

    setDeletingId(logId)
    try {
      const { error } = await supabase
        .from('food_log')
        .delete()
        .eq('id', logId)

      if (error) throw error
      onDelete()
    } catch (error) {
      console.error('Error deleting food log:', error)
      alert('Failed to delete entry')
    } finally {
      setDeletingId(null)
    }
  }

  const openEditModal = (log) => {
    setEditingLog(log)
    setEditForm({
      date: log.date,
      servings: log.servings.toString(),
      meal_type: log.meal_type || '',
    })
  }

  const closeEditModal = () => {
    setEditingLog(null)
    setEditForm({ date: '', servings: '', meal_type: '' })
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const food = editingLog.foods
      const servingsNum = parseFloat(editForm.servings) || 1

      // Recalculate macros based on new servings
      const calories = (parseFloat(food.calories) || 0) * servingsNum
      const protein = (parseFloat(food.protein) || 0) * servingsNum
      const fat = (parseFloat(food.fat) || 0) * servingsNum
      const carbs = (parseFloat(food.carbs) || 0) * servingsNum

      const { error } = await supabase
        .from('food_log')
        .update({
          date: editForm.date,
          servings: servingsNum,
          meal_type: editForm.meal_type || null,
          calories,
          protein,
          fat,
          carbs,
        })
        .eq('id', editingLog.id)

      if (error) throw error

      closeEditModal()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error updating food log:', error)
      alert('Failed to update entry')
    } finally {
      setSaving(false)
    }
  }

  if (logs.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No food entries for this date.</p>
        <p className={styles.emptySubtext}>Click "Add Food" to get started!</p>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Food Log</h2>
      
      <div className={styles.mealGroups}>
        {Object.entries(groupedLogs).map(([mealType, mealLogs]) => (
          <div 
            key={mealType} 
            className={`${styles.mealGroup} ${styles[`meal_${mealType}`]}`}
          >
            <div className={styles.mealHeader}>
              <span className={styles.mealLabel}>
                {MEAL_LABELS[mealType]}
                <span className={styles.mealCount}>({mealLogs.length})</span>
              </span>
            </div>
            <div className={styles.mealContent}>
              {mealLogs.map((log) => {
                const withinWindow = eatingWindow?.enabled 
                  ? isWithinEatingWindow(log.logged_at, eatingWindow.start, eatingWindow.end)
                  : null
                
                return (
                <div key={log.id} className={styles.logItem}>
                  <div className={styles.logInfo}>
                    <div className={styles.foodNameRow}>
                      <span className={styles.foodName}>
                        {log.foods?.name || 'Unknown Food'}
                      </span>
                      {log.logged_at && (
                        <span className={`${styles.timeStamp} ${withinWindow === false ? styles.outsideWindow : ''}`}>
                          {formatTimeDisplay(log.logged_at)}
                          {withinWindow === false && (
                            <span className={styles.outsideIndicator} title="Outside eating window">⚠</span>
                          )}
                        </span>
                      )}
                    </div>
                    <div className={styles.servingInfo}>
                      {log.servings}x {log.foods?.serving_size || ''} {log.foods?.serving_unit || ''}
                    </div>
                    <div className={styles.macroInfo}>
                      <span>{Math.round(log.calories)} kcal</span>
                      <span>P: {Math.round(log.protein)}g</span>
                      <span>F: {Math.round(log.fat)}g</span>
                      <span>C: {Math.round(log.carbs)}g</span>
                    </div>
                  </div>
                  <div className={styles.actions}>
                    <button
                      onClick={() => openEditModal(log)}
                      className={styles.editButton}
                      title="Edit entry"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                        <path d="m15 5 4 4"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(log.id)}
                      disabled={deletingId === log.id}
                      className={styles.deleteButton}
                      title="Delete entry"
                    >
                      {deletingId === log.id ? '...' : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18"></path>
                          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h3>Edit Entry</h3>
              <button onClick={closeEditModal} className={styles.closeButton} aria-label="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className={styles.editForm}>
              <div className={styles.foodPreview}>
                <strong>{editingLog.foods?.name}</strong>
                <span>
                  {editingLog.foods?.serving_size} {editingLog.foods?.serving_unit} = {editingLog.foods?.calories} kcal
                </span>
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="edit-date">Date</label>
                <input
                  id="edit-date"
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="edit-servings">Servings</label>
                <input
                  id="edit-servings"
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={editForm.servings}
                  onChange={(e) => setEditForm({ ...editForm, servings: e.target.value })}
                  required
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="edit-meal">Meal Type</label>
                <select
                  id="edit-meal"
                  value={editForm.meal_type}
                  onChange={(e) => setEditForm({ ...editForm, meal_type: e.target.value })}
                >
                  <option value="">None</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>

              {editForm.servings && (
                <div className={styles.macroPreview}>
                  <span>New totals:</span>
                  <strong>
                    {Math.round((parseFloat(editingLog.foods?.calories) || 0) * parseFloat(editForm.servings))} kcal,{' '}
                    {Math.round((parseFloat(editingLog.foods?.protein) || 0) * parseFloat(editForm.servings))}g P,{' '}
                    {Math.round((parseFloat(editingLog.foods?.fat) || 0) * parseFloat(editForm.servings))}g F,{' '}
                    {Math.round((parseFloat(editingLog.foods?.carbs) || 0) * parseFloat(editForm.servings))}g C
                  </strong>
                </div>
              )}

              <div className={styles.modalActions}>
                <button type="button" onClick={closeEditModal} className={styles.cancelButton}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={styles.saveButton}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
