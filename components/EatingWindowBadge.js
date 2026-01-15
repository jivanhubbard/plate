'use client'

import { useState, useEffect } from 'react'
import styles from './EatingWindowBadge.module.css'

export default function EatingWindowBadge({ windowStart, windowEnd }) {
  const [status, setStatus] = useState(null)
  const [timeMessage, setTimeMessage] = useState('')

  useEffect(() => {
    if (!windowStart || !windowEnd) return

    const updateStatus = () => {
      const now = new Date()
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      // Parse window times (format: "HH:MM:SS" or "HH:MM")
      const [startHour, startMin] = windowStart.split(':').map(Number)
      const [endHour, endMin] = windowEnd.split(':').map(Number)
      
      const startMinutes = startHour * 60 + startMin
      const endMinutes = endHour * 60 + endMin

      const isInWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes

      if (isInWindow) {
        // Calculate time until window closes
        const minutesLeft = endMinutes - currentMinutes
        const hours = Math.floor(minutesLeft / 60)
        const mins = minutesLeft % 60
        
        setStatus('open')
        if (hours > 0) {
          setTimeMessage(`${hours}h ${mins}m left`)
        } else {
          setTimeMessage(`${mins}m left`)
        }
      } else {
        // Calculate time until window opens
        let minutesUntil
        if (currentMinutes < startMinutes) {
          minutesUntil = startMinutes - currentMinutes
        } else {
          // Window is tomorrow
          minutesUntil = (24 * 60 - currentMinutes) + startMinutes
        }
        
        const hours = Math.floor(minutesUntil / 60)
        const mins = minutesUntil % 60

        setStatus('closed')
        if (hours > 0) {
          setTimeMessage(`Opens in ${hours}h ${mins}m`)
        } else {
          setTimeMessage(`Opens in ${mins}m`)
        }
      }
    }

    // Update immediately and then every minute
    updateStatus()
    const interval = setInterval(updateStatus, 60000)

    return () => clearInterval(interval)
  }, [windowStart, windowEnd])

  // Don't show if no eating window is set
  if (!windowStart || !windowEnd || !status) {
    return null
  }

  const formatTime = (timeStr) => {
    if (!timeStr) return ''
    const [hour, min] = timeStr.split(':').map(Number)
    const period = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${String(min).padStart(2, '0')} ${period}`
  }

  return (
    <div className={`${styles.badge} ${styles[status]}`}>
      <div className={styles.indicator} />
      <div className={styles.content}>
        <span className={styles.status}>
          {status === 'open' ? 'Eating Window Open' : 'Fasting'}
        </span>
        <span className={styles.time}>{timeMessage}</span>
      </div>
      <div className={styles.window}>
        {formatTime(windowStart)} - {formatTime(windowEnd)}
      </div>
    </div>
  )
}

