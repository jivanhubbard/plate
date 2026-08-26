'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
      {/* Decorative blobs */}
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      <div className={styles.blob3}></div>
      
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <span className={styles.logoIcon}>🍽</span>
          <span className={styles.logoText}>Plate</span>
        </div>
        <div className={styles.navLinks}>
          <Link href="/auth/login" className={styles.navLink}>Sign In</Link>
          <Link href="/auth/signup" className={styles.navButton}>Get Started</Link>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <h1 className={styles.title}>
              Macro Tracking
              <br />
              <span className={styles.titleHighlight}>made easy</span>
            </h1>
            <p className={styles.subtitle}>
              Track your calories, protein, carbs, and fat with a clean, 
              simple interface designed to help you reach your goals.
            </p>
            
            <div className={styles.actions}>
              <Link href="/auth/signup" className={styles.primaryButton}>
                Get started
              </Link>
            </div>

            <div className={styles.features}>
              <div className={styles.feature}>
                <span className={styles.featureCheck}>✓</span>
                <span>Calories & Macros</span>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureCheck}>✓</span>
                <span>Water Tracking</span>
              </div>
              <div className={styles.feature}>
                <span className={styles.featureCheck}>✓</span>
                <span>Intermittent Fasting</span>
              </div>
            </div>
          </div>

          <div className={styles.heroVisual}>
            <div className={styles.phonePreview}>
              <div className={styles.phoneScreen}>
                <div className={styles.previewHeader}>
                  <span className={styles.previewTitle}>Today</span>
                  <span className={styles.previewDate}>Thu, Jan 23</span>
                </div>
                <div className={styles.previewRing}>
                  <svg viewBox="0 0 120 120" className={styles.ringSvg}>
                    <circle cx="60" cy="60" r="50" className={styles.ringBg} />
                    <circle cx="60" cy="60" r="50" className={styles.ringProgress} />
                  </svg>
                  <div className={styles.ringText}>
                    <span className={styles.ringNumber}>1,587</span>
                    <span className={styles.ringLabel}>cal</span>
                  </div>
                </div>
                <div className={styles.previewMacros}>
                  <div className={styles.previewMacro}>
                    <span className={styles.macroValue}>24g</span>
                    <span className={styles.macroLabel}>Protein</span>
                  </div>
                  <div className={styles.previewMacro}>
                    <span className={styles.macroValue}>121g</span>
                    <span className={styles.macroLabel}>Carbs</span>
                  </div>
                  <div className={styles.previewMacro}>
                    <span className={styles.macroValue}>68g</span>
                    <span className={styles.macroLabel}>Fat</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </main>

      <footer className={styles.footer}>
        <p>Your nutrition journey starts with a single meal</p>
      </footer>
    </div>
  )
}
