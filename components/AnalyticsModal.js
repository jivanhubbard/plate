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

export default function AnalyticsModal({ userId, userProfile, onClose }) {
  const [loading, setLoading] = useState(true)
  const [weightHistory, setWeightHistory] = useState([])
  const [macroHistory, setMacroHistory] = useState([])
  const [todayLogs, setTodayLogs] = useState([])

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
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0])
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

      // Load today's logs for fasting calculation
      const today = new Date().toISOString().split('T')[0]
      const { data: todayData } = await supabase
        .from('food_log')
        .select('logged_at, calories, carbs')
        .eq('user_id', userId)
        .eq('date', today)

      setTodayLogs(todayData || [])

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
  
  const fastingHours = calculateFastingHours(todayLogs)
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
                <h3 className={styles.sectionTitle}>Metabolic Profile</h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>BMR</span>
                    <span className={styles.statValue}>{bmr || '—'}</span>
                    <span className={styles.statHint}>cal/day at rest</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>TDEE</span>
                    <span className={styles.statValue}>{tdee || '—'}</span>
                    <span className={styles.statHint}>total daily</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Deficit</span>
                    <span className={styles.statValue}>{projection?.dailyDeficit || '—'}</span>
                    <span className={styles.statHint}>cal/day</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Rate</span>
                    <span className={styles.statValue}>{projection?.lbsPerWeek || '—'}</span>
                    <span className={styles.statHint}>lbs/week</span>
                  </div>
                </div>

                {!bmr && (
                  <p className={styles.setupHint}>
                    Complete your profile (height, DOB, activity) in Goals to see calculations.
                  </p>
                )}
              </section>

              {/* Weight Projection */}
              {projection && !projection.alreadyAtGoal && !projection.noDeficit && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Weight Projection</h3>
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
                          />
                          <span className={styles.chartLabel}>W{point.week}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {projection?.alreadyAtGoal && (
                <div className={styles.successBanner}>🎉 You've reached your goal!</div>
              )}

              {projection?.noDeficit && (
                <div className={styles.warningBanner}>
                  ⚠️ Calorie goal ({userProfile?.calorie_goal}) ≥ TDEE ({tdee})
                </div>
              )}

              {/* Weight History */}
              {weightHistory.length > 0 && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Weight History</h3>
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
                          />
                          <span className={styles.chartLabel}>{Math.round(entry.weight)}</span>
                        </div>
                      )
                    })}
                  </div>
                  {weightChange !== null && (
                    <div className={styles.weightChange}>
                      {weightChange < 0 ? (
                        <span className={styles.positive}>↓ {Math.abs(weightChange).toFixed(1)} lbs</span>
                      ) : weightChange > 0 ? (
                        <span className={styles.negative}>↑ {weightChange.toFixed(1)} lbs</span>
                      ) : (
                        <span>No change</span>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* Ketosis (if IF enabled) */}
              {userProfile?.uses_intermittent_fasting && (
                <section className={styles.section}>
                  <h3 className={styles.sectionTitle}>Fasting & Ketosis</h3>
                  <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Fast</span>
                      <span className={styles.statValue}>{fastingHours ? `~${fastingHours}h` : '—'}</span>
                    </div>
                    <div className={styles.statCard}>
                      <span className={styles.statLabel}>Carbs</span>
                      <span className={styles.statValue}>{Math.round(todayCarbs)}g</span>
                    </div>
                    <div className={`${styles.statCard} ${styles[`ketosis_${ketosis.status}`]}`}>
                      <span className={styles.statLabel}>Ketosis</span>
                      <span className={styles.statValue}>
                        {ketosis.status === 'likely' ? '🔥' : 
                         ketosis.status === 'possible' ? '⚡' : '—'}
                      </span>
                    </div>
                  </div>
                </section>
              )}

              {/* 30-Day Averages */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>30-Day Averages</h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Calories</span>
                    <span className={styles.statValue}>{macroAverages.calories}</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Protein</span>
                    <span className={styles.statValue}>{macroAverages.protein}g</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Fat</span>
                    <span className={styles.statValue}>{macroAverages.fat}g</span>
                  </div>
                  <div className={styles.statCard}>
                    <span className={styles.statLabel}>Carbs</span>
                    <span className={styles.statValue}>{macroAverages.carbs}g</span>
                  </div>
                </div>
                {macroAverages.days > 0 && (
                  <p className={styles.daysNote}>Based on {macroAverages.days} days</p>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

