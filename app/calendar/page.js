'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/auth'
import { getFirstDayOfMonth, getLastDayOfMonth } from '@/lib/date'
import styles from './page.module.css'
import DarkModeToggle from '@/components/DarkModeToggle'

export default function CalendarPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [dailyTotals, setDailyTotals] = useState({})

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadUserProfile()
    }
  }, [user])

  useEffect(() => {
    if (user && userProfile) {
      loadMonthData()
    }
  }, [user, userProfile, currentMonth])

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/auth/login')
      return
    }
    setUser(user)
    setLoading(false)
  }

  async function loadUserProfile() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      if (error) throw error
      setUserProfile(data)
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  async function loadMonthData() {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const firstDay = getFirstDayOfMonth(year, month)
    const lastDay = getLastDayOfMonth(year, month)

    try {
      const { data, error } = await supabase
        .from('food_log')
        .select('date, calories, protein, fat, carbs')
        .eq('user_id', user.id)
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
    }
  }

  async function handleLogout() {
    await signOut()
    router.push('/auth/login')
    router.refresh()
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
      fat: userProfile.fat_goal,
      carbs: userProfile.carb_goal,
    }

    // Check protein (most important for the user)
    const proteinPct = (totals.protein / goals.protein) * 100
    const caloriePct = (totals.calories / goals.calories) * 100

    if (caloriePct > 110) return 'over' // Way over calories
    if (proteinPct >= 90 && caloriePct <= 105) return 'success' // Hit protein, reasonable calories
    if (proteinPct >= 70 || caloriePct >= 50) return 'partial' // Some logging done
    return 'low' // Very little logged
  }

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))
  }

  const goToDay = (date) => {
    if (date) {
      router.push(`/dashboard?date=${date}`)
    }
  }

  const formatMonth = () => {
    return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  if (loading || !userProfile) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    )
  }

  const days = getDaysInMonth()
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Plate</h1>
          <p className={styles.subtitle}>Calendar View</p>
        </div>
        <div className={styles.headerActions}>
          <a href="/dashboard" className={styles.navLink}>Dashboard</a>
          <DarkModeToggle />
          <button onClick={handleLogout} className={styles.logoutButton}>
            Sign Out
          </button>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.calendarHeader}>
          <button onClick={prevMonth} className={styles.navButton}>←</button>
          <h2 className={styles.monthTitle}>{formatMonth()}</h2>
          <button onClick={nextMonth} className={styles.navButton}>→</button>
        </div>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.success}`}></span>
            <span>Goals Met</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.partial}`}></span>
            <span>Partial</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.over}`}></span>
            <span>Over</span>
          </div>
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.low}`}></span>
            <span>Low</span>
          </div>
        </div>

        <div className={styles.calendar}>
          <div className={styles.weekdays}>
            {weekdays.map((day) => (
              <div key={day} className={styles.weekday}>{day}</div>
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
                  onClick={() => goToDay(dayInfo.date)}
                >
                  {dayInfo.day && (
                    <>
                      <span className={styles.dayNumber}>{dayInfo.day}</span>
                      {totals && (
                        <div className={styles.dayStats}>
                          <span>{Math.round(totals.calories)} cal</span>
                          <span>{Math.round(totals.protein)}g P</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className={styles.goals}>
          <h3>Your Daily Goals</h3>
          <div className={styles.goalsGrid}>
            <div className={styles.goalItem}>
              <span className={styles.goalLabel}>Calories</span>
              <span className={styles.goalValue}>{userProfile.calorie_goal}</span>
            </div>
            <div className={styles.goalItem}>
              <span className={styles.goalLabel}>Protein</span>
              <span className={styles.goalValue}>{userProfile.protein_goal}g</span>
            </div>
            <div className={styles.goalItem}>
              <span className={styles.goalLabel}>Fat</span>
              <span className={styles.goalValue}>{userProfile.fat_goal}g</span>
            </div>
            <div className={styles.goalItem}>
              <span className={styles.goalLabel}>Carbs</span>
              <span className={styles.goalValue}>{userProfile.carb_goal}g</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

