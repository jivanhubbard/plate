'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getFirstDayOfMonth, getLastDayOfMonth } from '@/lib/date'
import styles from './CalendarModal.module.css'

export default function CalendarModal({ userId, userProfile, onClose, onSelectDate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dailyTotals, setDailyTotals] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userId && userProfile) {
      loadMonthData()
    }
  }, [userId, userProfile, currentMonth])

  async function loadMonthData() {
    setLoading(true)
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = getFirstDayOfMonth(year, month)
    const lastDay = getLastDayOfMonth(year, month)

    try {
      const { data, error } = await supabase
        .from('food_log')
        .select('date, calories, protein, fat, carbs')
        .eq('user_id', userId)
        .gte('date', firstDay)
        .lte('date', lastDay)

      if (error) throw error

      // Aggregate by date
      const totals = {}
      data.forEach((log) => {
        if (!totals[log.date]) {
          totals[log.date] = { calories: 0, protein: 0, fat: 0, carbs: 0 }
        }
        totals[log.date].calories += parseFloat(log.calories) || 0
        totals[log.date].protein += parseFloat(log.protein) || 0
        totals[log.date].fat += parseFloat(log.fat) || 0
        totals[log.date].carbs += parseFloat(log.carbs) || 0
      })

      setDailyTotals(totals)
    } catch (error) {
      console.error('Error loading month data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDay = firstDay.getDay()

    const days = []
    
    // Add empty cells for days before the first of the month
    for (let i = 0; i < startingDay; i++) {
      days.push({ day: null, date: null })
    }

    // Add actual days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ day, date })
    }

    return days
  }

  const getStatusForDay = (date) => {
    if (!date || !dailyTotals[date] || !userProfile) return 'empty'

    const totals = dailyTotals[date]
    const goals = {
      calories: userProfile.calorie_goal,
      protein: userProfile.protein_goal,
    }

    const proteinPct = (totals.protein / goals.protein) * 100
    const caloriePct = (totals.calories / goals.calories) * 100

    if (caloriePct > 110) return 'over'
    if (proteinPct >= 90 && caloriePct <= 105) return 'success'
    if (proteinPct >= 70 || caloriePct >= 50) return 'partial'
    return 'low'
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const handleDayClick = (date) => {
    if (date && onSelectDate) {
      onSelectDate(date)
      onClose()
    }
  }

  const formatMonth = () => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  const days = getDaysInMonth()
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Calendar</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.calendarHeader}>
            <button onClick={prevMonth} className={styles.navButton}>←</button>
            <h3 className={styles.monthTitle}>{formatMonth()}</h3>
            <button onClick={nextMonth} className={styles.navButton}>→</button>
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.success}`}></span>
              <span>Goals</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.partial}`}></span>
              <span>Partial</span>
            </div>
            <div className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles.over}`}></span>
              <span>Over</span>
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : (
            <div className={styles.calendar}>
              <div className={styles.weekdays}>
                {weekdays.map((day, i) => (
                  <div key={i} className={styles.weekday}>{day}</div>
                ))}
              </div>

              <div className={styles.days}>
                {days.map((dayInfo, index) => {
                  const status = getStatusForDay(dayInfo.date)
                  const totals = dayInfo.date ? dailyTotals[dayInfo.date] : null

                  return (
                    <div
                      key={index}
                      className={`${styles.day} ${dayInfo.day ? styles.hasDay : ''} ${styles[status]}`}
                      onClick={() => handleDayClick(dayInfo.date)}
                    >
                      {dayInfo.day && (
                        <>
                          <span className={styles.dayNumber}>{dayInfo.day}</span>
                          {totals && (
                            <div className={styles.dayStats}>
                              <span>{Math.round(totals.calories)}</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

