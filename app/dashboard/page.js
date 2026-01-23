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
import FastingStatus from '@/components/FastingStatus'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
      fiber: acc.fiber + (parseFloat(log.fiber) || 0),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }
  )

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Plate</h1>
          <p className={styles.subtitle}>Macro Tracker</p>
        </div>
        
        {/* Desktop nav */}
        <div className={styles.headerActions}>
          <button onClick={() => setShowCalendarModal(true)} className={styles.navLink}>Calendar</button>
          <button onClick={() => setShowAnalyticsModal(true)} className={styles.navLink}>Analytics</button>
          <button onClick={() => setShowGoalsModal(true)} className={styles.navLink}>Goals</button>
          <DarkModeToggle />
          <button onClick={() => setShowAccountModal(true)} className={styles.navLink}>Account</button>
        </div>

        {/* Mobile hamburger */}
        <button 
          className={styles.hamburger}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.open : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.open : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.open : ''}`}></span>
        </button>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className={styles.mobileMenu}>
            <button onClick={() => { setShowCalendarModal(true); setMobileMenuOpen(false); }} className={styles.mobileNavLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Calendar
            </button>
            <button onClick={() => { setShowAnalyticsModal(true); setMobileMenuOpen(false); }} className={styles.mobileNavLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
              Analytics
            </button>
            <button onClick={() => { setShowGoalsModal(true); setMobileMenuOpen(false); }} className={styles.mobileNavLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              Goals
            </button>
            <div className={styles.mobileNavLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
              <DarkModeToggle />
            </div>
            <button onClick={() => { setShowAccountModal(true); setMobileMenuOpen(false); }} className={styles.mobileNavLink}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Account
            </button>
          </div>
        )}
      </header>

      <main className={styles.main}>
        <WeekView
          userId={user.id}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          calorieGoal={userProfile.calorie_goal}
        />

        {userProfile.uses_intermittent_fasting && (
          <FastingStatus userId={user.id} userProfile={userProfile} />
        )}

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
            fiber: userProfile.fiber_goal || 30,
          }}
          goalTypes={{
            calories: userProfile.calorie_goal_type || 'limit',
            protein: userProfile.protein_goal_type || 'target',
            fat: userProfile.fat_goal_type || 'target',
            carbs: userProfile.carb_goal_type || 'target',
            fiber: userProfile.fiber_goal_type || 'target',
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

        {/* Mobile FAB - Fixed Add Food Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className={styles.fab}
          aria-label="Add Food"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>

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

