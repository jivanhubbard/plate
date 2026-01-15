'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import styles from './page.module.css'

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  async function checkAuth() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      router.push('/dashboard')
    } else {
      setChecking(false)
    }
  }

  if (checking) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      <div className={styles.backgroundImage}></div>
      <div className={styles.overlay}></div>
      
      <main className={styles.content}>
        <div className={styles.hero}>
          <h1 className={styles.logo}>Plate</h1>
          <p className={styles.tagline}>
            Mindful macro tracking for<br />
            intentional eating
          </p>
          
          <div className={styles.actions}>
            <a href="/auth/login" className={styles.primaryButton}>
              Sign In
            </a>
            <a href="/auth/signup" className={styles.secondaryButton}>
              Create Account
            </a>
          </div>
        </div>

        <footer className={styles.footer}>
          <p>Track your nutrition journey with clarity and purpose</p>
        </footer>
      </main>
    </div>
  )
}
