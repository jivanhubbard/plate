'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import styles from './AccountModal.module.css'

export default function AccountModal({ user, onClose, onSignOut }) {
  const [activeTab, setActiveTab] = useState('email')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const [emailForm, setEmailForm] = useState({
    newEmail: '',
    password: '',
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const [deleteConfirm, setDeleteConfirm] = useState('')

  const clearMessages = () => {
    setMessage(null)
    setError(null)
  }

  const handleEmailChange = async (e) => {
    e.preventDefault()
    clearMessages()
    setSaving(true)

    try {
      // First verify current password by re-authenticating
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: emailForm.password,
      })

      if (signInError) {
        throw new Error('Current password is incorrect')
      }

      // Update email - Supabase will send confirmation to new email
      const { error: updateError } = await supabase.auth.updateUser({
        email: emailForm.newEmail,
      })

      if (updateError) throw updateError

      setMessage('Confirmation email sent to your new address. Please check your inbox and click the link to complete the change.')
      setEmailForm({ newEmail: '', password: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    clearMessages()

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('New passwords do not match')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setError('New password must be at least 6 characters')
      return
    }

    setSaving(true)

    try {
      // Verify current password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordForm.currentPassword,
      })

      if (signInError) {
        throw new Error('Current password is incorrect')
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordForm.newPassword,
      })

      if (updateError) throw updateError

      setMessage('Password updated successfully!')
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    clearMessages()

    if (deleteConfirm !== 'DELETE') {
      setError('Please type DELETE to confirm')
      return
    }

    setSaving(true)

    try {
      // Delete user data from our tables first
      const { error: deleteLogsError } = await supabase
        .from('food_log')
        .delete()
        .eq('user_id', user.id)

      if (deleteLogsError) throw deleteLogsError

      const { error: deleteFavoritesError } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', user.id)

      if (deleteFavoritesError) throw deleteFavoritesError

      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', user.id)

      if (deleteUserError) throw deleteUserError

      // Sign out (auth user deletion requires admin API, so we just sign out)
      await supabase.auth.signOut()
      
      setMessage('Your data has been deleted. Redirecting...')
      setTimeout(() => {
        window.location.href = '/auth/login'
      }, 2000)
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2 className={styles.title}>Account Settings</h2>
          <button onClick={onClose} className={styles.closeButton} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.currentEmail}>
            <span className={styles.label}>Signed in as</span>
            <span className={styles.email}>{user.email}</span>
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'email' ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab('email'); clearMessages() }}
            >
              Change Email
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'password' ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab('password'); clearMessages() }}
            >
              Change Password
            </button>
            <button
              className={`${styles.tab} ${styles.tabDanger} ${activeTab === 'delete' ? styles.tabActive : ''}`}
              onClick={() => { setActiveTab('delete'); clearMessages() }}
            >
              Delete Account
            </button>
          </div>

          {message && <div className={styles.success}>{message}</div>}
          {error && <div className={styles.error}>{error}</div>}

          {activeTab === 'email' && (
            <form onSubmit={handleEmailChange} className={styles.form}>
              <p className={styles.hint}>
                We'll send a confirmation link to your new email address. Your email won't change until you click that link.
              </p>
              <div className={styles.inputGroup}>
                <label htmlFor="newEmail">New Email Address</label>
                <input
                  id="newEmail"
                  type="email"
                  value={emailForm.newEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                  placeholder="newemail@example.com"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="emailPassword">Current Password</label>
                <input
                  id="emailPassword"
                  type="password"
                  value={emailForm.password}
                  onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                  placeholder="Enter your current password"
                  required
                />
              </div>
              <button type="submit" disabled={saving} className={styles.submitButton}>
                {saving ? 'Sending...' : 'Send Confirmation Email'}
              </button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={handlePasswordChange} className={styles.form}>
              <div className={styles.inputGroup}>
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  id="currentPassword"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  placeholder="Enter your current password"
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="newPassword">New Password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  placeholder="At least 6 characters"
                  required
                  minLength={6}
                />
              </div>
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  placeholder="Confirm your new password"
                  required
                />
              </div>
              <button type="submit" disabled={saving} className={styles.submitButton}>
                {saving ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}

          {activeTab === 'delete' && (
            <form onSubmit={handleDeleteAccount} className={styles.form}>
              <div className={styles.dangerZone}>
                <h3 className={styles.dangerTitle}>⚠️ Danger Zone</h3>
                <p className={styles.dangerText}>
                  This will permanently delete all your food logs, favorites, and profile data. This action cannot be undone.
                </p>
                <div className={styles.inputGroup}>
                  <label htmlFor="deleteConfirm">Type DELETE to confirm</label>
                  <input
                    id="deleteConfirm"
                    type="text"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                    className={styles.dangerInput}
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving || deleteConfirm !== 'DELETE'}
                  className={styles.deleteButton}
                >
                  {saving ? 'Deleting...' : 'Permanently Delete My Account'}
                </button>
              </div>
            </form>
          )}

          <div className={styles.footer}>
            <button onClick={onSignOut} className={styles.signOutButton}>
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

