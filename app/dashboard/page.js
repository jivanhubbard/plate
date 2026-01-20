'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { signOut } from '@/lib/auth'
import styles from './page.module.css'
import FoodLog from '@/components/FoodLog'
import MacroSummary from '@/components/MacroSummary'
import AddFoodModal from '@/components/AddFoodModal'
import GoalsModal from '@/components/GoalsModal'
import AccountModal from '@/components/AccountModal'
import CalendarModal from '@/components/CalendarModal'
import AnalyticsModal from '@/components/AnalyticsModal'
import DarkModeToggle from '@/components/DarkModeToggle'
import EatingWindowBadge from '@/components/EatingWindowBadge'
import WaterTracker from '@/components/WaterTracker'
import WeekView from '@/components/WeekView'

export default function DashboardPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [foodLogs, setFoodLogs] = useState([])
  const [foods, setFoods] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [showAccountModal, setShowAccountModal] = useState(false)
  const [showCalendarModal, setShowCalendarModal] = useState(false)
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState(() => {
    const urlDate = searchParams.get('date')
    if (urlDate) return urlDate
    // Use local date instead of UTC
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  })

  useEffect(() => {
    checkUser()
  }, [])

  useEffect(() => {
    if (user) {
      loadUserProfile()
      loadFoods()
    }
  }, [user])

  useEffect(() => {
    if (user && selectedDate) {
      loadFoodLogs()
    }
  }, [user, selectedDate])

  async function checkUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

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

      if (error) {
        // If no profile exists, create one for the new user
        if (error.code === 'PGRST116') {
          const { data: newProfile, error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              email: user.email,
              onboarding_complete: false,
            })
            .select()
            .single()

          if (insertError) {
            console.error('Error creating user profile:', insertError)
            return
          }

          setUserProfile(newProfile)
          // Show onboarding for new users
          setShowGoalsModal(true)
          return
        }
        throw error
      }

      setUserProfile(data)
      
      // Show onboarding modal if user hasn't completed setup
      if (!data.onboarding_complete) {
        setShowGoalsModal(true)
      }
    } catch (error) {
      console.error('Error loading user profile:', error)
    }
  }

  async function loadFoods() {
    try {
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .or(`is_custom.eq.false,user_id.eq.${user.id}`)
        .order('name')

      if (error) throw error
      setFoods(data || [])
    } catch (error) {
      console.error('Error loading foods:', error)
    }
  }

  async function loadFoodLogs() {
    try {
      const { data, error } = await supabase
        .from('food_log')
        .select(`
          *,
          foods (*)
        `)
        .eq('user_id', user.id)
        .eq('date', selectedDate)
        .order('created_at', { ascending: false })

      if (error) throw error
      setFoodLogs(data || [])
    } catch (error) {
      console.error('Error loading food logs:', error)
    }
  }

  async function handleLogout() {
    await signOut()
    router.push('/auth/login')
    router.refresh()
  }

  const handleFoodAdded = () => {
    loadFoodLogs()
    loadFoods()
    setShowAddModal(false)
  }

  const handleFoodDeleted = () => {
    loadFoodLogs()
  }

  const handleFoodUpdated = () => {
    loadFoodLogs()
  }

  const handleGoalsSaved = () => {
    loadUserProfile()
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    )
  }

  if (!userProfile) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading profile...</div>
      </div>
    )
  }

  // Calculate totals
  const totals = foodLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + (parseFloat(log.calories) || 0),
      protein: acc.protein + (parseFloat(log.protein) || 0),
      fat: acc.fat + (parseFloat(log.fat) || 0),
      carbs: acc.carbs + (parseFloat(log.carbs) || 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 }
  )

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Plate</h1>
          <p className={styles.subtitle}>Macro Tracker</p>
        </div>
        <div className={styles.headerActions}>
          <button onClick={() => setShowCalendarModal(true)} className={styles.navLink}>Calendar</button>
          <button onClick={() => setShowAnalyticsModal(true)} className={styles.navLink}>Analytics</button>
          <button onClick={() => setShowGoalsModal(true)} className={styles.navLink}>Goals</button>
          <DarkModeToggle />
          <button onClick={() => setShowAccountModal(true)} className={styles.navLink}>Account</button>
        </div>
      </header>

      <main className={styles.main}>
        <WeekView
          userId={user.id}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          calorieGoal={userProfile.calorie_goal}
        />

        <div className={styles.dateSelector}>
          <label htmlFor="date">Date:</label>
          <input
            id="date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={styles.dateInput}
          />
        </div>

        {userProfile.uses_intermittent_fasting && (
          <EatingWindowBadge
            windowStart={userProfile.eating_window_start}
            windowEnd={userProfile.eating_window_end}
          />
        )}

        <MacroSummary
          totals={totals}
          goals={{
            calories: userProfile.calorie_goal,
            protein: userProfile.protein_goal,
            fat: userProfile.fat_goal,
            carbs: userProfile.carb_goal,
          }}
          goalTypes={{
            calories: userProfile.calorie_goal_type || 'limit',
            protein: userProfile.protein_goal_type || 'target',
            fat: userProfile.fat_goal_type || 'target',
            carbs: userProfile.carb_goal_type || 'target',
          }}
        />

        <div className={styles.actions}>
          <button
            onClick={() => setShowAddModal(true)}
            className={styles.addButton}
          >
            + Add Food
          </button>
        </div>

        <WaterTracker
          userId={user.id}
          selectedDate={selectedDate}
          waterGoal={userProfile.water_goal_cups || 8}
          waterServingOz={userProfile.water_serving_oz || 8}
        />

        <FoodLog
          logs={foodLogs}
          onDelete={handleFoodDeleted}
          onUpdate={handleFoodUpdated}
          eatingWindow={userProfile.uses_intermittent_fasting ? {
            enabled: true,
            start: userProfile.eating_window_start,
            end: userProfile.eating_window_end,
          } : null}
        />

        {showAddModal && (
          <AddFoodModal
            foods={foods}
            selectedDate={selectedDate}
            userId={user.id}
            onClose={() => setShowAddModal(false)}
            onFoodAdded={handleFoodAdded}
          />
        )}

        {showGoalsModal && (
          <GoalsModal
            userProfile={userProfile}
            userId={user.id}
            onClose={() => setShowGoalsModal(false)}
            onSave={handleGoalsSaved}
          />
        )}

        {showAccountModal && (
          <AccountModal
            user={user}
            onClose={() => setShowAccountModal(false)}
            onSignOut={handleLogout}
          />
        )}

        {showCalendarModal && (
          <CalendarModal
            userId={user.id}
            userProfile={userProfile}
            onClose={() => setShowCalendarModal(false)}
            onSelectDate={(date) => setSelectedDate(date)}
          />
        )}

        {showAnalyticsModal && (
          <AnalyticsModal
            userId={user.id}
            userProfile={userProfile}
            onClose={() => setShowAnalyticsModal(false)}
          />
        )}
      </main>
    </div>
  )
}

