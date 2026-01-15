import styles from './MacroSummary.module.css'

export default function MacroSummary({ totals, goals, goalTypes = {} }) {
  // goalTypes: { calories: 'limit', protein: 'target', fat: 'limit', carbs: 'limit' }
  // 'target' = try to hit this number (protein)
  // 'limit' = stay under this number (calories, carbs for low-carb)

  const getProgressColor = (current, goal, goalType = 'target') => {
    const percentage = (current / goal) * 100

    if (goalType === 'limit') {
      // For limits (calories, low-carb): green when low, red when over
      if (percentage >= 100) return 'var(--danger)'
      if (percentage >= 90) return 'var(--warning)'
      if (percentage >= 75) return 'var(--success)'
      return 'var(--progress-blue)' // Low is fine for limits
    }

    // For targets (protein): want to hit the goal
    // Red: 0-20%, Orange: 20-50%, Blue: 50-75%, Green: 75%+
    if (percentage >= 100) return 'var(--danger)' // Over target
    if (percentage >= 75) return 'var(--success)'
    if (percentage >= 50) return 'var(--progress-blue)'
    if (percentage >= 20) return 'var(--warning)'
    return 'var(--danger-light)' // Less than 20%
  }

  const getProgressPercentage = (current, goal) => {
    return Math.min((current / goal) * 100, 100)
  }

  const macroItems = [
    {
      key: 'calories',
      label: 'Calories',
      current: Math.round(totals.calories),
      goal: goals.calories,
      unit: 'kcal',
      goalType: goalTypes.calories || 'limit',
    },
    {
      key: 'protein',
      label: 'Protein',
      current: Math.round(totals.protein),
      goal: goals.protein,
      unit: 'g',
      goalType: goalTypes.protein || 'target',
    },
    {
      key: 'fat',
      label: 'Fat',
      current: Math.round(totals.fat),
      goal: goals.fat,
      unit: 'g',
      goalType: goalTypes.fat || 'limit',
    },
    {
      key: 'carbs',
      label: 'Carbs',
      current: Math.round(totals.carbs),
      goal: goals.carbs,
      unit: 'g',
      goalType: goalTypes.carbs || 'limit',
    },
  ]

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Today's Macros</h2>
      <div className={styles.grid}>
        {macroItems.map((item) => {
          const percentage = getProgressPercentage(item.current, item.goal)
          const color = getProgressColor(item.current, item.goal, item.goalType)

          return (
            <div key={item.key} className={styles.macroCard}>
              <div className={styles.macroHeader}>
                <span className={styles.label}>
                  {item.label}
                  <span className={styles.goalType}>
                    {item.goalType === 'limit' ? '≤' : '≥'}
                  </span>
                </span>
                <span className={styles.amount}>
                  {item.current} / {item.goal} {item.unit}
                </span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
