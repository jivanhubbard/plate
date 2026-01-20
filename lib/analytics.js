// Analytics calculations for weight projection, BMR, TDEE, and ketosis estimation

/**
 * Calculate BMR using Mifflin-St Jeor equation
 * @param {number} weightLbs - Weight in pounds
 * @param {number} heightInches - Height in inches
 * @param {number} age - Age in years
 * @param {string} gender - 'male', 'female', or 'not_specified'
 * @returns {number} BMR in calories/day
 */
export function calculateBMR(weightLbs, heightInches, age, gender) {
  if (!weightLbs || !heightInches || !age) return null
  
  // Convert to metric
  const weightKg = weightLbs * 0.453592
  const heightCm = heightInches * 2.54
  
  // Mifflin-St Jeor equation
  let bmr = 10 * weightKg + 6.25 * heightCm - 5 * age
  
  if (gender === 'male') {
    bmr += 5
  } else if (gender === 'female') {
    bmr -= 161
  } else {
    // Average for not_specified
    bmr -= 78
  }
  
  return Math.round(bmr)
}

/**
 * Calculate TDEE from BMR and activity level
 * @param {number} bmr - Basal Metabolic Rate
 * @param {string} activityLevel - Activity level
 * @returns {number} TDEE in calories/day
 */
export function calculateTDEE(bmr, activityLevel) {
  if (!bmr) return null
  
  const multipliers = {
    sedentary: 1.2,      // Little or no exercise
    light: 1.375,        // Light exercise 1-3 days/week
    moderate: 1.55,      // Moderate exercise 3-5 days/week
    active: 1.725,       // Hard exercise 6-7 days/week
    very_active: 1.9,    // Very hard exercise, physical job
  }
  
  const multiplier = multipliers[activityLevel] || 1.55
  return Math.round(bmr * multiplier)
}

/**
 * Calculate age from date of birth
 * @param {string} dateOfBirth - Date string YYYY-MM-DD
 * @returns {number} Age in years
 */
export function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  
  const dob = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  
  return age
}

/**
 * Project weight loss timeline
 * @param {number} currentWeight - Current weight in lbs
 * @param {number} targetWeight - Goal weight in lbs
 * @param {number} tdee - Total Daily Energy Expenditure
 * @param {number} dailyCalories - Target daily calorie intake
 * @returns {object} Projection data
 */
export function projectWeightLoss(currentWeight, targetWeight, tdee, dailyCalories) {
  if (!currentWeight || !targetWeight || !tdee || !dailyCalories) return null
  
  const weightToLose = currentWeight - targetWeight
  if (weightToLose <= 0) return { alreadyAtGoal: true }
  
  // Daily calorie deficit
  const dailyDeficit = tdee - dailyCalories
  if (dailyDeficit <= 0) {
    return { noDeficit: true, surplus: Math.abs(dailyDeficit) }
  }
  
  // 3500 calories = 1 lb of fat (approximate)
  const lbsPerDay = dailyDeficit / 3500
  const lbsPerWeek = lbsPerDay * 7
  const daysToGoal = Math.ceil(weightToLose / lbsPerDay)
  const weeksToGoal = Math.ceil(daysToGoal / 7)
  
  // Calculate projected date
  const projectedDate = new Date()
  projectedDate.setDate(projectedDate.getDate() + daysToGoal)
  
  // Generate weekly projections (for chart)
  const projections = []
  let projectedWeight = currentWeight
  for (let week = 0; week <= Math.min(weeksToGoal, 52); week++) {
    projections.push({
      week,
      weight: Math.max(projectedWeight, targetWeight),
      date: new Date(Date.now() + week * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
    projectedWeight -= lbsPerWeek
  }
  
  return {
    dailyDeficit,
    lbsPerWeek: Math.round(lbsPerWeek * 10) / 10,
    daysToGoal,
    weeksToGoal,
    projectedDate: projectedDate.toISOString().split('T')[0],
    projections,
  }
}

/**
 * Estimate ketosis likelihood based on carbs and fasting
 * @param {number} dailyCarbs - Daily carb intake in grams
 * @param {boolean} isIntermittentFasting - Whether IF is enabled
 * @param {number} fastingHours - Hours fasted (from last meal to first meal)
 * @returns {object} Ketosis estimation
 */
export function estimateKetosis(dailyCarbs, isIntermittentFasting, fastingHours = 0) {
  // Ketosis thresholds
  const ketosisLevel = {
    status: 'none',
    probability: 0,
    message: '',
  }
  
  if (dailyCarbs === null || dailyCarbs === undefined) {
    return { status: 'unknown', probability: 0, message: 'Track carbs to estimate ketosis' }
  }
  
  // Base probability from carb intake
  if (dailyCarbs < 20) {
    ketosisLevel.probability = 90
    ketosisLevel.status = 'likely'
  } else if (dailyCarbs < 50) {
    ketosisLevel.probability = 70
    ketosisLevel.status = 'possible'
  } else if (dailyCarbs < 100) {
    ketosisLevel.probability = 30
    ketosisLevel.status = 'unlikely'
  } else {
    ketosisLevel.probability = 5
    ketosisLevel.status = 'none'
  }
  
  // Boost from intermittent fasting
  if (isIntermittentFasting && fastingHours >= 16) {
    ketosisLevel.probability = Math.min(ketosisLevel.probability + 15, 95)
    if (ketosisLevel.status === 'unlikely') {
      ketosisLevel.status = 'possible'
    }
  }
  
  // Generate message
  if (ketosisLevel.status === 'likely') {
    ketosisLevel.message = 'Your low carb intake suggests you may be in ketosis'
  } else if (ketosisLevel.status === 'possible') {
    ketosisLevel.message = 'Moderate carbs - ketosis is possible, especially with fasting'
  } else if (ketosisLevel.status === 'unlikely') {
    ketosisLevel.message = 'Carb intake is likely too high for ketosis'
  } else {
    ketosisLevel.message = 'High carb intake prevents ketosis'
  }
  
  return ketosisLevel
}

/**
 * Calculate fasting hours from food log
 * @param {Array} foodLogs - Array of food log entries with logged_at times
 * @returns {number} Approximate fasting hours
 */
export function calculateFastingHours(foodLogs) {
  if (!foodLogs || foodLogs.length === 0) return 24 // No food = full fast
  
  // Filter logs with timestamps
  const logsWithTime = foodLogs.filter(log => log.logged_at)
  if (logsWithTime.length === 0) return null
  
  // Get first and last meal times
  const times = logsWithTime.map(log => {
    const [h, m] = log.logged_at.split(':').map(Number)
    return h * 60 + m
  }).sort((a, b) => a - b)
  
  const firstMealMinutes = times[0]
  const lastMealMinutes = times[times.length - 1]
  
  // Eating window in minutes
  const eatingWindow = lastMealMinutes - firstMealMinutes
  
  // Fasting = 24 hours minus eating window
  const fastingMinutes = 24 * 60 - eatingWindow
  return Math.round(fastingMinutes / 60 * 10) / 10
}

/**
 * Calculate macro averages over a period
 * @param {Array} dailyTotals - Array of { date, calories, protein, fat, carbs }
 * @returns {object} Averages
 */
export function calculateMacroAverages(dailyTotals) {
  if (!dailyTotals || dailyTotals.length === 0) {
    return { calories: 0, protein: 0, fat: 0, carbs: 0, days: 0 }
  }
  
  const totals = dailyTotals.reduce((acc, day) => ({
    calories: acc.calories + (day.calories || 0),
    protein: acc.protein + (day.protein || 0),
    fat: acc.fat + (day.fat || 0),
    carbs: acc.carbs + (day.carbs || 0),
  }), { calories: 0, protein: 0, fat: 0, carbs: 0 })
  
  const days = dailyTotals.length
  
  return {
    calories: Math.round(totals.calories / days),
    protein: Math.round(totals.protein / days),
    fat: Math.round(totals.fat / days),
    carbs: Math.round(totals.carbs / days),
    days,
  }
}

