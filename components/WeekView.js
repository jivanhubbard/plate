'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './WeekView.module.css'

export default function WeekView({ userId, selectedDate, onSelectDate, calorieGoal }) {
  const [weekData, setWeekData] = useState([])
  const [loading, setLoading] = useState(true)

  // Get the week containing the selected date (Sun-Sat)
  const getWeekDates = () => {
    const current = new Date(selectedDate + 'T12:00:00')
    const dayOfWeek = current.getDay()
    const sunday = new Date(current)
    sunday.setDate(current.getDate() - dayOfWeek)
    
    // Get today's date string for comparison (local date)
    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    
    const dates = []
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday)
      date.setDate(sunday.getDate() + i)
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      dates.push({
        date: dateStr,
        dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
        dayNum: date.getDate(),
        isToday: dateStr === todayStr,
        isSelected: dateStr === selectedDate,
        isFuture: dateStr > todayStr, // Compare date strings, not Date objects
      })
    }
    return dates
  }

  useEffect(() => {
    if (userId) {
      loadWeekData()
    }
  }, [userId, selectedDate])

  async function loadWeekData() {
    try {
      const dates = getWeekDates()
      const startDate = dates[0].date
      const endDate = dates[6].date

      const { data, error } = await supabase
        .from('food_log')
        .select('date, calories')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)

      if (error) throw error

      // Aggregate calories by date
      const caloriesByDate = {}
      ;(data || []).forEach(log => {
        if (!caloriesByDate[log.date]) {
          caloriesByDate[log.date] = 0
        }
        caloriesByDate[log.date] += parseFloat(log.calories) || 0
      })

      // Merge with date structure
      const weekWithData = dates.map(day => ({
        ...day,
        calories: caloriesByDate[day.date] || 0,
        logged: !!caloriesByDate[day.date],
      }))

      setWeekData(weekWithData)
    } catch (error) {
      console.error('Error loading week data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getProgressStatus = (calories) => {
    if (!calorieGoal || calories === 0) return 'none'
    const ratio = calories / calorieGoal
    if (ratio >= 0.9 && ratio <= 1.1) return 'perfect'
    if (ratio < 0.5) return 'low'
    if (ratio > 1.1) return 'over'
    return 'partial'
  }

  const weekDates = getWeekDates()

  return (
    <div className={styles.weekView}>
      <div className={styles.weekHeader}>
        <span className={styles.weekLabel}>This Week</span>
        <span className={styles.weekRange}>
          {weekDates[0]?.dayNum} - {weekDates[6]?.dayNum}
        </span>
      </div>
      
      <div className={styles.daysRow}>
        {(weekData.length > 0 ? weekData : weekDates).map((day) => {
          const status = getProgressStatus(day.calories || 0)
          return (
            <button
              key={day.date}
              onClick={() => onSelectDate(day.date)}
              className={`
                ${styles.dayCard}
                ${day.isSelected ? styles.selected : ''}
                ${day.isToday ? styles.today : ''}
                ${day.isFuture ? styles.future : ''}
              `}
              disabled={day.isFuture}
            >
              <span className={styles.dayName}>{day.dayName}</span>
              <span className={styles.dayNum}>{day.dayNum}</span>
              
              {!day.isFuture && (
                <div className={`${styles.indicator} ${styles[status]}`}>
                  {status === 'perfect' && '✓'}
                  {status === 'over' && '↑'}
                  {status === 'partial' && '○'}
                  {status === 'low' && '↓'}
                  {status === 'none' && '·'}
                </div>
              )}
              
              {day.logged && !day.isFuture && (
                <span className={styles.calorieHint}>
                  {Math.round(day.calories)}
                </span>
              )}
            </button>
          )
        })}
      </div>
      
      <div className={styles.legend}>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.perfect}`}>✓</span> On target</span>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.partial}`}>○</span> Partial</span>
        <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.over}`}>↑</span> Over</span>
      </div>
    </div>
  )
}

