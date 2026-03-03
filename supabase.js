import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── Poll API ────────────────────────────────────────────────

export async function fetchPoll(id) {
  const { data, error } = await supabase
    .from('polls')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function createPoll({ title, start_date, end_date, close_date }) {
  const { data, error } = await supabase
    .from('polls')
    .insert({ title, start_date, end_date, close_date, locked: false })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updatePollLock(id, locked) {
  const { error } = await supabase
    .from('polls')
    .update({ locked })
    .eq('id', id)
  if (error) throw error
}

// ─── Response API ────────────────────────────────────────────

export async function fetchResponses(pollId) {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('poll_id', pollId)
  if (error) return []
  return data
}

export async function upsertResponse(pollId, name, dateKey, status) {
  const { error } = await supabase
    .from('responses')
    .upsert(
      { poll_id: pollId, name, date_key: dateKey, status },
      { onConflict: 'poll_id,name,date_key' }
    )
  if (error) throw error
}

export async function deleteResponses(pollId, name) {
  const { error } = await supabase
    .from('responses')
    .delete()
    .eq('poll_id', pollId)
    .eq('name', name)
  if (error) throw error
}

// ─── Realtime ────────────────────────────────────────────────

export function subscribeToResponses(pollId, callback) {
  const channel = supabase
    .channel(`poll-${pollId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'responses',
      filter: `poll_id=eq.${pollId}`,
    }, callback)
    .subscribe()
  return () => supabase.removeChannel(channel)
}

export function subscribeToPoll(pollId, callback) {
  const channel = supabase
    .channel(`poll-meta-${pollId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'polls',
      filter: `id=eq.${pollId}`,
    }, callback)
    .subscribe()
  return () => supabase.removeChannel(channel)
}
