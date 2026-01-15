'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './WaterTracker.module.css'

export default function WaterTracker({ userId, selectedDate, waterGoal = 8, waterServingOz = 8 }) {
  const [cups, setCups] = useState(0)
  const [loading, setLoading] = useState(true)
  const audioContextRef = useRef(null)

  useEffect(() => {
    loadWaterLog()
  }, [userId, selectedDate])

  async function loadWaterLog() {
    try {
      const { data, error } = await supabase
        .from('water_log')
        .select('cups')
        .eq('user_id', userId)
        .eq('date', selectedDate)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      setCups(data?.cups || 0)
    } catch (error) {
      console.error('Error loading water log:', error)
    } finally {
      setLoading(false)
    }
  }

  async function updateWaterLog(newCups) {
    try {
      const { error } = await supabase
        .from('water_log')
        .upsert({
          user_id: userId,
          date: selectedDate,
          cups: newCups,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,date'
        })

      if (error) throw error
    } catch (error) {
      console.error('Error updating water log:', error)
    }
  }

  const playPopSound = () => {
    try {
      // Create audio context on demand (required for user interaction)
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)()
      }
      
      const ctx = audioContextRef.current
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)
      
      // Short, subtle pop/click sound
      oscillator.frequency.setValueAtTime(600, ctx.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05)
      
      oscillator.type = 'sine'
      
      // Quick fade in and out for a soft "pop"
      gainNode.gain.setValueAtTime(0, ctx.currentTime)
      gainNode.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08)
      
      oscillator.start(ctx.currentTime)
      oscillator.stop(ctx.currentTime + 0.08)
    } catch (error) {
      // Audio failed, that's okay - continue silently
    }
  }

  const handleDropClick = (index) => {
    const newCups = index + 1

    if (cups === newCups) {
      // Clicking the last filled drop unfills it
      setCups(newCups - 1)
      updateWaterLog(newCups - 1)
    } else {
      setCups(newCups)
      updateWaterLog(newCups)
      playPopSound()
    }
  }

  const handleAddExtra = () => {
    const newCups = cups + 1
    setCups(newCups)
    updateWaterLog(newCups)
    playPopSound()
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading water...</div>
      </div>
    )
  }

  const totalOz = cups * waterServingOz
  const goalOz = waterGoal * waterServingOz

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>
          <svg className={styles.titleIcon} width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
          Water
        </h3>
        <span className={styles.stats}>
          {totalOz} / {goalOz} oz
        </span>
      </div>

      <div className={styles.drops}>
        {Array.from({ length: waterGoal }).map((_, index) => (
          <button
            key={index}
            onClick={() => handleDropClick(index)}
            className={`${styles.drop} ${index < cups ? styles.filled : ''}`}
            title={`${(index + 1) * waterServingOz} oz`}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
          </button>
        ))}
        
        {cups >= waterGoal && (
          <button
            onClick={handleAddExtra}
            className={styles.addMore}
            title="Add more water"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        )}
      </div>

      {cups > waterGoal && (
        <div className={styles.extra}>
          +{cups - waterGoal} extra
        </div>
      )}
    </div>
  )
}

