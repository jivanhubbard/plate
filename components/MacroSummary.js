import styles from './MacroSummary.module.css'

// Circular Progress Ring component
function ProgressRing({ progress, colorVar, size = 80, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference

  return (
    <svg width={size} height={size} className={styles.ringSvg}>
      {/* Background ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth={strokeWidth}
      />
      {/* Progress ring */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`var(${colorVar})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className={styles.progressCircle}
      />
    </svg>
  )
}

export default function MacroSummary({ totals, goals, goalTypes = {} }) {
  const getProgressPercentage = (current, goal) => {
    if (!goal) return 0
    return (current / goal) * 100
  }

  const caloriesLeft = Math.max(goals.calories - Math.round(totals.calories), 0)
  const caloriesPercentage = getProgressPercentage(totals.calories, goals.calories)

  // Macro rings using CSS variable names
  const macroItems = [
    {
      key: 'protein',
      label: 'Protein',
      current: Math.round(totals.protein),
      goal: goals.protein,
      unit: 'g',
      colorVar: '--ring-protein',
    },
    {
      key: 'carbs',
      label: 'Carbs',
      current: Math.round(totals.carbs),
      goal: goals.carbs,
      unit: 'g',
      colorVar: '--ring-carbs',
    },
    {
      key: 'fat',
      label: 'Fat',
      current: Math.round(totals.fat),
      goal: goals.fat,
      unit: 'g',
      colorVar: '--ring-fat',
    },
    {
      key: 'fiber',
      label: 'Fiber',
      current: Math.round(totals.fiber || 0),
      goal: goals.fiber || 30,
      unit: 'g',
      colorVar: '--ring-fiber',
    },
  ]

  return (
    <div className={styles.container}>
      {/* Main Calories Ring */}
      <div className={styles.caloriesSection}>
        <div className={styles.caloriesRing}>
          <ProgressRing
            progress={caloriesPercentage}
            colorVar="--ring-calories"
            size={180}
            strokeWidth={12}
          />
          <div className={styles.caloriesText}>
            <span className={styles.caloriesNumber}>
              {Math.round(totals.calories).toLocaleString()}
            </span>
            <span className={styles.caloriesLabel}>CALORIES</span>
          </div>
        </div>
        <div className={styles.caloriesInfo}>
          <span className={styles.caloriesLeft}>{caloriesLeft.toLocaleString()} left</span>
          <span className={styles.caloriesGoal}>of {goals.calories.toLocaleString()}</span>
        </div>
      </div>

      {/* Macro Rings Grid */}
      <div className={styles.macroGrid}>
        {macroItems.map((item) => {
          const percentage = getProgressPercentage(item.current, item.goal)

          return (
            <div key={item.key} className={styles.macroItem}>
              <div className={styles.macroRingWrapper}>
                <ProgressRing
                  progress={percentage}
                  colorVar={item.colorVar}
                  size={70}
                  strokeWidth={5}
                />
                <div className={styles.macroValue}>
                  <span className={styles.macroNumber}>{item.current}</span>
                  <span className={styles.macroUnit}>{item.unit}</span>
                </div>
              </div>
              <span className={styles.macroLabel}>{item.label}</span>
              <span className={styles.macroGoal}>of {item.goal}{item.unit}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
