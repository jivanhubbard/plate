'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { calculateFastingHours, estimateKetosis } from '@/lib/analytics'
import styles from './FastingStatus.module.css'

export default function FastingStatus({ userId, userProfile }) {
  const [fastingHours, setFastingHours] = useState(null)
  const [todayCarbs, setTodayCarbs] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId) {
      loadFastingData()
      // Update every minute for live timer
      const interval = setInterval(loadFastingData, 60000)
      return () => clearInterval(interval)
    }
  }, [userId])

  async function loadFastingData() {
    try {
      // Get most recent meal with timestamp (exclude items under 10 kcal like black coffee)
      const { data: lastMeal, error: lastMealError } = await supabase
        .from('food_log')
        .select('date, logged_at, calories')
        .eq('user_id', userId)
        .not('logged_at', 'is', null)
        .gte('calories', 10) // Exclude drinks/items under 10 kcal that don't break fast
        .order('date', { ascending: false })
        .order('logged_at', { ascending: false })
        .limit(1)
        .single()

      if (lastMealError && lastMealError.code !== 'PGRST116') {
        console.error('Error loading last meal:', lastMealError)
      }

      const hours = calculateFastingHours(lastMeal?.date, lastMeal?.logged_at)
      setFastingHours(hours)

      // Get today's carbs for ketosis estimate
      const now = new Date()
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
      
      const { data: todayLogs } = await supabase
        .from('food_log')
        .select('carbs')
        .eq('user_id', userId)
        .eq('date', today)

      const carbs = (todayLogs || []).reduce((sum, log) => sum + (parseFloat(log.carbs) || 0), 0)
      setTodayCarbs(carbs)

    } catch (error) {
      console.error('Error loading fasting data:', error)
    } finally {
      setLoading(false)
    }
  }

  const ketosis = estimateKetosis(
    todayCarbs,
    userProfile?.uses_intermittent_fasting,
    fastingHours || 0
  )

  // Progress towards 16-hour fasting goal
  const fastingGoal = 16
  const progressPercent = fastingHours ? Math.min((fastingHours / fastingGoal) * 100, 100) : 0

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading fasting status...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Fasting Timer */}
      <div className={styles.fastingSection}>
        <div className={styles.timerCircle}>
          <svg viewBox="0 0 36 36" className={styles.circleProgress}>
            <path
              className={styles.circleBackground}
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className={styles.circleFill}
              strokeDasharray={`${progressPercent}, 100`}
              d="M18 2.0845
                a 15.9155 15.9155 0 0 1 0 31.831
                a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <div className={styles.timerValue}>
            {fastingHours !== null ? (
              <>
                <span className={styles.hours}>{Math.floor(fastingHours)}</span>
                <span className={styles.unit}>h</span>
                <span className={styles.minutes}>{Math.round((fastingHours % 1) * 60)}</span>
                <span className={styles.unit}>m</span>
              </>
            ) : (
              <span className={styles.noData}>—</span>
            )}
          </div>
        </div>
        <div className={styles.fastingLabel}>
          <span className={styles.labelTitle}>Fasting</span>
          <span className={styles.labelHint}>
            {fastingHours !== null 
              ? fastingHours >= 16 
                ? '16h goal reached! 🎉' 
                : fastingHours >= 12
                  ? 'Fat burning zone 🔥'
                  : `${Math.max(0, 16 - fastingHours).toFixed(0)}h until 16h goal`
              : 'No meal data'}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider} />

      {/* Ketosis Status */}
      <div className={styles.ketosisSection}>
        <div className={`${styles.ketosisIcon} ${styles[`ketosis_${ketosis.status}`]}`}>
          {ketosis.status === 'likely' && '🔥'}
          {ketosis.status === 'possible' && '⚡'}
          {ketosis.status === 'unlikely' && '○'}
          {ketosis.status === 'none' && '—'}
          {ketosis.status === 'unknown' && '?'}
        </div>
        <div className={styles.ketosisInfo}>
          <span className={styles.ketosisStatus}>
            {ketosis.status === 'likely' && 'Ketosis Active'}
            {ketosis.status === 'possible' && 'Ketosis Possible'}
            {ketosis.status === 'unlikely' && 'Unlikely'}
            {ketosis.status === 'none' && 'Not in Ketosis'}
            {ketosis.status === 'unknown' && 'Track carbs'}
          </span>
          <span className={styles.ketosisDetail}>
            {Math.round(todayCarbs)}g carbs today
          </span>
        </div>
      </div>
    </div>
  )
}

