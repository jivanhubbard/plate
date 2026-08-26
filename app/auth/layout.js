'use client'

import styles from './layout.module.css'

export default function AuthLayout({ children }) {
  return (
    <div className={styles.authContainer}>
      {/* Decorative blobs */}
      <div className={styles.blob1}></div>
      <div className={styles.blob2}></div>
      {children}
    </div>
  )
}
