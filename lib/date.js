/**
 * Get today's date in YYYY-MM-DD format using local timezone
 */
export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Get the first day of a month in YYYY-MM-DD format
 */
export function getFirstDayOfMonth(year, month) {
  return getLocalDateString(new Date(year, month, 1))
}

/**
 * Get the last day of a month in YYYY-MM-DD format
 */
export function getLastDayOfMonth(year, month) {
  return getLocalDateString(new Date(year, month + 1, 0))
}

