import { useState, useEffect, useCallback } from 'react'
import {
  fetchPoll, createPoll, updatePollLock,
  fetchResponses, upsertResponse, deleteResponses,
  subscribeToResponses, subscribeToPoll,
} from './supabase.js'
import { getWeekends, fmt, fmtDisplay, fmtMonth, worstOf, STATUS_COLORS, scoreWeekends, shapedResponses } from './utils.js'
import { S } from './styles.js'

// ─── Helpers ────────────────────────────────────────────────
function getPollIdFromUrl() {
  return window.location.pathname.slice(1) || null
}

// ============================================================
// MAIN APP
// ============================================================
export default function App() {
  const [screen, setScreen] = useState('loading')
  const [poll, setPoll] = useState(null)
  const [responses, setResponses] = useState({}) // { name: { dateKey: status } }
  const [error, setError] = useState(null)
  const [userName, setUserName] = useState(() => localStorage.getItem('wf-username') || '')
  const [nameInput, setNameInput] = useState('')
  const [nameError, setNameError] = useState('')

  const pollId = poll?.id

  // Load poll from URL on mount
  useEffect(() => {
    const id = getPollIdFromUrl()
    if (id) {
      fetchPoll(id).then(p => {
        if (p) {
          setPoll(p)
          fetchResponses(id).then(rows => {
            setResponses(shapedResponses(rows))
            setScreen('home')
          })
        } else {
          setError('Poll not found. It may have been deleted or the link is incorrect.')
          setScreen('notfound')
        }
      })
    } else {
      setScreen('create')
    }
  }, [])

  // Realtime: subscribe to response changes
  useEffect(() => {
    if (!pollId) return
    const unsub = subscribeToResponses(pollId, () => {
      fetchResponses(pollId).then(rows => setResponses(shapedResponses(rows)))
    })
    return unsub
  }, [pollId])

  // Realtime: subscribe to poll lock changes
  useEffect(() => {
    if (!pollId) return
    const unsub = subscribeToPoll(pollId, (payload) => {
      setPoll(prev => ({ ...prev, ...payload.new }))
    })
    return unsub
  }, [pollId])

  async function handleCreate(title, startDate, endDate, closeDate) {
    const p = await createPoll({ title, start_date: startDate, end_date: endDate, close_date: closeDate || null })
    setPoll(p)
    setResponses({})
    window.history.pushState({}, '', `/${p.id}`)
    setScreen('home')
  }

  async function handleUpsertResponse(name, dateKey, status) {
    // Optimistic update
    setResponses(prev => ({
      ...prev,
      [name]: { ...(prev[name] || {}), [dateKey]: status },
    }))
    await upsertResponse(poll.id, name, dateKey, status)
  }

  async function handleDeleteUser(name) {
    await deleteResponses(poll.id, name)
    setResponses(prev => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    setUserName('')
    localStorage.removeItem('wf-username')
    setScreen('home')
  }

  async function handleToggleLock() {
    const newLocked = !poll.locked
    setPoll(prev => ({ ...prev, locked: newLocked }))
    await updatePollLock(poll.id, newLocked)
  }

  function handleNameSubmit() {
    const trimmed = nameInput.trim()
    if (!trimmed) { setNameError('Please enter your name'); return }
    setUserName(trimmed)
    localStorage.setItem('wf-username', trimmed)
    setNameInput('')
    setNameError('')
    setScreen('fill')
  }

  const isClosed = poll && (poll.locked || (poll.close_date && new Date(poll.close_date) < new Date()))
  const shareUrl = poll ? `${window.location.origin}/${poll.id}` : ''

  // ── Screens ────────────────────────────────────────────────

  if (screen === 'loading') return (
    <div style={S.loading}>
      <div style={{ fontSize: 36 }}>📅</div>
      <div>Loading…</div>
    </div>
  )

  if (screen === 'notfound') return (
    <div style={S.page}>
      <div style={{ ...S.card, marginTop: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🤔</div>
        <h2 style={S.cardTitle}>Poll not found</h2>
        <p style={{ ...S.subtitle, marginTop: 8 }}>{error}</p>
        <button style={{ ...S.btnFull, marginTop: 20 }} onClick={() => { window.history.pushState({}, '', '/'); setScreen('create') }}>
          Create a new poll
        </button>
      </div>
    </div>
  )

  if (screen === 'create') return (
    <CreateScreen onCreated={handleCreate} />
  )

  if (screen === 'home') return (
    <HomeScreen
      poll={poll} responses={responses} isClosed={isClosed} shareUrl={shareUrl}
      userName={userName}
      onEnterName={() => userName ? setScreen('fill') : setScreen('enterName')}
      onOrganizer={() => setScreen('organizer')}
      onToggleLock={handleToggleLock}
      onNewPoll={() => { window.history.pushState({}, '', '/'); setScreen('create') }}
    />
  )

  if (screen === 'enterName') return (
    <div style={S.page}>
      <div style={{ ...S.card, marginTop: 40 }}>
        <h2 style={S.cardTitle}>Who are you?</h2>
        <p style={S.subtitle}>Enter your name to fill in your availability</p>
        <input style={S.input} placeholder="Your name" value={nameInput}
          onChange={e => setNameInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleNameSubmit()} autoFocus />
        {nameError && <p style={S.error}>{nameError}</p>}
        <button style={S.btnFull} onClick={handleNameSubmit}>Continue →</button>
        <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={() => setScreen('home')}>← Back</button>
      </div>
    </div>
  )

  if (screen === 'fill') return (
    <FillScreen
      poll={poll} responses={responses} userName={userName} isClosed={isClosed}
      onUpdate={handleUpsertResponse}
      onDelete={handleDeleteUser}
      onBack={() => setScreen('home')}
    />
  )

  if (screen === 'organizer') return (
    <OrganizerScreen
      poll={poll} responses={responses} isClosed={isClosed}
      onBack={() => setScreen('home')}
      onToggleLock={handleToggleLock}
    />
  )
}

// ============================================================
// CREATE SCREEN
// ============================================================
function CreateScreen({ onCreated }) {
  const [title, setTitle] = useState('')
  const [startDate, setStartDate] = useState('2025-05-01')
  const [endDate, setEndDate] = useState('2025-09-30')
  const [closeDate, setCloseDate] = useState('')
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    if (!title.trim()) { setErr('Please enter a title'); return }
    if (startDate >= endDate) { setErr('End date must be after start date'); return }
    setCreating(true)
    try {
      await onCreated(title.trim(), startDate, endDate, closeDate || null)
    } catch (e) {
      setErr('Something went wrong. Check your Supabase connection.')
      setCreating(false)
    }
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroIcon}>📅</div>
        <h1 style={S.heroTitle}>Weekend Finder</h1>
        <p style={S.heroSub}>Find the weekend that works for everyone</p>
      </div>
      <div style={S.card}>
        <h2 style={S.cardTitle}>Create a new poll</h2>
        <label style={S.label}>Poll title</label>
        <input style={S.input} placeholder="e.g. Summer trip 2025" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        <label style={S.label}>Start date</label>
        <input style={S.input} type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        <label style={S.label}>End date</label>
        <input style={S.input} type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        <label style={S.label}>
          Close date <span style={S.labelNote}>(optional — poll locks automatically on this date)</span>
        </label>
        <input style={S.input} type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)} />
        {err && <p style={S.error}>{err}</p>}
        <button style={S.btnFull} onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating…' : 'Create Poll →'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// HOME SCREEN
// ============================================================
function HomeScreen({ poll, responses, isClosed, shareUrl, userName, onEnterName, onOrganizer, onToggleLock, onNewPoll }) {
  const [copied, setCopied] = useState(false)
  const respondentCount = Object.keys(responses).length

  function copyLink() {
    navigator.clipboard?.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={S.page}>
      <div style={S.hero}>
        <div style={S.heroIcon}>📅</div>
        <h1 style={S.heroTitle}>Weekend Finder</h1>
        <p style={S.heroSub}>Find the weekend that works for everyone</p>
      </div>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={isClosed ? S.closedBadge : S.pollBadge}>{isClosed ? '🔒 Closed' : '● Active'}</div>
          <span style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace' }}>#{poll.id}</span>
        </div>
        <h2 style={S.cardTitle}>{poll.title}</h2>
        <p style={S.subtitle}>
          {new Date(poll.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {' – '}
          {new Date(poll.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          {poll.close_date && (
            <span style={{ color: '#9ca3af' }}>
              {' · closes '}
              {new Date(poll.close_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </p>
        <p style={S.respCount}>
          <span style={S.realtimeDot} />
          {respondentCount} {respondentCount === 1 ? 'person' : 'people'} responded · updates live
        </p>

        <div style={S.shareBox}>
          <span style={S.shareLabel}>🔗 Share this link with your group</span>
          <div style={S.shareRow}>
            <span style={S.shareUrl}>{shareUrl}</span>
            <button style={copied ? S.copyBtnDone : S.copyBtn} onClick={copyLink}>{copied ? '✓ Copied' : 'Copy'}</button>
          </div>
        </div>

        {!isClosed
          ? <button style={S.btnFull} onClick={onEnterName}>
              {userName ? `Continue as ${userName}` : 'Fill in my availability'}
            </button>
          : <div style={S.closedNote}>This poll is closed — no new responses accepted.</div>}

        <button style={S.btnSecondary} onClick={onOrganizer}>View organizer summary</button>
        <button style={{ ...S.btnGhost, marginTop: 8 }} onClick={onToggleLock}>
          {poll.locked ? '🔓 Unlock poll' : '🔒 Lock poll now'}
        </button>
        <button style={{ ...S.btnGhost, marginTop: 4 }} onClick={onNewPoll}>＋ Start a new poll</button>
      </div>
    </div>
  )
}

// ============================================================
// FILL SCREEN
// ============================================================
function FillScreen({ poll, responses, userName, isClosed, onUpdate, onDelete, onBack }) {
  const start = new Date(poll.start_date)
  const end = new Date(poll.end_date)
  const weekends = getWeekends(start, end)
  const myResponses = responses[userName] || {}
  const otherNames = Object.keys(responses).filter(n => n !== userName).sort()
  const allNames = [userName, ...otherNames]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  const scored = scoreWeekends(weekends, { ...responses, [userName]: myResponses })
  const topScore = scored[0]?.score ?? 0
  const bestKeys = new Set(scored.filter(s => s.score === topScore && topScore > 0).map(s => fmt(s.w.sat)))

  const byMonth = {}
  for (const w of weekends) {
    const mk = fmtMonth(w.sat)
    if (!byMonth[mk]) byMonth[mk] = []
    byMonth[mk].push(w)
  }

  async function toggle(dateKey) {
    if (isClosed || saving) return
    const cycle = ['none', 'green', 'orange', 'red']
    const current = myResponses[dateKey] || 'none'
    const next = cycle[(cycle.indexOf(current) + 1) % cycle.length]
    setSaving(true)
    await onUpdate(userName, dateKey, next)
    setSaving(false)
  }

  const CELL_W = 34, NAME_W = 100, ROW_H = 38, HEADER_H = 56

  function Cell({ status, onClick, isMe, day }) {
    const s = STATUS_COLORS[status]
    return (
      <div onClick={onClick} title={`${day}: ${s.label}`} style={{
        width: CELL_W, height: ROW_H, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: status === 'none' ? (isMe ? '#fefce8' : '#f9fafb') : s.bg,
        cursor: isMe && !isClosed ? 'pointer' : 'default',
        borderRight: '1px solid #efefef', borderBottom: '1px solid #f0f0f0',
        fontSize: status === 'none' ? 9 : 13,
        color: status === 'none' ? '#d1d5db' : '#fff',
        userSelect: 'none', transition: 'background 0.1s',
      }}>
        {status === 'none' && isMe && !isClosed ? '+' : status !== 'none' ? s.emoji : ''}
      </div>
    )
  }

  return (
    <div style={{ ...S.page, padding: '24px 0 80px', maxWidth: '100%' }}>
      <div style={{ ...S.fillHeader, padding: '0 16px', marginBottom: 10 }}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div>
          <h2 style={S.fillTitle}>{poll.title}</h2>
          <p style={S.fillSub}>
            {isClosed
              ? <span style={{ color: '#ef4444' }}>🔒 Poll is closed</span>
              : <>Hi <strong>{userName}</strong> — tap your row to set availability</>}
          </p>
        </div>
      </div>

      <div style={{ ...S.legend, padding: '0 16px', marginBottom: 12 }}>
        {['green', 'orange', 'red', 'none'].map(s => (
          <span key={s} style={S.legendItem}>
            <span style={{ ...S.legendDot, background: STATUS_COLORS[s].bg, border: s === 'none' ? '1px dashed #bbb' : 'none' }} />
            {STATUS_COLORS[s].label}
          </span>
        ))}
        {bestKeys.size > 0 && <span style={S.legendItem}><span style={{ fontSize: 12 }}>⭐</span> Best</span>}
        <span style={{ ...S.legendItem, marginLeft: 'auto' }}>
          <span style={S.realtimeDot} />live
        </span>
      </div>

      {Object.entries(byMonth).map(([month, ws]) => (
        <div key={month} style={{ marginBottom: 24 }}>
          <h3 style={{ ...S.monthLabel, padding: '0 16px' }}>{month}</h3>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'inline-flex', flexDirection: 'column', minWidth: '100%' }}>

              {/* Column headers */}
              <div style={{ display: 'flex', borderBottom: '2px solid #e5e7eb', background: '#fafaf8' }}>
                <div style={{ width: NAME_W, minWidth: NAME_W, height: HEADER_H, flexShrink: 0, display: 'flex', alignItems: 'flex-end', paddingBottom: 8, paddingLeft: 16, borderRight: '2px solid #e5e7eb' }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Person</span>
                </div>
                {ws.map(w => {
                  const isBest = bestKeys.has(fmt(w.sat))
                  return (
                    <div key={fmt(w.sat)} style={{
                      width: CELL_W * 2, minWidth: CELL_W * 2, flexShrink: 0,
                      height: HEADER_H, display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4,
                      borderRight: '1px solid #e5e7eb',
                      background: isBest ? '#fefce8' : '#fafaf8',
                    }}>
                      {isBest && <span style={{ fontSize: 10, marginBottom: 1 }}>⭐</span>}
                      <span style={{ fontSize: 10, fontWeight: 700, color: isBest ? '#92400e' : '#374151', lineHeight: 1.3, textAlign: 'center' }}>{fmtDisplay(w.sat)}</span>
                      <span style={{ fontSize: 9, color: '#9ca3af', lineHeight: 1.2 }}>–{fmtDisplay(w.sun)}</span>
                      <div style={{ display: 'flex', width: CELL_W * 2, marginTop: 3 }}>
                        {['Sat', 'Sun'].map(l => (
                          <span key={l} style={{ width: CELL_W, textAlign: 'center', fontSize: 9, color: '#bbb', fontWeight: 700 }}>{l}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* People rows */}
              {allNames.map((name, i) => {
                const isMe = name === userName
                const resp = responses[name] || {}
                return (
                  <div key={name} style={{
                    display: 'flex',
                    background: isMe ? '#fffbeb' : (i % 2 === 0 ? '#fff' : '#fafaf8'),
                    borderBottom: isMe ? '2px solid #fbbf24' : '1px solid #f0f0f0',
                  }}>
                    <div style={{ width: NAME_W, minWidth: NAME_W, height: ROW_H, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 16, borderRight: '2px solid #e5e7eb' }}>
                      <span style={{ fontSize: 12, fontWeight: isMe ? 700 : 500, color: isMe ? '#92400e' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: NAME_W - 20 }}>
                        {isMe ? `${name} (you)` : name}
                      </span>
                    </div>
                    {ws.map(w => {
                      const satKey = fmt(w.sat), sunKey = fmt(w.sun)
                      return (
                        <div key={satKey} style={{ display: 'flex', borderRight: '1px solid #e5e7eb' }}>
                          <Cell status={(isMe ? myResponses : resp)[satKey] || 'none'} isMe={isMe} day="Sat" onClick={() => isMe && toggle(satKey)} />
                          <Cell status={(isMe ? myResponses : resp)[sunKey] || 'none'} isMe={isMe} day="Sun" onClick={() => isMe && toggle(sunKey)} />
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {allNames.length === 1 && (
                <div style={{ padding: '12px 16px', color: '#9ca3af', fontSize: 13, fontStyle: 'italic', background: '#fff' }}>
                  No one else has responded yet.
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      <div style={S.saveBar}>
        {confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
            <span style={{ fontSize: 13, color: '#ef4444', flex: 1 }}>Remove yourself from this poll?</span>
            <button style={S.btnSmallDanger} onClick={() => onDelete(userName)}>Yes, remove me</button>
            <button style={S.btnSmallGhost} onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        ) : (
          <>
            <button style={S.btnTrash} onClick={() => setConfirmDelete(true)}>🗑 Remove me</button>
            <button style={S.btn} onClick={onBack}>Done ✓</button>
          </>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ORGANIZER SCREEN
// ============================================================
function OrganizerScreen({ poll, responses, isClosed, onBack, onToggleLock }) {
  const start = new Date(poll.start_date)
  const end = new Date(poll.end_date)
  const weekends = getWeekends(start, end)
  const names = Object.keys(responses)
  const scored = scoreWeekends(weekends, responses)
  const topScore = scored[0]?.score ?? 0

  const byMonth = {}
  for (const w of weekends) {
    const mk = fmtMonth(w.sat)
    if (!byMonth[mk]) byMonth[mk] = []
    byMonth[mk].push(w)
  }

  const perfectWeekends = scored.filter(s => s.allFree).map(s => s.w)
  const bestWeekends = !perfectWeekends.length
    ? scored.filter(s => s.score === topScore && topScore > 0).slice(0, 3).map(s => s.w)
    : []

  function getSummary(w) {
    const satKey = fmt(w.sat), sunKey = fmt(w.sun)
    const perPerson = names.map(name => {
      const sat = responses[name]?.[satKey] || 'none'
      const sun = responses[name]?.[sunKey] || 'none'
      return { name, sat, sun, worst: worstOf(sat, sun) }
    })
    const freeCount = perPerson.filter(p => p.worst === 'green').length
    const maybeCount = perPerson.filter(p => p.worst === 'orange').length
    return { perPerson, allFree: freeCount === names.length && names.length > 0, freeCount, maybeCount }
  }

  return (
    <div style={S.page}>
      <div style={S.fillHeader}>
        <button style={S.backBtn} onClick={onBack}>← Back</button>
        <div style={{ flex: 1 }}>
          <h2 style={S.fillTitle}>{poll.title}</h2>
          <p style={S.fillSub}>
            <span style={S.realtimeDot} />
            Organizer view · {names.length} {names.length === 1 ? 'response' : 'responses'} · live
          </p>
        </div>
        <button style={isClosed ? S.unlockBtn : S.lockBtn} onClick={onToggleLock}>
          {isClosed ? '🔓 Unlock' : '🔒 Lock'}
        </button>
      </div>

      {isClosed && <div style={S.closedBanner}>🔒 Poll is locked — responses are frozen.</div>}

      {names.length === 0 ? (
        <div style={S.emptyState}><div style={{ fontSize: 48 }}>👋</div><p>No responses yet. Share the link!</p></div>
      ) : (
        <>
          {perfectWeekends.length > 0 && (
            <div style={S.perfectBanner}>
              <div style={S.perfectTitle}>🎉 Everyone is free!</div>
              <div style={S.perfectList}>
                {perfectWeekends.map(w => <span key={fmt(w.sat)} style={S.perfectChip}>{fmtDisplay(w.sat)}–{fmtDisplay(w.sun)}</span>)}
              </div>
            </div>
          )}
          {bestWeekends.length > 0 && (
            <div style={S.bestBanner}>
              <div style={S.bestTitle}>⭐ Best available weekends</div>
              <div style={S.perfectList}>
                {bestWeekends.map(w => <span key={fmt(w.sat)} style={S.bestChip}>{fmtDisplay(w.sat)}–{fmtDisplay(w.sun)}</span>)}
              </div>
            </div>
          )}

          {Object.entries(byMonth).map(([month, ws]) => (
            <div key={month} style={S.monthBlock}>
              <h3 style={S.monthLabel}>{month}</h3>
              {ws.map(w => {
                const { perPerson, allFree, freeCount, maybeCount } = getSummary(w)
                const isBest = !allFree && scored.find(s => fmt(s.w.sat) === fmt(w.sat))?.score === topScore && topScore > 0
                return (
                  <div key={fmt(w.sat)} style={{
                    ...S.orgWeekend,
                    borderLeft: allFree ? '4px solid #4ade80' : isBest ? '4px solid #fbbf24' : '4px solid #e5e7eb',
                    background: allFree ? '#f0fdf4' : isBest ? '#fffbeb' : '#fff',
                  }}>
                    <div style={S.orgWeekendHeader}>
                      <span style={S.orgWeekendDate}>
                        {fmtDisplay(w.sat)} – {fmtDisplay(w.sun)}
                        {allFree && <span style={S.freeTag}>✓ All free</span>}
                        {isBest && !allFree && <span style={S.bestTag}>⭐ Best</span>}
                      </span>
                      <span style={S.orgCount}>
                        <span style={{ color: '#4ade80' }}>●</span> {freeCount}
                        {maybeCount > 0 && <><span style={{ color: '#fb923c' }}>●</span> {maybeCount}</>}
                      </span>
                    </div>
                    <div style={S.personGrid}>
                      {perPerson.map(({ name, sat, sun }) => (
                        <div key={name} style={S.personRow}>
                          <span style={S.personName}>{name}</span>
                          {[{ l: 'Sat', s: sat }, { l: 'Sun', s: sun }].map(({ l, s }) => (
                            <span key={l} style={{ ...S.personStatus, background: s === 'none' ? '#e5e7eb' : STATUS_COLORS[s].bg, opacity: s === 'none' ? 0.4 : 1 }} title={`${l}: ${STATUS_COLORS[s].label}`} />
                          ))}
                          <span style={S.personLabel}>{STATUS_COLORS[worstOf(sat, sun)].label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </>
      )}
    </div>
  )
}
