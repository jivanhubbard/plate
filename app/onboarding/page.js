'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './page.module.css'

export default function OnboardingPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
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
    uses_intermittent_fasting: false,
    eating_window_start: '12:00',
    eating_window_end: '20:00',
  })

  useEffect(() => {
    checkUser()
  }, [])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    setUser(user)

    // Check if user already has a complete profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile && profile.weight) {
      // Profile already complete, go to dashboard
      router.push('/dashboard')
      return
    }

    // Pre-fill with existing data if available
    if (profile) {
      setFormData({
        weight: profile.weight || '',
        target_weight: profile.target_weight || '',
        calorie_goal: profile.calorie_goal?.toString() || '2200',
        calorie_goal_type: profile.calorie_goal_type || 'limit',
        protein_goal: profile.protein_goal?.toString() || '200',
        protein_goal_type: profile.protein_goal_type || 'target',
        fat_goal: profile.fat_goal?.toString() || '80',
        fat_goal_type: profile.fat_goal_type || 'target',
        carb_goal: profile.carb_goal?.toString() || '200',
        carb_goal_type: profile.carb_goal_type || 'target',
        uses_intermittent_fasting: profile.uses_intermittent_fasting || false,
        eating_window_start: profile.eating_window_start?.slice(0, 5) || '12:00',
        eating_window_end: profile.eating_window_end?.slice(0, 5) || '20:00',
      })
    }

    setLoading(false)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const updateData = {
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
        uses_intermittent_fasting: formData.uses_intermittent_fasting,
        onboarding_complete: true,
      }
      
      // Only include eating window times if IF is enabled
      if (formData.uses_intermittent_fasting) {
        updateData.eating_window_start = formData.eating_window_start + ':00'
        updateData.eating_window_end = formData.eating_window_end + ':00'
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id)

      if (updateError) throw updateError

      router.push('/dashboard')
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSkip = () => {
    router.push('/dashboard')
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Set Up Your Profile</h1>
        <p className={styles.subtitle}>
          Customize your daily macro goals to track your nutrition effectively.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Body Stats</h2>
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
            <h2 className={styles.sectionTitle}>Daily Macro Goals</h2>
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
                  <option value="limit">Limit (stay under)</option>
                  <option value="target">Target (hit this)</option>
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
                  <option value="limit">Limit (stay under)</option>
                  <option value="target">Target (hit this)</option>
                </select>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Intermittent Fasting</h2>
            <div className={styles.toggleRow}>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={formData.uses_intermittent_fasting}
                  onChange={(e) => setFormData({ ...formData, uses_intermittent_fasting: e.target.checked })}
                />
                <span className={styles.toggleSlider}></span>
              </label>
              <span className={styles.toggleLabel}>
                Enable eating window tracking
              </span>
            </div>
            {formData.uses_intermittent_fasting && (
              <div className={styles.row}>
                <div className={styles.inputGroup}>
                  <label htmlFor="eating_window_start">Window Opens</label>
                  <input
                    id="eating_window_start"
                    name="eating_window_start"
                    type="time"
                    value={formData.eating_window_start}
                    onChange={handleChange}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label htmlFor="eating_window_end">Window Closes</label>
                  <input
                    id="eating_window_end"
                    name="eating_window_end"
                    type="time"
                    value={formData.eating_window_end}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleSkip}
              className={styles.skipButton}
            >
              Skip for Now
            </button>
            <button
              type="submit"
              disabled={saving}
              className={styles.submitButton}
            >
              {saving ? 'Saving...' : 'Save & Continue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
