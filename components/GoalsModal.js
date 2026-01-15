'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './GoalsModal.module.css'

export default function GoalsModal({ userProfile, userId, onClose, onSave }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const [formData, setFormData] = useState({
    weight: '',
    target_weight: '',
    calorie_goal: '2200',
    calorie_goal_type: 'limit',
    protein_goal: '200',
    protein_goal_type: 'target',
    fat_goal: '80',
    fat_goal_type: 'target',
    carb_goal: '200',
    carb_goal_type: 'target',
    eating_window_start: '12:00',
    eating_window_end: '20:00',
  })

  useEffect(() => {
    if (userProfile) {
      setFormData({
        weight: userProfile.weight || '',
        target_weight: userProfile.target_weight || '',
        calorie_goal: userProfile.calorie_goal?.toString() || '2200',
        calorie_goal_type: userProfile.calorie_goal_type || 'limit',
        protein_goal: userProfile.protein_goal?.toString() || '200',
        protein_goal_type: userProfile.protein_goal_type || 'target',
        fat_goal: userProfile.fat_goal?.toString() || '80',
        fat_goal_type: userProfile.fat_goal_type || 'target',
        carb_goal: userProfile.carb_goal?.toString() || '200',
        carb_goal_type: userProfile.carb_goal_type || 'target',
        eating_window_start: userProfile.eating_window_start?.slice(0, 5) || '12:00',
        eating_window_end: userProfile.eating_window_end?.slice(0, 5) || '20:00',
      })
    }
  }, [userProfile])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({
          weight: parseFloat(formData.weight) || null,
          target_weight: parseFloat(formData.target_weight) || null,
          calorie_goal: parseInt(formData.calorie_goal) || 2200,
          calorie_goal_type: formData.calorie_goal_type,
          protein_goal: parseInt(formData.protein_goal) || 200,
          protein_goal_type: formData.protein_goal_type,
          fat_goal: parseInt(formData.fat_goal) || 80,
          fat_goal_type: formData.fat_goal_type,
          carb_goal: parseInt(formData.carb_goal) || 200,
          carb_goal_type: formData.carb_goal_type,
          eating_window_start: formData.eating_window_start + ':00',
          eating_window_end: formData.eating_window_end + ':00',
        })
        .eq('id', userId)

      if (updateError) throw updateError

      if (onSave) onSave()
      onClose()
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Goals & Settings</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <p className={styles.subtitle}>
            Customize your daily macro goals and preferences.
          </p>

          {error && <div className={styles.error}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Body Stats</h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label htmlFor="weight">Current Weight (lbs)</label>
                  <input
                    id="weight"
                    name="weight"
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={handleChange}
                    placeholder="e.g., 230"
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="target_weight">Goal Weight (lbs)</label>
                  <input
                    id="target_weight"
                    name="target_weight"
                    type="number"
                    step="0.1"
                    value={formData.target_weight}
                    onChange={handleChange}
                    placeholder="e.g., 180"
                  />
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Daily Macro Goals</h3>
              <p className={styles.sectionHint}>
                Choose "Target" for goals you want to hit, or "Limit" for goals you want to stay under.
              </p>
              
              {/* Calories */}
              <div className={styles.macroRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="calorie_goal">Calories</label>
                  <input
                    id="calorie_goal"
                    name="calorie_goal"
                    type="number"
                    value={formData.calorie_goal}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="calorie_goal_type">Type</label>
                  <select
                    id="calorie_goal_type"
                    name="calorie_goal_type"
                    value={formData.calorie_goal_type}
                    onChange={handleChange}
                  >
                    <option value="limit">Limit (stay under)</option>
                    <option value="target">Target (hit this)</option>
                  </select>
                </div>
              </div>

              {/* Protein */}
              <div className={styles.macroRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="protein_goal">Protein (g)</label>
                  <input
                    id="protein_goal"
                    name="protein_goal"
                    type="number"
                    value={formData.protein_goal}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="protein_goal_type">Type</label>
                  <select
                    id="protein_goal_type"
                    name="protein_goal_type"
                    value={formData.protein_goal_type}
                    onChange={handleChange}
                  >
                    <option value="target">Target (hit this)</option>
                    <option value="limit">Limit (stay under)</option>
                  </select>
                </div>
              </div>

              {/* Fat */}
              <div className={styles.macroRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="fat_goal">Fat (g)</label>
                  <input
                    id="fat_goal"
                    name="fat_goal"
                    type="number"
                    value={formData.fat_goal}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="fat_goal_type">Type</label>
                  <select
                    id="fat_goal_type"
                    name="fat_goal_type"
                    value={formData.fat_goal_type}
                    onChange={handleChange}
                  >
                    <option value="target">Target (hit this)</option>
                    <option value="limit">Limit (stay under)</option>
                  </select>
                </div>
              </div>

              {/* Carbs */}
              <div className={styles.macroRow}>
                <div className={styles.inputGroup}>
                  <label htmlFor="carb_goal">Carbs (g)</label>
                  <input
                    id="carb_goal"
                    name="carb_goal"
                    type="number"
                    value={formData.carb_goal}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="carb_goal_type">Type</label>
                  <select
                    id="carb_goal_type"
                    name="carb_goal_type"
                    value={formData.carb_goal_type}
                    onChange={handleChange}
                  >
                    <option value="target">Target (hit this)</option>
                    <option value="limit">Limit (stay under)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Eating Window (Intermittent Fasting)</h3>
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label htmlFor="eating_window_start">Start Time</label>
                  <input
                    id="eating_window_start"
                    name="eating_window_start"
                    type="time"
                    value={formData.eating_window_start}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="eating_window_end">End Time</label>
                  <input
                    id="eating_window_end"
                    name="eating_window_end"
                    type="time"
                    value={formData.eating_window_end}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={styles.submitButton}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

