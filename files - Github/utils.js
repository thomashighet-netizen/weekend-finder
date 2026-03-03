export function getWeekends(start, end) {
  const weekends = []
  const d = new Date(start)
  while (d.getDay() !== 6) d.setDate(d.getDate() + 1)
  while (d <= end) {
    const sat = new Date(d)
    const sun = new Date(d)
    sun.setDate(sun.getDate() + 1)
    if (sun <= end) weekends.push({ sat: new Date(sat), sun: new Date(sun) })
    d.setDate(d.getDate() + 7)
  }
  return weekends
}

export function fmt(date) { return date.toISOString().slice(0, 10) }
export function fmtDisplay(date) { return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
export function fmtMonth(date) { return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }) }

export const rank = { green: 0, orange: 1, none: 2, red: 3 }
export function worstOf(a, b) { return rank[a] >= rank[b] ? a : b }

export const STATUS_COLORS = {
  green:  { bg: '#4ade80', label: 'Free',      emoji: '✓' },
  orange: { bg: '#fb923c', label: 'Maybe',     emoji: '~' },
  red:    { bg: '#f87171', label: 'Busy',      emoji: '✗' },
  none:   { bg: 'transparent', label: 'No answer', emoji: '?' },
}

// responses is an object: { name: { dateKey: status } }
export function scoreWeekends(weekends, responses) {
  const names = Object.keys(responses)
  if (!names.length) return []
  return weekends.map(w => {
    const satKey = fmt(w.sat), sunKey = fmt(w.sun)
    let score = 0
    names.forEach(name => {
      const sat = responses[name]?.[satKey] || 'none'
      const sun = responses[name]?.[sunKey] || 'none'
      const worst = worstOf(sat, sun)
      if (worst === 'green') score += 2
      else if (worst === 'orange') score += 1
    })
    const freeCount = names.filter(n =>
      worstOf(responses[n]?.[satKey] || 'none', responses[n]?.[sunKey] || 'none') === 'green'
    ).length
    return { w, score, maxScore: names.length * 2, freeCount, allFree: freeCount === names.length }
  }).sort((a, b) => b.score - a.score)
}

// Convert flat responses array from Supabase into { name: { dateKey: status } }
export function shapedResponses(rows) {
  const out = {}
  for (const row of rows) {
    if (!out[row.name]) out[row.name] = {}
    out[row.name][row.date_key] = row.status
  }
  return out
}
