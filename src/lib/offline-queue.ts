const QUEUE_KEY = 'haulproof_offline_queue'

export interface QueuedTicket {
  localId: string
  type: 'ticket' | 'timesheet'
  payload: Record<string, unknown>
  createdAt: string
  synced: boolean
}

function getQueue(): QueuedTicket[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveQueue(q: QueuedTicket[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export function enqueue(type: 'ticket' | 'timesheet', payload: Record<string, unknown>): string {
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const q = getQueue()
  q.push({ localId, type, payload, createdAt: new Date().toISOString(), synced: false })
  saveQueue(q)
  return localId
}

export function getPendingCount(): number {
  return getQueue().filter(q => !q.synced).length
}

export function markSynced(localId: string) {
  const q = getQueue().map(item => item.localId === localId ? { ...item, synced: true } : item)
  saveQueue(q)
}

export function getPending(): QueuedTicket[] {
  return getQueue().filter(q => !q.synced)
}

export function clearSynced() {
  saveQueue(getQueue().filter(q => !q.synced))
}
