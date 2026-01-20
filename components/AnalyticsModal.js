'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  calculateBMR,
  calculateTDEE,
  calculateAge,
  projectWeightLoss,
  estimateKetosis,
  calculateFastingHours,
  calculateMacroAverages,
} from '@/lib/analytics'
import styles from './AnalyticsModal.module.css'

// Tooltip component
function Tooltip({ text, children }) {
  return (
    <span className={styles.tooltipWrapper}>
      {children}
      <span className={styles.tooltip}>{text}</span>
    </span>
  )
}

// Helper to get local date string
function getLocalDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function AnalyticsModal({ userId, userProfile, onClose }) {
  const [loading, setLoading] = useState(true)
  const [weightHistory, setWeightHistory] = useState([])
  const [macroHistory, setMacroHistory] = useState([])
  const [todayLogs, setTodayLogs] = useState([])
  const [lastMeal, setLastMeal] = useState(null)

  useEffect(() => {
    if (userId) {
      loadData()
    }
  }, [userId])

  async function loadData() {
    try {
      // Load weight history (last 90 days)
      const { data: weights } = await supabase
        .from('weight_log')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .limit(90)
      
      setWeightHistory(weights || [])

      // Load macro history (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const { data: logs } = await supabase
        .from('food_log')
        .select('date, calories, protein, fat, carbs')
        .eq('user_id', userId)
        .gte('date', getLocalDateString(thirtyDaysAgo))
        .order('date', { ascending: true })

      // Group by date
      const dailyTotals = {}
      ;(logs || []).forEach(log => {
        if (!dailyTotals[log.date]) {
          dailyTotals[log.date] = { date: log.date, calories: 0, protein: 0, fat: 0, carbs: 0 }
        }
        dailyTotals[log.date].calories += parseFloat(log.calories) || 0
        dailyTotals[log.date].protein += parseFloat(log.protein) || 0
        dailyTotals[log.date].fat += parseFloat(log.fat) || 0
        dailyTotals[log.date].carbs += parseFloat(log.carbs) || 0
      })
      
      setMacroHistory(Object.values(dailyTotals))

      // Load today's logs for ketosis calculation (use LOCAL date!)
      const today = getLocalDateString()
      const { data: todayData, error: todayError } = await supabase
        .from('food_log')
        .select('logged_at, calories, carbs')
        .eq('user_id', userId)
        .eq('date', today)

      if (todayError) {
        console.error('Error loading today logs:', todayError)
      }
      
      setTodayLogs(todayData || [])

      // Load most recent food log with a timestamp (for fasting calculation)
      // Exclude items under 10 kcal (like black coffee) that don't break fast
      const { data: lastMealData, error: lastMealError } = await supabase
        .from('food_log')
        .select('date, logged_at, calories')
        .eq('user_id', userId)
        .not('logged_at', 'is', null)
        .gte('calories', 10)
        .order('date', { ascending: false })
        .order('logged_at', { ascending: false })
        .limit(1)
        .single()

      if (lastMealError && lastMealError.code !== 'PGRST116') {
        console.error('Error loading last meal:', lastMealError)
      }
      
      setLastMeal(lastMealData || null)

    } catch (error) {
      console.error('Error loading analytics data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate analytics
  const age = calculateAge(userProfile?.date_of_birth)
  const bmr = calculateBMR(
    userProfile?.weight,
    userProfile?.height_inches,
    age,
    userProfile?.gender
  )
  const tdee = calculateTDEE(bmr, userProfile?.activity_level)
  
  const projection = projectWeightLoss(
    userProfile?.weight,
    userProfile?.target_weight,
    tdee,
    userProfile?.calorie_goal
  )

  const macroAverages = calculateMacroAverages(macroHistory)
  
  const fastingHours = calculateFastingHours(lastMeal?.date, lastMeal?.logged_at)
  const todayCarbs = todayLogs.reduce((sum, log) => sum + (parseFloat(log.carbs) || 0), 0)
  const ketosis = estimateKetosis(
    todayCarbs,
    userProfile?.uses_intermittent_fasting,
    fastingHours
  )

  // Weight change calculation
  const weightChange = weightHistory.length >= 2
    ? weightHistory[weightHistory.length - 1].weight - weightHistory[0].weight
    : null

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Analytics</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>Loading analytics...</div>
          ) : (
            <>
              {/* Metabolic Stats */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Tooltip text="How many calories your body uses daily">
                    Metabolic Profile ⓘ
                  </Tooltip>
                </h3>
                <div className={styles.statsGrid}>
                  <Tooltip text="Calories burned at rest">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>BMR</span>
                      <span className={styles.statValue}>{bmr || '—'}</span>
                      <span className={styles.statHint}>at rest</span>
                    </div>
                  </Tooltip>
                  <Tooltip text="BMR + activity = total daily burn">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>TDEE</span>
                      <span className={styles.statValue}>{tdee || '—'}</span>
                      <span className={styles.statHint}>daily burn</span>
                    </div>
                  </Tooltip>
                  <Tooltip text="TDEE minus calorie goal">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Deficit</span>
                      <span className={styles.statValue}>{projection?.dailyDeficit || '—'}</span>
                      <span className={styles.statHint}>cal/day</span>
                    </div>
                  </Tooltip>
                  <Tooltip text="500 cal/day deficit ≈ 1 lb/week">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Rate</span>
                      <span className={styles.statValue}>{projection?.lbsPerWeek || '—'}</span>
                      <span className={styles.statHint}>lbs/week</span>
                    </div>
                  </Tooltip>
                </div>

                {!bmr && (
                  <p className={styles.setupHint}>
                    👆 Add height, birthdate & activity in Goals
                  </p>
                )}
              </section>

              {/* Weight Projection */}
              {projection && !projection.alreadyAtGoal && !projection.noDeficit && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <Tooltip text="Based on consistent eating at your goal">
                      Weight Projection ⓘ
                    </Tooltip>
                  </h3>
                  <div className={styles.projectionCard}>
                    <div className={styles.projectionRow}>
                      <span className={styles.projectionLabel}>Current</span>
                      <span className={styles.projectionValue}>{userProfile?.weight} lbs</span>
                    </div>
                    <div className={styles.projectionArrow}>↓</div>
                    <div className={styles.projectionRow}>
                      <span className={styles.projectionLabel}>Goal</span>
                      <span className={styles.projectionValue}>{userProfile?.target_weight} lbs</span>
                    </div>
                    <div className={styles.projectionTime}>
                      ~{projection.weeksToGoal} weeks to goal
                    </div>
                    <p className={styles.projectionNote}>
                      At {projection.lbsPerWeek} lbs/week with a {projection.dailyDeficit} cal/day deficit
                    </p>
                  </div>

                  {/* Mini Chart */}
                  <div className={styles.miniChart}>
                    {projection.projections.slice(0, 8).map((point, i) => {
                      const range = userProfile.weight - userProfile.target_weight
                      const progress = (userProfile.weight - point.weight) / range
                      const height = Math.max(15, 100 - progress * 100)
                      return (
                        <div key={i} className={styles.chartBar}>
                          <div 
                            className={styles.chartBarFill} 
                            style={{ height: `${height}%` }}
                            title={`Week ${point.week}: ${Math.round(point.weight)} lbs`}
                          />
                          <span className={styles.chartLabel}>W{point.week}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {projection?.alreadyAtGoal && (
                <div className={styles.successBanner}>
                  🎉 You've reached your goal weight!
                </div>
              )}

              {projection?.noDeficit && (
                <div className={styles.warningBanner}>
                  <strong>Heads up:</strong> Calorie goal ≥ TDEE. Lower it by 300-500 to lose weight.
                </div>
              )}

              {/* Weight History */}
              {weightHistory.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <Tooltip text="Log weight in Goals regularly">
                      Weight History ⓘ
                    </Tooltip>
                  </h3>
                  <div className={styles.miniChart}>
                    {weightHistory.slice(-8).map((entry, i) => {
                      const minWeight = Math.min(...weightHistory.map(w => parseFloat(w.weight)))
                      const maxWeight = Math.max(...weightHistory.map(w => parseFloat(w.weight)))
                      const range = maxWeight - minWeight || 1
                      const height = ((parseFloat(entry.weight) - minWeight) / range) * 70 + 30
                      return (
                        <div key={i} className={styles.chartBar}>
                          <div 
                            className={styles.chartBarFillGreen} 
                            style={{ height: `${height}%` }}
                            title={`${entry.date}: ${entry.weight} lbs`}
                          />
                          <span className={styles.chartLabel}>{Math.round(entry.weight)}</span>
                        </div>
                      )
                    })}
                  </div>
                  {weightChange !== null && (
                    <div className={styles.weightChange}>
                      {weightChange < 0 ? (
                        <span className={styles.positive}>↓ {Math.abs(weightChange).toFixed(1)} lbs lost</span>
                      ) : weightChange > 0 ? (
                        <span className={styles.negative}>↑ {weightChange.toFixed(1)} lbs gained</span>
                      ) : (
                        <span>Weight stable</span>
                      )}
                      <span className={styles.weightPeriod}> over {weightHistory.length} entries</span>
                    </div>
                  )}
                </section>
              )}

              {/* Ketosis (if IF enabled) */}
              {userProfile?.uses_intermittent_fasting && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>
                    <Tooltip text="Ketosis after 12-16h fast + low carbs">
                      Fasting & Ketosis ⓘ
                    </Tooltip>
                  </h3>
                  <div className={styles.statsGrid}>
                    <Tooltip text="12+ hours = fat burning mode">
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>Fast</span>
                        <span className={styles.statValue}>{fastingHours ? `${fastingHours}h` : '—'}</span>
                        <span className={styles.statHint}>since eating</span>
                      </div>
                    </Tooltip>
                    <Tooltip text="Under 50g helps ketosis">
                      <div className={styles.statCard}>
                        <span className={styles.statLabel}>Carbs</span>
                        <span className={styles.statValue}>{Math.round(todayCarbs)}g</span>
                        <span className={styles.statHint}>today</span>
                      </div>
                    </Tooltip>
                    <Tooltip text={ketosis.message}>
                      <div className={`${styles.statCard} ${styles[`ketosis_${ketosis.status}`]}`}>
                        <span className={styles.statLabel}>Ketosis</span>
                        <span className={styles.statValue}>
                          {ketosis.status === 'likely' ? '🔥' : 
                           ketosis.status === 'possible' ? '⚡' : '—'}
                        </span>
                        <span className={styles.statHint}>
                          {ketosis.status === 'likely' ? 'Active' : 
                           ketosis.status === 'possible' ? 'Maybe' : 'Not yet'}
                        </span>
                      </div>
                    </Tooltip>
                  </div>
                  <p className={styles.ketosisExplainer}>
                    {ketosis.message}
                  </p>
                </section>
              )}

              {/* 30-Day Averages */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  <Tooltip text="Compare to your goals">
                    30-Day Averages ⓘ
                  </Tooltip>
                </h3>
                <div className={styles.statsGrid}>
                  <Tooltip text={`Goal: ${userProfile?.calorie_goal || '—'}`}>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Calories</span>
                      <span className={styles.statValue}>{macroAverages.calories}</span>
                      <span className={styles.statHint}>avg/day</span>
                    </div>
                  </Tooltip>
                  <Tooltip text="0.7-1g per lb of body weight">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Protein</span>
                      <span className={styles.statValue}>{macroAverages.protein}g</span>
                      <span className={styles.statHint}>avg/day</span>
                    </div>
                  </Tooltip>
                  <Tooltip text="20-35% of total calories">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Fat</span>
                      <span className={styles.statValue}>{macroAverages.fat}g</span>
                      <span className={styles.statHint}>avg/day</span>
                    </div>
                  </Tooltip>
                  <Tooltip text="Lower = better for fat loss">
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Carbs</span>
                      <span className={styles.statValue}>{macroAverages.carbs}g</span>
                      <span className={styles.statHint}>avg/day</span>
                    </div>
                  </Tooltip>
                </div>
                {macroAverages.days > 0 ? (
                  <p className={styles.daysNote}>Based on {macroAverages.days} days of logged data</p>
                ) : (
                  <p className={styles.daysNote}>Start logging food to see your averages!</p>
                )}
              </section>

              {/* Tips Section */}
              <section className={styles.tipsSection}>
                <h3 className={styles.sectionTitle}>Quick Tips</h3>
                <ul className={styles.tipsList}>
                  <li>Log weight weekly in Goals to track progress</li>
                  <li>500 cal deficit = ~1 lb/week weight loss</li>
                  <li>Protein keeps you full and preserves muscle</li>
                  {userProfile?.uses_intermittent_fasting && (
                    <li>16+ hours fasting = optimal fat burning</li>
                  )}
                </ul>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
